-- ==============================================================================
-- Migration: 007_otp_attendance.sql
-- Description:
--   Dedicated Teacher Attendance and OTP-Based Student Attendance for CampusOS:
--   1. public.attendance_sessions:
--      Tracks live attendance sessions, short-lived hashed OTPs, expiration,
--      associated teacher, subject, course, section, and timetable slot.
--   2. public.attendance_otp_attempts:
--      Enforces rate limiting, prevents brute-force attempts on 6-digit OTPs
--      (max 5 attempts per student per session).
--   3. public.attendance enhancements:
--      Adds session_id, subject_id, course_id, section, semester,
--      verification_method ('otp', 'manual', 'override'), and manual override audit fields.
--   4. Partial unique indexes on public.attendance:
--      - (student_id, session_id) for session attendance (prevents duplicate submissions)
--      - (student_id, attendance_date, subject_id) for subject attendance
--      - (student_id, attendance_date) for legacy general daily attendance
--   5. Row Level Security (RLS) policies:
--      - Administrators: Full oversight across all sessions and records.
--      - Teachers: Scoped strictly to own assigned classes and sessions.
--      - Students: Read own attendance history; submit OTPs via server verification.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Table: public.attendance_sessions
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  timetable_id uuid REFERENCES public.timetables(id) ON DELETE SET NULL,
  section text NOT NULL DEFAULT 'A' CHECK (char_length(trim(section)) > 0),
  semester integer NOT NULL DEFAULT 1 CHECK (semester >= 1 AND semester <= 12),
  academic_term text NOT NULL DEFAULT '2026-Fall',
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  otp_hash text NOT NULL,
  encrypted_otp text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'closed')),
  expires_at timestamptz NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_att_sessions_teacher
  ON public.attendance_sessions (teacher_id, session_date);

CREATE INDEX IF NOT EXISTS idx_att_sessions_course_sec
  ON public.attendance_sessions (course_id, semester, section);

CREATE INDEX IF NOT EXISTS idx_att_sessions_subject
  ON public.attendance_sessions (subject_id);

CREATE INDEX IF NOT EXISTS idx_att_sessions_status_exp
  ON public.attendance_sessions (status, expires_at);

-- ------------------------------------------------------------------------------
-- 2. Table: public.attendance_otp_attempts (Brute-Force & Rate-Limit Tracking)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.attendance_otp_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attempt_count integer NOT NULL DEFAULT 1,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  is_blocked boolean NOT NULL DEFAULT false,
  CONSTRAINT uq_session_student_attempts UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_otp_attempts_session_student
  ON public.attendance_otp_attempts (session_id, student_id);

-- ------------------------------------------------------------------------------
-- 3. Enhance public.attendance with Session, Subject, and Override Columns
-- ------------------------------------------------------------------------------

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.attendance_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS section text,
  ADD COLUMN IF NOT EXISTS semester integer,
  ADD COLUMN IF NOT EXISTS verification_method text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS override_reason text,
  ADD COLUMN IF NOT EXISTS overridden_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS overridden_at timestamptz;

-- Add check constraint for verification_method if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_attendance_verification_method'
  ) THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT chk_attendance_verification_method
      CHECK (verification_method IN ('otp', 'manual', 'override'));
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. Unique Constraints & Indexes on public.attendance
-- ------------------------------------------------------------------------------

-- Safely drop old daily-only unique constraint so multi-subject and multi-session attendance can be recorded
ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_student_id_attendance_date_key;

-- A. Prevent duplicate attendance per student for the same OTP/class session
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_student_session
  ON public.attendance (student_id, session_id)
  WHERE session_id IS NOT NULL;

-- B. Prevent duplicate attendance per student for the same date and subject (when recorded without session)
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_student_date_subject
  ON public.attendance (student_id, attendance_date, subject_id)
  WHERE session_id IS NULL AND subject_id IS NOT NULL;

