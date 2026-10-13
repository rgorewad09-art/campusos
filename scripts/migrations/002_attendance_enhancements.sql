-- ============================================================================
-- Migration: 002_attendance_enhancements.sql
-- Description:
--   1. Adds optional 'remarks' and 'updated_at' columns to public.attendance.
--   2. Verifies the unique constraint on (student_id, attendance_date).
--   3. Ensures Row Level Security policies permit authenticated administrators
--      to read, insert, update, and delete attendance records.
-- ============================================================================

-- Step 1: Add optional columns if they don't already exist
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS remarks text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Step 2: Ensure unique constraint exists on (student_id, attendance_date)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_student_id_attendance_date_key'
       OR (conrelid = 'public.attendance'::regclass AND contype = 'u')
  ) THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_student_id_attendance_date_key
      UNIQUE (student_id, attendance_date);
  END IF;
END $$;

-- Step 3: Ensure Row Level Security is enabled on public.attendance
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Step 4: Administrator policy for public.attendance
DROP POLICY IF EXISTS "Admins can manage attendance" ON public.attendance;
CREATE POLICY "Admins can manage attendance"
ON public.attendance FOR ALL
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
