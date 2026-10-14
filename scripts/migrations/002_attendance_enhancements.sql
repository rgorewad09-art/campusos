-- ============================================================================
-- Migration: 002_attendance_enhancements.sql
-- Description:
--   1. Adds optional 'remarks' and 'updated_at' columns to public.attendance.
--   2. Detects duplicate records on (student_id, attendance_date) without deleting.
--   3. Specifically enforces the unique constraint on (student_id, attendance_date).
--   4. Ensures Row Level Security policies permit authenticated administrators
--      to read, insert, update, and delete attendance records.
-- ============================================================================

BEGIN;

-- Step 1: Add optional columns if they don't already exist
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS remarks text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Step 2: Enforce unique constraint specifically on (student_id, attendance_date)
DO $$
DECLARE
  v_dup_count integer;
  v_constraint_exists boolean;
BEGIN
  -- 2a. Check if the specific constraint on (student_id, attendance_date) already exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a1 ON a1.attrelid = c.conrelid AND a1.attnum = c.conkey[1]
    JOIN pg_attribute a2 ON a2.attrelid = c.conrelid AND a2.attnum = c.conkey[2]
    WHERE c.conrelid = 'public.attendance'::regclass
      AND c.contype = 'u'
      AND array_length(c.conkey, 1) = 2
      AND (
        (a1.attname = 'student_id' AND a2.attname = 'attendance_date') OR
        (a1.attname = 'attendance_date' AND a2.attname = 'student_id')
      )
  ) INTO v_constraint_exists;

  IF NOT v_constraint_exists THEN
    -- 2b. Check for duplicate records before adding constraint (do NOT delete automatically)
    SELECT count(*) INTO v_dup_count
    FROM (
      SELECT student_id, attendance_date
      FROM public.attendance
      GROUP BY student_id, attendance_date
      HAVING count(*) > 1
    ) dups;

    IF v_dup_count > 0 THEN
      RAISE EXCEPTION 'Cannot add unique constraint: % duplicate (student_id, attendance_date) group(s) detected in public.attendance. Manual deduplication is required before applying this migration.', v_dup_count
        USING ERRCODE = '23505';
    END IF;

    -- 2c. Add the unique constraint
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

COMMIT;
