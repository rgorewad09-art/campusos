-- ==============================================================================
-- Migration: 006_academic_management.sql
-- Description:
--   Complete Academic Management System Schema for CampusOS:
--   1. public.courses - Academic programs (BCA, BBA, B.Com, B.Sc., etc.)
--   2. public.subjects - Academic subjects with credit allocations
--   3. public.course_subjects - Course-subject-semester curriculum mapping (mandatory/elective)
--   4. public.teacher_subject_assignments - Authorized teacher assignments by course, subject, semester, section, term
--   5. public.student_academic_enrollments - Student program, semester, section enrollment & approval tracking
--   6. public.student_selected_subjects - Enrolled student mandatory and approved elective selections
--   7. public.timetables - Institutional unified scheduling engine with conflict validation
--   8. Row Level Security (RLS) policies for Admin, Teacher, and Student access
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Table: public.courses (Academic Programs)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL CHECK (char_length(trim(code)) > 0),
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  department text NOT NULL DEFAULT 'General',
  duration_years integer NOT NULL DEFAULT 3 CHECK (duration_years > 0 AND duration_years <= 6),
  total_semesters integer NOT NULL DEFAULT 6 CHECK (total_semesters > 0 AND total_semesters <= 12),
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_courses_code_upper CHECK (code = upper(trim(code)))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_code_unique ON public.courses (upper(trim(code)));
CREATE INDEX IF NOT EXISTS idx_courses_department ON public.courses (department);
CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses (status);

-- ------------------------------------------------------------------------------
-- 2. Table: public.subjects (Academic Modules / Courses of Study)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL CHECK (char_length(trim(code)) > 0),
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  department text NOT NULL DEFAULT 'General',
  credits integer NOT NULL DEFAULT 4 CHECK (credits > 0 AND credits <= 12),
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_subjects_code_upper CHECK (code = upper(trim(code)))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_code_unique ON public.subjects (upper(trim(code)));
CREATE INDEX IF NOT EXISTS idx_subjects_department ON public.subjects (department);
CREATE INDEX IF NOT EXISTS idx_subjects_status ON public.subjects (status);

-- ------------------------------------------------------------------------------
-- 3. Table: public.course_subjects (Curriculum Mapping)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.course_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  semester integer NOT NULL CHECK (semester >= 1 AND semester <= 12),
  is_mandatory boolean NOT NULL DEFAULT true,
  elective_group text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_course_subject_sem UNIQUE (course_id, subject_id, semester)
);

CREATE INDEX IF NOT EXISTS idx_course_subjects_course ON public.course_subjects (course_id, semester);
CREATE INDEX IF NOT EXISTS idx_course_subjects_subject ON public.course_subjects (subject_id);

-- ------------------------------------------------------------------------------
-- 4. Table: public.teacher_subject_assignments (Faculty Allocations)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.teacher_subject_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  semester integer NOT NULL DEFAULT 1 CHECK (semester >= 1 AND semester <= 12),
  section text NOT NULL DEFAULT 'A' CHECK (char_length(trim(section)) > 0),
  academic_term text NOT NULL DEFAULT '2026-Fall',
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_teacher_sub_assignment UNIQUE (teacher_id, course_id, subject_id, semester, section, academic_term)
);

CREATE INDEX IF NOT EXISTS idx_teacher_sub_teacher ON public.teacher_subject_assignments (teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_sub_course ON public.teacher_subject_assignments (course_id, semester, section);
CREATE INDEX IF NOT EXISTS idx_teacher_sub_subject ON public.teacher_subject_assignments (subject_id);
CREATE INDEX IF NOT EXISTS idx_teacher_sub_term ON public.teacher_subject_assignments (academic_term);

-- ------------------------------------------------------------------------------
-- 5. Table: public.student_academic_enrollments (Student Program & Term Enrollment)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.student_academic_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  semester integer NOT NULL DEFAULT 1 CHECK (semester >= 1 AND semester <= 12),
  section text NOT NULL DEFAULT 'A' CHECK (char_length(trim(section)) > 0),
  academic_term text NOT NULL DEFAULT '2026-Fall',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  CONSTRAINT uq_student_term_enrollment UNIQUE (student_id, academic_term)
);

