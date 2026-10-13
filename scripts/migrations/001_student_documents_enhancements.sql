-- ============================================================================
-- Migration: 001_student_documents_enhancements.sql
-- Description:
--   1. Adds metadata and rejection reason columns to public.student_documents.
--   2. Ensures private storage bucket 'student-documents' exists with RLS.
--   3. Adds storage.objects policies permitting authorized administrators to
--      upload, view, and delete documents for student records.
-- ============================================================================

-- Step 1: Enhance public.student_documents with metadata and rejection reason
ALTER TABLE public.student_documents
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Step 2: Ensure student-documents private bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-documents',
  'student-documents',
  false,
  10485760, -- 10MB in bytes
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- Step 3: Storage Row Level Security Policies for student-documents
-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3a. Storage: Admin Upload Policy
DROP POLICY IF EXISTS "Admins can upload student documents" ON storage.objects;
CREATE POLICY "Admins can upload student documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-documents' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

-- 3b. Storage: Admin View Policy
DROP POLICY IF EXISTS "Admins can view student documents" ON storage.objects;
CREATE POLICY "Admins can view student documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'student-documents' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

-- 3c. Storage: Admin Delete Policy
DROP POLICY IF EXISTS "Admins can delete student documents" ON storage.objects;
CREATE POLICY "Admins can delete student documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'student-documents' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

-- Step 4: Verify Table Policies on public.student_documents
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage student_documents" ON public.student_documents;
CREATE POLICY "Admins can manage student_documents"
ON public.student_documents FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);
