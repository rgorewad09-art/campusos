-- ==============================================================================
-- Migration: 005_teacher_management.sql
-- Description:
--   1. Sequence and atomic generator for Teacher IDs in format TCH-YYYY-XXXX.
--      Note: The sequence is globally monotonic and continuously increasing;
--      it does not reset annually, preventing ID collision across calendar years.
--   2. Creates public.teachers with nullable user_id foreign key to auth.users.
--   3. Normalization trigger ensuring teacher emails are always lowercase and trimmed.
--   4. Creates public.classes for course and class scheduling.
--   5. Creates public.teacher_classes junction table for class assignments.
--   6. Non-recursive helper functions:
--      - public.is_campusos_admin() (compatible with Migration 004)
--      - public.is_campusos_teacher()
--      - public.get_current_teacher_id() (defined AFTER public.teachers exists)
--   7. Row Level Security (RLS) enforcement:
--      - Administrators: Full management of teachers, classes, and assignments.
--      - Teachers: Read-only access strictly scoped to own record and assigned classes.
--      - Students/Anonymous: Excluded from teacher administration data.
--   8. Indexes, constraints, and audit timestamps.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Teacher Code Sequence and Generator
-- ------------------------------------------------------------------------------

-- Global monotonic sequence for Teacher IDs.
-- Note: The numeric sequence increments continuously and does not reset annually.
-- The YYYY prefix documents the registration year while the continuous sequence number
-- prevents cross-year ID recycling or duplicate collisions.
CREATE SEQUENCE IF NOT EXISTS public.teacher_code_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.generate_teacher_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_year text;
  v_seq bigint;
BEGIN
  v_year := to_char(CURRENT_DATE, 'YYYY');
  v_seq := nextval('public.teacher_code_seq');
  RETURN 'TCH-' || v_year || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_teacher_code() IS
'Generates atomic, collision-free Teacher IDs in format TCH-YYYY-XXXX. The sequence is globally increasing and does not reset annually.';

-- ------------------------------------------------------------------------------
-- 2. Base Helper Functions (Profile-Dependent Only)
-- ------------------------------------------------------------------------------

-- Non-recursive helper to verify if authenticated caller is an administrator
-- (Re-declared identically to Migration 004 to ensure complete self-containment)
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

-- Non-recursive helper to verify if authenticated caller is a teacher
CREATE OR REPLACE FUNCTION public.is_campusos_teacher()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'teacher'
  );
$$;

ALTER FUNCTION public.is_campusos_teacher() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.is_campusos_teacher() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_campusos_teacher() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. Table: public.teachers
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_code text UNIQUE NOT NULL DEFAULT public.generate_teacher_code(),
  first_name text NOT NULL CHECK (char_length(trim(first_name)) > 0),
  last_name text NOT NULL CHECK (char_length(trim(last_name)) > 0),
  email text NOT NULL,
  phone text,
  department text NOT NULL DEFAULT 'General',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave', 'suspended')),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_teachers_email_trimmed CHECK (email = lower(trim(email))),
  CONSTRAINT chk_teachers_email_format CHECK (email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$')
);

-- Case-insensitive uniqueness index for teacher emails
CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_email_unique
  ON public.teachers (lower(trim(email)));

CREATE INDEX IF NOT EXISTS idx_teachers_teacher_code
  ON public.teachers (teacher_code);

CREATE INDEX IF NOT EXISTS idx_teachers_user_id
  ON public.teachers (user_id);

CREATE INDEX IF NOT EXISTS idx_teachers_status
  ON public.teachers (status);

CREATE INDEX IF NOT EXISTS idx_teachers_department
  ON public.teachers (department);

-- Trigger to normalize inputs and maintain updated_at on public.teachers
CREATE OR REPLACE FUNCTION public.handle_teachers_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Strict normalization: lowercase and trim email
  NEW.email := lower(trim(NEW.email));
  NEW.first_name := trim(NEW.first_name);
  NEW.last_name := trim(NEW.last_name);
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := trim(NEW.phone);
  END IF;
  IF NEW.department IS NOT NULL THEN
    NEW.department := trim(NEW.department);
  END IF;
  
  -- Auto-generate code if omitted or blank
  IF NEW.teacher_code IS NULL OR trim(NEW.teacher_code) = '' THEN
    NEW.teacher_code := public.generate_teacher_code();
  ELSE
    NEW.teacher_code := upper(trim(NEW.teacher_code));
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teachers_before_write ON public.teachers;
CREATE TRIGGER trg_teachers_before_write
  BEFORE INSERT OR UPDATE ON public.teachers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_teachers_before_write();