CREATE INDEX IF NOT EXISTS idx_stu_enrollment_student ON public.student_academic_enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_stu_enrollment_course ON public.student_academic_enrollments (course_id, semester, section);
CREATE INDEX IF NOT EXISTS idx_stu_enrollment_status ON public.student_academic_enrollments (status);

-- ------------------------------------------------------------------------------
-- 6. Table: public.student_selected_subjects (Course & Elective Choices)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.student_selected_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.student_academic_enrollments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  is_mandatory boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  selected_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_student_enrollment_subject UNIQUE (enrollment_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_stu_sel_sub_enrollment ON public.student_selected_subjects (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_stu_sel_sub_student ON public.student_selected_subjects (student_id);
CREATE INDEX IF NOT EXISTS idx_stu_sel_sub_subject ON public.student_selected_subjects (subject_id);

-- ------------------------------------------------------------------------------
-- 7. Table: public.timetables (Institutional Unified Schedule Engine)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.timetables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_term text NOT NULL DEFAULT '2026-Fall',
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  section text NOT NULL DEFAULT 'A' CHECK (char_length(trim(section)) > 0),
  semester integer NOT NULL DEFAULT 1 CHECK (semester >= 1 AND semester <= 12),
  day_of_week integer NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7), -- 1: Mon, 2: Tue, ..., 7: Sun
  start_time time NOT NULL,
  end_time time NOT NULL,
  room text NOT NULL DEFAULT 'Room 101',
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('proposed', 'approved', 'rejected')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_time_window CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_timetables_term ON public.timetables (academic_term);
CREATE INDEX IF NOT EXISTS idx_timetables_course_sem ON public.timetables (course_id, semester, section, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetables_teacher ON public.timetables (teacher_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetables_room ON public.timetables (room, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetables_status ON public.timetables (status);

-- ------------------------------------------------------------------------------
-- 8. Row Level Security Policies
-- ------------------------------------------------------------------------------

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_subject_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_academic_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_selected_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;

-- A. Courses Policies
DROP POLICY IF EXISTS "Admins have full access to courses" ON public.courses;
CREATE POLICY "Admins have full access to courses"
  ON public.courses FOR ALL TO authenticated
  USING (public.is_campusos_admin())
  WITH CHECK (public.is_campusos_admin());

DROP POLICY IF EXISTS "Authenticated users can view active courses" ON public.courses;
CREATE POLICY "Authenticated users can view active courses"
  ON public.courses FOR SELECT TO authenticated
  USING (status = 'active' OR public.is_campusos_admin());

-- B. Subjects Policies
DROP POLICY IF EXISTS "Admins have full access to subjects" ON public.subjects;
CREATE POLICY "Admins have full access to subjects"
  ON public.subjects FOR ALL TO authenticated
  USING (public.is_campusos_admin())
  WITH CHECK (public.is_campusos_admin());

DROP POLICY IF EXISTS "Authenticated users can view active subjects" ON public.subjects;
CREATE POLICY "Authenticated users can view active subjects"
  ON public.subjects FOR SELECT TO authenticated
  USING (status = 'active' OR public.is_campusos_admin());

-- C. Course Subjects Policies
DROP POLICY IF EXISTS "Admins have full access to course_subjects" ON public.course_subjects;
CREATE POLICY "Admins have full access to course_subjects"
  ON public.course_subjects FOR ALL TO authenticated
  USING (public.is_campusos_admin())
  WITH CHECK (public.is_campusos_admin());

DROP POLICY IF EXISTS "Authenticated users can view course curriculum" ON public.course_subjects;
CREATE POLICY "Authenticated users can view course curriculum"
  ON public.course_subjects FOR SELECT TO authenticated
  USING (true);

-- D. Teacher Subject Assignments Policies
DROP POLICY IF EXISTS "Admins have full access to teacher_subject_assignments" ON public.teacher_subject_assignments;
CREATE POLICY "Admins have full access to teacher_subject_assignments"
  ON public.teacher_subject_assignments FOR ALL TO authenticated
  USING (public.is_campusos_admin())
  WITH CHECK (public.is_campusos_admin());

DROP POLICY IF EXISTS "Teachers can view own subject assignments" ON public.teacher_subject_assignments;
CREATE POLICY "Teachers can view own subject assignments"
  ON public.teacher_subject_assignments FOR SELECT TO authenticated
  USING (teacher_id = public.get_current_teacher_id() OR public.is_campusos_admin());

-- E. Student Academic Enrollments Policies
DROP POLICY IF EXISTS "Admins have full access to student_academic_enrollments" ON public.student_academic_enrollments;
CREATE POLICY "Admins have full access to student_academic_enrollments"
  ON public.student_academic_enrollments FOR ALL TO authenticated
  USING (public.is_campusos_admin())
  WITH CHECK (public.is_campusos_admin());

DROP POLICY IF EXISTS "Students can view own academic enrollments" ON public.student_academic_enrollments;
CREATE POLICY "Students can view own academic enrollments"
  ON public.student_academic_enrollments FOR SELECT TO authenticated
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()) OR
    public.is_campusos_admin() OR
    public.is_campusos_teacher()
  );

DROP POLICY IF EXISTS "Students can insert own pending enrollment" ON public.student_academic_enrollments;
CREATE POLICY "Students can insert own pending enrollment"
  ON public.student_academic_enrollments FOR INSERT TO authenticated
  WITH CHECK (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()) AND
    status = 'pending'
  );

-- F. Student Selected Subjects Policies
DROP POLICY IF EXISTS "Admins have full access to student_selected_subjects" ON public.student_selected_subjects;
CREATE POLICY "Admins have full access to student_selected_subjects"
  ON public.student_selected_subjects FOR ALL TO authenticated
  USING (public.is_campusos_admin())
  WITH CHECK (public.is_campusos_admin());

DROP POLICY IF EXISTS "Students can view own selected subjects" ON public.student_selected_subjects;
CREATE POLICY "Students can view own selected subjects"
  ON public.student_selected_subjects FOR SELECT TO authenticated
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()) OR
    public.is_campusos_admin() OR
    public.is_campusos_teacher()
  );

