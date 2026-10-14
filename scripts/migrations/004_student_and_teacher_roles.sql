-- ==============================================================================
-- Migration: 004_student_and_teacher_roles.sql (Hardened & Non-Recursive)
-- Description:
--   1. Implements secure, non-recursive helper public.is_campusos_admin().
--   2. Links public.students to auth.users via a unique user_id foreign key.
--   3. Pre-checks for duplicate emails, then enforces unique email index on active students.
--   4. Expands public.profiles role constraint to support 'admin', 'teacher', and 'student'.
--   5. Configures non-recursive Row Level Security (RLS) on public.profiles.
--   6. Enforces least-privilege RLS:
--      - Students: read-only access to own profile, attendance, and documents.
--      - Students: insert access to upload own documents (pending verification).
--      - Teachers: read access to student directory and management of attendance.
--      - Teachers: strictly excluded from confidential student verification documents.
--      - Administrators: preserved full access across all application tables and storage.
--   7. Drops all legacy policies from migrations 001 and 002 to prevent
--      permissive OR policy accumulation.
--   8. Configures Storage RLS policies for the private 'student-documents' bucket.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Helper Function: Non-Recursive is_campusos_admin()
-- ------------------------------------------------------------------------------

-- SECURITY DEFINER executes with owner (postgres / BYPASSRLS) privileges,
-- which prevents infinite recursion when invoked inside public.profiles policies.
CREATE OR REPLACE FUNCTION public.is_campusos_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

ALTER FUNCTION public.is_campusos_admin() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.is_campusos_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_campusos_admin() TO authenticated, service_role;

COMMENT ON FUNCTION public.is_campusos_admin() IS
'Returns true if the authenticated caller holds role = admin in public.profiles. Non-recursive SECURITY DEFINER.';

-- ------------------------------------------------------------------------------
-- 2. Profiles Role Constraint & Non-Recursive Profiles RLS
-- ------------------------------------------------------------------------------

-- Safely drop any legacy role check constraints to prevent collision
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.profiles'::regclass 
      AND contype = 'c' 
      AND conname IN ('profiles_role_check', 'chk_profiles_role')
  ) LOOP
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;

  ALTER TABLE public.profiles
    ADD CONSTRAINT chk_profiles_role
    CHECK (role IN ('admin', 'teacher', 'student'));
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Non-recursive: Users read their own profile (id = auth.uid()) OR admins read all profiles.
-- Using public.is_campusos_admin() avoids recursive queries on public.profiles.
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid() OR public.is_campusos_admin()
);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  id = auth.uid() OR public.is_campusos_admin()
)
WITH CHECK (
  id = auth.uid() OR public.is_campusos_admin()
);

-- ------------------------------------------------------------------------------
-- 3. Student Account Linking & Unique Email Index
-- ------------------------------------------------------------------------------

-- Pre-check: Detect duplicate active student emails before index creation
DO $$
DECLARE
  v_dup_count integer;
BEGIN
  SELECT count(*) INTO v_dup_count
  FROM (
    SELECT lower(trim(email))
    FROM public.students
    WHERE email IS NOT NULL AND status IS DISTINCT FROM 'graduated'
    GROUP BY lower(trim(email))
    HAVING count(*) > 1
  ) dups;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Cannot create unique email index: % duplicate active student email(s) found in public.students. Manual deduplication is required before applying this migration.', v_dup_count
      USING ERRCODE = '23505';
  END IF;
END $$;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);

-- Enforce email uniqueness among active students (excluding graduated)
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_email_unique
  ON public.students(lower(trim(email)))
  WHERE email IS NOT NULL AND status IS DISTINCT FROM 'graduated';

-- ------------------------------------------------------------------------------
-- 4. Row Level Security: public.students
-- ------------------------------------------------------------------------------

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Clean up any legacy or duplicate permissive policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.students;
DROP POLICY IF EXISTS "Allow authenticated users to read students" ON public.students;
DROP POLICY IF EXISTS "Students are viewable by authenticated users" ON public.students;
DROP POLICY IF EXISTS "Users can view students" ON public.students;
DROP POLICY IF EXISTS "Students can view own record" ON public.students;
DROP POLICY IF EXISTS "Admins can manage students" ON public.students;