-- ------------------------------------------------------------------------------
-- 4. Table: public.classes
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL CHECK (char_length(trim(code)) > 0),
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  department text NOT NULL DEFAULT 'General',
  description text,
  room text,
  schedule text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_classes_code_trimmed CHECK (code = upper(trim(code)))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_code_unique
  ON public.classes (upper(trim(code)));

CREATE INDEX IF NOT EXISTS idx_classes_department
  ON public.classes (department);

CREATE INDEX IF NOT EXISTS idx_classes_status
  ON public.classes (status);

-- Trigger to normalize inputs and maintain updated_at on public.classes
CREATE OR REPLACE FUNCTION public.handle_classes_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.code := upper(trim(NEW.code));
  NEW.name := trim(NEW.name);
  IF NEW.department IS NOT NULL THEN
    NEW.department := trim(NEW.department);
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_classes_before_write ON public.classes;
CREATE TRIGGER trg_classes_before_write
  BEFORE INSERT OR UPDATE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_classes_before_write();

-- ------------------------------------------------------------------------------
-- 5. Table: public.teacher_classes (Assignments)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.teacher_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  academic_term text NOT NULL DEFAULT '2026-Fall',
  role text NOT NULL DEFAULT 'primary_instructor' CHECK (role IN ('primary_instructor', 'assistant', 'substitute')),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_teacher_class_term UNIQUE (teacher_id, class_id, academic_term)
);

CREATE INDEX IF NOT EXISTS idx_teacher_classes_teacher_id
  ON public.teacher_classes (teacher_id);

CREATE INDEX IF NOT EXISTS idx_teacher_classes_class_id
  ON public.teacher_classes (class_id);

CREATE INDEX IF NOT EXISTS idx_teacher_classes_term
  ON public.teacher_classes (academic_term);

-- ------------------------------------------------------------------------------
-- 6. Dependent Helper Function: public.get_current_teacher_id()
-- (Defined here because it queries public.teachers, which is now created above)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_current_teacher_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.teachers
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

ALTER FUNCTION public.get_current_teacher_id() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.get_current_teacher_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_teacher_id() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. Row Level Security: public.teachers
-- ------------------------------------------------------------------------------

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to teachers" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can view own teacher record" ON public.teachers;

-- Administrators possess full CRUD privileges on teachers
CREATE POLICY "Admins have full access to teachers"
ON public.teachers FOR ALL
TO authenticated
USING (
  public.is_campusos_admin()
)
WITH CHECK (
  public.is_campusos_admin()
);

-- Teachers can view only their own linked teacher record
CREATE POLICY "Teachers can view own teacher record"
ON public.teachers FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR public.is_campusos_admin()
);

-- ------------------------------------------------------------------------------
-- 8. Row Level Security: public.classes
-- ------------------------------------------------------------------------------

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can view assigned classes" ON public.classes;

-- Administrators possess full CRUD privileges on classes
CREATE POLICY "Admins have full access to classes"
ON public.classes FOR ALL
TO authenticated
USING (
  public.is_campusos_admin()
)
WITH CHECK (
  public.is_campusos_admin()
);

-- Teachers can view classes they are actively assigned to teach
CREATE POLICY "Teachers can view assigned classes"
ON public.classes FOR SELECT
TO authenticated
USING (
  public.is_campusos_admin() OR
  id IN (
    SELECT class_id
    FROM public.teacher_classes
    WHERE teacher_id = public.get_current_teacher_id()
  )
);

-- ------------------------------------------------------------------------------
-- 9. Row Level Security: public.teacher_classes
-- ------------------------------------------------------------------------------

ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to teacher_classes" ON public.teacher_classes;
DROP POLICY IF EXISTS "Teachers can view own class assignments" ON public.teacher_classes;

-- Administrators possess full CRUD privileges on teacher class assignments
CREATE POLICY "Admins have full access to teacher_classes"
ON public.teacher_classes FOR ALL
TO authenticated
USING (
  public.is_campusos_admin()
)
WITH CHECK (
  public.is_campusos_admin()
);

-- Teachers can view their own class assignments
CREATE POLICY "Teachers can view own class assignments"
ON public.teacher_classes FOR SELECT
TO authenticated
USING (
  public.is_campusos_admin() OR
  teacher_id = public.get_current_teacher_id()
);

COMMIT;