DROP POLICY IF EXISTS "Students can insert own selected subjects" ON public.student_selected_subjects;
CREATE POLICY "Students can insert own selected subjects"
  ON public.student_selected_subjects FOR INSERT TO authenticated
  WITH CHECK (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

-- G. Timetables Policies
DROP POLICY IF EXISTS "Admins have full access to timetables" ON public.timetables;
CREATE POLICY "Admins have full access to timetables"
  ON public.timetables FOR ALL TO authenticated
  USING (public.is_campusos_admin())
  WITH CHECK (public.is_campusos_admin());

DROP POLICY IF EXISTS "Authenticated users can view approved timetables or own schedules" ON public.timetables;
DROP POLICY IF EXISTS "Teachers can view own or approved timetables" ON public.timetables;
CREATE POLICY "Authenticated users can view approved timetables or own schedules"
  ON public.timetables FOR SELECT TO authenticated
  USING (
    public.is_campusos_admin() OR
    teacher_id = public.get_current_teacher_id() OR
    status = 'approved'
  );

DROP POLICY IF EXISTS "Teachers can propose schedule entries" ON public.timetables;
CREATE POLICY "Teachers can propose schedule entries"
  ON public.timetables FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = public.get_current_teacher_id() AND
    status = 'proposed'
  );

DROP POLICY IF EXISTS "Teachers can update own proposed schedule entries" ON public.timetables;
CREATE POLICY "Teachers can update own proposed schedule entries"
  ON public.timetables FOR UPDATE TO authenticated
  USING (
    teacher_id = public.get_current_teacher_id() AND
    status = 'proposed'
  )
  WITH CHECK (
    teacher_id = public.get_current_teacher_id() AND
    status = 'proposed'
  );

COMMIT;