-- Students view only their own record; Teachers & Admins can view student directory
CREATE POLICY "Students can view own record"
ON public.students FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  public.is_campusos_admin() OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'teacher'
  )
);

-- Only administrators can insert, update, or delete student profiles
CREATE POLICY "Admins can manage students"
ON public.students FOR ALL
TO authenticated
USING (
  public.is_campusos_admin()
)
WITH CHECK (
  public.is_campusos_admin()
);

-- ------------------------------------------------------------------------------
-- 5. Row Level Security: public.attendance
-- ------------------------------------------------------------------------------

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Clean up legacy policy from Migration 002 to avoid duplicate permissive OR evaluation
DROP POLICY IF EXISTS "Admins can manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "Students can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers and admins can manage attendance" ON public.attendance;

-- Students view only their own attendance records
CREATE POLICY "Students can view own attendance"
ON public.attendance FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM public.students WHERE user_id = auth.uid()
  ) OR
  public.is_campusos_admin() OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'teacher'
  )
);

-- Teachers and administrators can record and manage attendance
CREATE POLICY "Teachers and admins can manage attendance"
ON public.attendance FOR ALL
TO authenticated
USING (
  public.is_campusos_admin() OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'teacher'
  )
)
WITH CHECK (
  public.is_campusos_admin() OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'teacher'
  )
);

-- ------------------------------------------------------------------------------
-- 6. Row Level Security: public.student_documents
-- ------------------------------------------------------------------------------

ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;

-- Clean up legacy policy from Migration 001 to prevent duplicate permissive rules
DROP POLICY IF EXISTS "Admins can manage student_documents" ON public.student_documents;
DROP POLICY IF EXISTS "Students can view own documents" ON public.student_documents;
DROP POLICY IF EXISTS "Students can upload own documents" ON public.student_documents;

-- Students view ONLY their own documents; Admins view all documents.
-- Teachers are strictly excluded from confidential student verification documents.
CREATE POLICY "Students can view own documents"
ON public.student_documents FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM public.students WHERE user_id = auth.uid()
  ) OR
  public.is_campusos_admin()
);

-- Students can upload documents for themselves in 'pending' status
CREATE POLICY "Students can upload own documents"
ON public.student_documents FOR INSERT
TO authenticated
WITH CHECK (
  student_id IN (
    SELECT id FROM public.students WHERE user_id = auth.uid()
  )
  AND verification_status = 'pending'
);

-- Admins retain full management (verification, rejection, deletion)
CREATE POLICY "Admins can manage student_documents"
ON public.student_documents FOR ALL
TO authenticated
USING (
  public.is_campusos_admin()
)
WITH CHECK (
  public.is_campusos_admin()
);

-- ------------------------------------------------------------------------------
-- 7. Storage Row Level Security: storage.objects ('student-documents' bucket)
-- ------------------------------------------------------------------------------

-- Clean up legacy storage policies from Migration 001 to prevent duplicate permissive rules
DROP POLICY IF EXISTS "Admins can upload student documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view student documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete student documents" ON storage.objects;
DROP POLICY IF EXISTS "Students can view own storage documents" ON storage.objects;
DROP POLICY IF EXISTS "Students can upload own storage documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage storage documents" ON storage.objects;

-- Students can read their own documents from storage (students/{student_id}/*); Admins can read all.
-- Teachers are strictly excluded from private storage objects.
CREATE POLICY "Students can view own storage documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'student-documents' AND (
    (
      (storage.foldername(name))[1] = 'students' AND
      (storage.foldername(name))[2] IN (
        SELECT id::text FROM public.students WHERE user_id = auth.uid()
      )
    ) OR
    public.is_campusos_admin()
  )
);

-- Students can upload into their own student folder (students/{student_id}/*)
CREATE POLICY "Students can upload own storage documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-documents' AND
  (storage.foldername(name))[1] = 'students' AND
  (storage.foldername(name))[2] IN (
    SELECT id::text FROM public.students WHERE user_id = auth.uid()
  )
);

-- Admins retain full storage control
CREATE POLICY "Admins can manage storage documents"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'student-documents' AND
  public.is_campusos_admin()
)
WITH CHECK (
  bucket_id = 'student-documents' AND
  public.is_campusos_admin()
);

COMMIT;