-- C. Preserve uniqueness for legacy general daily attendance (when both session and subject are null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_student_daily_legacy
  ON public.attendance (student_id, attendance_date)
  WHERE session_id IS NULL AND subject_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_session_id
  ON public.attendance (session_id);

CREATE INDEX IF NOT EXISTS idx_attendance_subject_id
  ON public.attendance (subject_id);

CREATE INDEX IF NOT EXISTS idx_attendance_verification_method
  ON public.attendance (verification_method);

-- ------------------------------------------------------------------------------
-- 5. Row Level Security: public.attendance_sessions
-- ------------------------------------------------------------------------------

ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to attendance_sessions" ON public.attendance_sessions;
CREATE POLICY "Admins have full access to attendance_sessions"
  ON public.attendance_sessions FOR ALL TO authenticated
  USING (public.is_campusos_admin())
  WITH CHECK (public.is_campusos_admin());

DROP POLICY IF EXISTS "Teachers can view own attendance_sessions" ON public.attendance_sessions;
CREATE POLICY "Teachers can view own attendance_sessions"
  ON public.attendance_sessions FOR SELECT TO authenticated
  USING (
    public.is_campusos_admin() OR
    teacher_id = public.get_current_teacher_id()
  );

DROP POLICY IF EXISTS "Teachers can insert own attendance_sessions" ON public.attendance_sessions;
CREATE POLICY "Teachers can insert own attendance_sessions"
  ON public.attendance_sessions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_campusos_admin() OR
    teacher_id = public.get_current_teacher_id()
  );

DROP POLICY IF EXISTS "Teachers can update own attendance_sessions" ON public.attendance_sessions;
CREATE POLICY "Teachers can update own attendance_sessions"
  ON public.attendance_sessions FOR UPDATE TO authenticated
  USING (
    public.is_campusos_admin() OR
    teacher_id = public.get_current_teacher_id()
  )
  WITH CHECK (
    public.is_campusos_admin() OR
    teacher_id = public.get_current_teacher_id()
  );

-- ------------------------------------------------------------------------------
-- 6. Row Level Security: public.attendance_otp_attempts
-- ------------------------------------------------------------------------------

ALTER TABLE public.attendance_otp_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to attendance_otp_attempts" ON public.attendance_otp_attempts;
CREATE POLICY "Admins have full access to attendance_otp_attempts"
  ON public.attendance_otp_attempts FOR ALL TO authenticated
  USING (public.is_campusos_admin())
  WITH CHECK (public.is_campusos_admin());

DROP POLICY IF EXISTS "Teachers can view attempts for own sessions" ON public.attendance_otp_attempts;
CREATE POLICY "Teachers can view attempts for own sessions"
  ON public.attendance_otp_attempts FOR SELECT TO authenticated
  USING (
    public.is_campusos_admin() OR
    session_id IN (
      SELECT id FROM public.attendance_sessions
      WHERE teacher_id = public.get_current_teacher_id()
    )
  );

-- ------------------------------------------------------------------------------
-- 7. Updated Row Level Security: public.attendance
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins have full access to attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers and admins can manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "Students can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers can manage assigned attendance" ON public.attendance;

-- A. Administrators retain institution-wide full access
CREATE POLICY "Admins have full access to attendance"
  ON public.attendance FOR ALL TO authenticated
  USING (public.is_campusos_admin())
  WITH CHECK (public.is_campusos_admin());

-- B. Teachers can view attendance records for their assigned courses/subjects or sessions
CREATE POLICY "Teachers can view assigned attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (
    public.is_campusos_admin() OR
    session_id IN (
      SELECT id FROM public.attendance_sessions
      WHERE teacher_id = public.get_current_teacher_id()
    ) OR
    subject_id IN (
      SELECT subject_id FROM public.teacher_subject_assignments
      WHERE teacher_id = public.get_current_teacher_id()
    )
  );

-- C. Teachers can insert/update attendance for their assigned sessions or subjects
CREATE POLICY "Teachers can manage assigned attendance"
  ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (
    public.is_campusos_admin() OR
    session_id IN (
      SELECT id FROM public.attendance_sessions
      WHERE teacher_id = public.get_current_teacher_id()
    ) OR
    subject_id IN (
      SELECT subject_id FROM public.teacher_subject_assignments
      WHERE teacher_id = public.get_current_teacher_id()
    )
  );

CREATE POLICY "Teachers can update assigned attendance"
  ON public.attendance FOR UPDATE TO authenticated
  USING (
    public.is_campusos_admin() OR
    session_id IN (
      SELECT id FROM public.attendance_sessions
      WHERE teacher_id = public.get_current_teacher_id()
    ) OR
    subject_id IN (
      SELECT subject_id FROM public.teacher_subject_assignments
      WHERE teacher_id = public.get_current_teacher_id()
    )
  )
  WITH CHECK (
    public.is_campusos_admin() OR
    session_id IN (
      SELECT id FROM public.attendance_sessions
      WHERE teacher_id = public.get_current_teacher_id()
    ) OR
    subject_id IN (
      SELECT subject_id FROM public.teacher_subject_assignments
      WHERE teacher_id = public.get_current_teacher_id()
    )
  );

-- D. Students can view ONLY their own attendance records
CREATE POLICY "Students can view own attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()) OR
    public.is_campusos_admin() OR
    public.is_campusos_teacher()
  );

COMMIT;
