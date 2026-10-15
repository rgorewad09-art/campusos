'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { logAuditAction } from '@/src/lib/audit';
import { isValidUuid, isAuthError } from '@/src/lib/security';
import type {
  Course,
  CourseFormData,
  Subject,
  SubjectFormData,
  CourseSubject,
  TeacherSubjectAssignment,
  StudentAcademicEnrollment,
  StudentSelectedSubject,
  TimetableEntry,
  TimetableFormData,
  TimetableConflict,
  EnrollmentStatus,
} from '@/src/types/academic';
import { DEFAULT_ACADEMIC_TERM } from '@/src/types/academic';

/**
 * Server-side authorization check for Administrators.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized: You must be signed in to perform this action.');
  }

  const adminClient = createAdminClient();
  const dbClient = adminClient || supabase;

  const { data: profile, error: profileError } = await dbClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== 'admin') {
    throw new Error('Forbidden: Only authorized administrators can perform this action.');
  }

  return { supabase, user };
}

/**
 * Server-side authorization check for Student.
 */
async function requireStudent() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized: Please sign in to access the Student Portal.');
  }

  const adminClient = createAdminClient();
  const dbClient = adminClient || supabase;

  let { data: student } = await dbClient
    .from('students')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!student && user.email) {
    const cleanEmail = user.email.trim().toLowerCase();
    const { data: matched } = await dbClient
      .from('students')
      .select('*')
      .ilike('email', cleanEmail)
      .neq('status', 'graduated')
      .maybeSingle();

    if (matched) {
      if (adminClient && !matched.user_id) {
        await adminClient
          .from('students')
          .update({ user_id: user.id })
          .eq('id', matched.id);
      }
      student = { ...matched, user_id: user.id };
    }
  }

  if (!student || student.status !== 'active') {
    throw new Error('Forbidden: Only authorized students can access this area.');
  }

  return { supabase, user, student };
}

/**
 * Server-side authorization check for Teacher.
 */
async function requireTeacher() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized: Please sign in to access the Faculty Portal.');
  }

  const adminClient = createAdminClient();
  const dbClient = adminClient || supabase;

  let { data: teacher } = await dbClient
    .from('teachers')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!teacher && user.email) {
    const cleanEmail = user.email.trim().toLowerCase();
    const { data: matched } = await dbClient
      .from('teachers')
      .select('*')
      .ilike('email', cleanEmail)
      .neq('status', 'suspended')
      .maybeSingle();

    if (matched) {
      if (adminClient && !matched.user_id) {
        await adminClient
          .from('teachers')
          .update({ user_id: user.id })
          .eq('id', matched.id);
      }
      teacher = { ...matched, user_id: user.id };
    }
  }

  if (!teacher || teacher.status !== 'active') {
    throw new Error('Forbidden: Only authorized teachers can access this area.');
  }

  return { supabase, user, teacher };
}

// =============================================================================
// 1. COURSE MANAGEMENT
// =============================================================================

export async function getCoursesAction(): Promise<{
  success: boolean;
  courses?: Course[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;

    const { data, error } = await dbClient
      .from('courses')
      .select('*, course_subjects(count)')
      .order('code', { ascending: true });

    if (error) {
      if (error.code === '42P01') {
        return {
          success: true,
          courses: [],
          error: 'Academic tables not yet initialized. Please apply Migration 006.',
        };
      }
      return { success: false, error: error.message };
    }

    const formatted: Course[] = (data || []).map((c: any) => ({
      ...c,
      subjects_count: c.course_subjects?.[0]?.count || 0,
    }));

    return { success: true, courses: formatted };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve courses.',
    };
  }
}

export async function getCourseByIdAction(id: string): Promise<{
  success: boolean;
  course?: Course;
  curriculum?: CourseSubject[];
  error?: string;
}> {
  try {
    if (!isValidUuid(id)) {
      return { success: false, error: 'Invalid course ID format.' };
    }

    const supabase = await createClient();
    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;

    const { data: course, error } = await dbClient
      .from('courses')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !course) {
      return { success: false, error: 'Course not found.' };
    }

    const { data: curriculum } = await dbClient
      .from('course_subjects')
      .select(`
        *,
        subject:subjects(*)
      `)
      .eq('course_id', id)
      .order('semester', { ascending: true });

    return {
      success: true,
      course: course as Course,
      curriculum: (curriculum as CourseSubject[]) || [],
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve course details.',
    };
  }
}

export async function createCourseAction(
  formData: CourseFormData
): Promise<{ success: boolean; course?: Course; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    const code = formData.code.trim().toUpperCase();
    const name = formData.name.trim();

    if (!code || !name) {
      return { success: false, error: 'Course code and name are required.' };
    }

    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;

    const payload = {
      code,
      name,
      department: formData.department.trim() || 'General',
      duration_years: Number(formData.duration_years) || 3,
      total_semesters: Number(formData.total_semesters) || 6,
      description: formData.description?.trim() || null,
      status: formData.status || 'active',
      created_by: user.id,
    };

    const { data, error } = await dbClient
      .from('courses')
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: `Course code "${code}" already exists.` };
      }
      if (error.code === '42P01') {
        return {
          success: false,
          error: 'Courses table not found. Please apply Migration 006 in Supabase.',
        };
      }
      return { success: false, error: error.message };
    }

    await logAuditAction({
      action: 'COURSE_CREATE',
      actorId: user.id,
      entityType: 'course',
      entityId: data.id,
      details: payload,
    });

    return { success: true, course: data as Course };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create course.',
    };
  }
}

export async function updateCourseAction(
  id: string,
  formData: Partial<CourseFormData>
): Promise<{ success: boolean; course?: Course; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    if (!isValidUuid(id)) {
      return { success: false, error: 'Invalid course ID format.' };
    }

    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (formData.code !== undefined) updates.code = formData.code.trim().toUpperCase();
    if (formData.name !== undefined) updates.name = formData.name.trim();
    if (formData.department !== undefined) updates.department = formData.department.trim();
    if (formData.duration_years !== undefined) updates.duration_years = Number(formData.duration_years);
    if (formData.total_semesters !== undefined) updates.total_semesters = Number(formData.total_semesters);
    if (formData.description !== undefined) updates.description = formData.description?.trim() || null;
    if (formData.status !== undefined) updates.status = formData.status;

    const { data, error } = await dbClient
      .from('courses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await logAuditAction({
      action: 'COURSE_UPDATE',
      actorId: user.id,
      entityType: 'course',
      entityId: id,
      details: updates,
    });

    return { success: true, course: data as Course };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update course.',
    };
  }
}

export async function archiveCourseAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    if (!isValidUuid(id)) {
      return { success: false, error: 'Invalid course ID format.' };
    }

    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;

    const { data: current } = await dbClient
      .from('courses')
      .select('status')
      .eq('id', id)
      .single();

    const newStatus = current?.status === 'archived' ? 'active' : 'archived';

    const { error } = await dbClient
      .from('courses')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    await logAuditAction({
      action: 'COURSE_STATUS_CHANGE',
      actorId: user.id,
      entityType: 'course',
      entityId: id,
      details: { status: newStatus },
    });

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update course status.',
    };
  }
}

// =============================================================================
// 2. SUBJECT MANAGEMENT
// =============================================================================

export async function getSubjectsAction(): Promise<{
  success: boolean;
  subjects?: Subject[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;

    const { data, error } = await dbClient
      .from('subjects')
      .select('*')
      .order('code', { ascending: true });

    if (error) {
      if (error.code === '42P01') {
        return {
          success: true,
          subjects: [],
          error: 'Subjects table not yet initialized. Please apply Migration 006.',
        };
      }
      return { success: false, error: error.message };
    }

    return { success: true, subjects: (data as Subject[]) || [] };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve subjects.',
    };
  }
}

export async function createSubjectAction(
  formData: SubjectFormData
): Promise<{ success: boolean; subject?: Subject; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    const code = formData.code.trim().toUpperCase();
    const name = formData.name.trim();

    if (!code || !name) {
      return { success: false, error: 'Subject code and name are required.' };
    }

    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;

    const payload = {
      code,
      name,
      department: formData.department.trim() || 'General',
      credits: Number(formData.credits) || 4,
      description: formData.description?.trim() || null,
      status: formData.status || 'active',
      created_by: user.id,
    };

    const { data, error } = await dbClient
      .from('subjects')
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: `Subject code "${code}" already exists.` };
      }
      if (error.code === '42P01') {
        return {
          success: false,
          error: 'Subjects table not found. Please apply Migration 006 in Supabase.',
        };
      }
      return { success: false, error: error.message };
    }

    await logAuditAction({
      action: 'SUBJECT_CREATE',
      actorId: user.id,
      entityType: 'subject',
      entityId: data.id,
      details: payload,
    });

    return { success: true, subject: data as Subject };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create subject.',
    };
  }
}

export async function updateSubjectAction(
  id: string,
  formData: Partial<SubjectFormData>
): Promise<{ success: boolean; subject?: Subject; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    if (!isValidUuid(id)) {
      return { success: false, error: 'Invalid subject ID format.' };
    }

    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (formData.code !== undefined) updates.code = formData.code.trim().toUpperCase();
    if (formData.name !== undefined) updates.name = formData.name.trim();
    if (formData.department !== undefined) updates.department = formData.department.trim();
    if (formData.credits !== undefined) updates.credits = Number(formData.credits);
    if (formData.description !== undefined) updates.description = formData.description?.trim() || null;
    if (formData.status !== undefined) updates.status = formData.status;

    const { data, error } = await dbClient
      .from('subjects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await logAuditAction({
      action: 'SUBJECT_UPDATE',
      actorId: user.id,
      entityType: 'subject',
      entityId: id,
      details: updates,
    });

    return { success: true, subject: data as Subject };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update subject.',
    };
  }
}

// =============================================================================
// 3. CURRICULUM MAPPING (COURSE-SUBJECTS)
// =============================================================================

export async function addSubjectToCourseAction(data: {
  course_id: string;
  subject_id: string;
  semester: number;
  is_mandatory: boolean;
  elective_group?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    if (!isValidUuid(data.course_id) || !isValidUuid(data.subject_id)) {
      return { success: false, error: 'Invalid course or subject identifier.' };
    }

    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;

    const payload = {
      course_id: data.course_id,
      subject_id: data.subject_id,
      semester: Number(data.semester) || 1,
      is_mandatory: data.is_mandatory,
      elective_group: data.elective_group?.trim() || null,
    };

    const { error } = await dbClient
      .from('course_subjects')
      .insert(payload);

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          error: 'This subject is already attached to this course and semester.',
        };
      }
      return { success: false, error: error.message };
    }

    await logAuditAction({
      action: 'COURSE_SUBJECT_ADD',
      actorId: user.id,
      entityType: 'course_subject',
      entityId: data.course_id,
      details: payload,
    });

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add subject to curriculum.',
    };
  }
}

export async function removeSubjectFromCourseAction(
  courseSubjectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    if (!isValidUuid(courseSubjectId)) {
      return { success: false, error: 'Invalid curriculum entry ID.' };
    }

    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;

    const { error } = await dbClient
      .from('course_subjects')
      .delete()
      .eq('id', courseSubjectId);

    if (error) {
      return { success: false, error: error.message };
    }

    await logAuditAction({
      action: 'COURSE_SUBJECT_REMOVE',
      actorId: user.id,
      entityType: 'course_subject',
      entityId: courseSubjectId,
      details: { courseSubjectId },
    });

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove subject from curriculum.',
    };
  }
}

// =============================================================================
// 4. STUDENT ACADEMIC ONBOARDING & ENROLLMENT
// =============================================================================

export async function getStudentAcademicProfile(): Promise<{
  success: boolean;
  enrollment?: StudentAcademicEnrollment;
  selectedSubjects?: StudentSelectedSubject[];
  error?: string;
}> {
  try {
    const { student } = await requireStudent();
    const adminClient = createAdminClient();
    const dbClient = adminClient;

    if (!dbClient) {
      return { success: false, error: 'Database service unavailable.' };
    }

    const { data: enrollment, error } = await dbClient
      .from('student_academic_enrollments')
      .select(`
        *,
        course:courses(*)
      `)
      .eq('student_id', student.id)
      .order('enrolled_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01') {
        return { success: true, enrollment: undefined };
      }
      return { success: false, error: error.message };
    }

    if (!enrollment) {
      return { success: true, enrollment: undefined };
    }

    const { data: selectedSubjects } = await dbClient
      .from('student_selected_subjects')
      .select(`
        *,
        subject:subjects(*)
      `)
      .eq('enrollment_id', enrollment.id);

    return {
      success: true,
      enrollment: enrollment as StudentAcademicEnrollment,
      selectedSubjects: (selectedSubjects as StudentSelectedSubject[]) || [],
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve academic profile.',
    };
  }
}

export async function submitStudentEnrollmentAction(data: {
  course_id: string;
  semester: number;
  section?: string;
  elective_subject_ids?: string[];
  academic_term?: string;
}): Promise<{ success: boolean; enrollmentId?: string; error?: string }> {
  try {
    const { user, student } = await requireStudent();

    if (!isValidUuid(data.course_id)) {
      return { success: false, error: 'Please select a valid course.' };
    }

    const adminClient = createAdminClient();
    if (!adminClient) {
      return { success: false, error: 'Server database client unavailable.' };
    }

    const academicTerm = data.academic_term?.trim() || DEFAULT_ACADEMIC_TERM;
    const semester = Number(data.semester) || 1;
    const section = data.section?.trim().toUpperCase() || 'A';

    // 1. Check if enrollment already exists for this student & term
    const { data: existing } = await adminClient
      .from('student_academic_enrollments')
      .select('id, status')
      .eq('student_id', student.id)
      .eq('academic_term', academicTerm)
      .maybeSingle();

    if (existing && existing.status !== 'rejected') {
      return {
        success: false,
        error: `You already have an enrollment record (${existing.status}) for ${academicTerm}.`,
      };
    }

    // 2. Fetch mandatory and elective curriculum for this course & semester
    const { data: curriculum, error: currError } = await adminClient
      .from('course_subjects')
      .select('*')
      .eq('course_id', data.course_id)
      .eq('semester', semester);

    if (currError || !curriculum || curriculum.length === 0) {
      return {
        success: false,
        error: 'The selected course does not have a defined curriculum for this semester.',
      };
    }

    // Separate mandatory vs elective subjects
    const mandatorySubjects = curriculum.filter((c) => c.is_mandatory);
    const availableElectives = curriculum.filter((c) => !c.is_mandatory);

    const chosenElectiveIds = new Set(data.elective_subject_ids || []);
    // Validate that chosen electives actually belong to the curriculum
    for (const electId of chosenElectiveIds) {
      const exists = availableElectives.some((e) => e.subject_id === electId);
      if (!exists) {
        return {
          success: false,
          error: 'One or more selected elective subjects are not authorized for this semester.',
        };
      }
    }

    // 3. Insert student academic enrollment
    const enrollmentPayload = {
      student_id: student.id,
      course_id: data.course_id,
      semester,
      section,
      academic_term: academicTerm,
      status: 'pending' as EnrollmentStatus,
    };

    const { data: enrollment, error: enrollError } = await adminClient
      .from('student_academic_enrollments')
      .insert(enrollmentPayload)
      .select()
      .single();

    if (enrollError || !enrollment) {
      console.error('[CampusOS Academic] Enrollment insert error:', enrollError);
      return { success: false, error: 'Failed to record student enrollment.' };
    }

    // 4. Record mandatory subjects in student_selected_subjects
    const subjectEntries = [
      ...mandatorySubjects.map((m) => ({
        enrollment_id: enrollment.id,
        student_id: student.id,
        subject_id: m.subject_id,
        is_mandatory: true,
        status: 'approved',
      })),
      ...Array.from(chosenElectiveIds).map((electId) => ({
        enrollment_id: enrollment.id,
        student_id: student.id,
        subject_id: electId,
        is_mandatory: false,
        status: 'pending',
      })),
    ];

    if (subjectEntries.length > 0) {
      const { error: subError } = await adminClient
        .from('student_selected_subjects')
        .insert(subjectEntries);

      if (subError) {
        console.error('[CampusOS Academic] Subject selection insert error:', subError);
      }
    }

    await logAuditAction({
      action: 'STUDENT_ENROLLMENT_SUBMIT',
      actorId: user.id,
      entityType: 'student_enrollment',
      entityId: enrollment.id,
      details: {
        student_id: student.id,
        course_id: data.course_id,
        semester,
        section,
        subjectCount: subjectEntries.length,
      },
    });

    return { success: true, enrollmentId: enrollment.id };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to submit academic onboarding.',
    };
  }
}

export async function getEnrollmentsAction(): Promise<{
  success: boolean;
  enrollments?: StudentAcademicEnrollment[];
  error?: string;
}> {
  try {
    await requireAdmin();
    const adminClient = createAdminClient();
    if (!adminClient) {
      return { success: false, error: 'Database service unavailable.' };
    }

    const { data, error } = await adminClient
      .from('student_academic_enrollments')
      .select(`
        *,
        student:students(*),
        course:courses(*),
        selected_subjects:student_selected_subjects(
          *,
          subject:subjects(*)
        )
      `)
      .order('enrolled_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        return { success: true, enrollments: [] };
      }
      return { success: false, error: error.message };
    }

    return { success: true, enrollments: (data as StudentAcademicEnrollment[]) || [] };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve enrollments.',
    };
  }
}

export async function reviewEnrollmentAction(data: {
  enrollment_id: string;
  status: 'approved' | 'rejected';
  section?: string;
  rejection_reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await requireAdmin();

    if (!isValidUuid(data.enrollment_id)) {
      return { success: false, error: 'Invalid enrollment ID.' };
    }

    const adminClient = createAdminClient();
    if (!adminClient) {
      return { success: false, error: 'Database service unavailable.' };
    }

    const updates: Record<string, unknown> = {
      status: data.status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: data.rejection_reason?.trim() || null,
    };

    if (data.section) {
      updates.section = data.section.trim().toUpperCase();
    }

    const { error } = await adminClient
      .from('student_academic_enrollments')
      .update(updates)
      .eq('id', data.enrollment_id);

    if (error) {
      return { success: false, error: error.message };
    }

    // Also update student_selected_subjects status if approving
    if (data.status === 'approved') {
      await adminClient
        .from('student_selected_subjects')
        .update({ status: 'approved' })
        .eq('enrollment_id', data.enrollment_id);
    }

    await logAuditAction({
      action: 'ENROLLMENT_REVIEW',
      actorId: user.id,
      entityType: 'student_enrollment',
      entityId: data.enrollment_id,
      details: updates,
    });

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to review enrollment.',
    };
  }
}

// =============================================================================
// 5. TIMETABLE & CONFLICT ENGINE
// =============================================================================

/**
 * Validates timetable entries against scheduling conflicts:
 * 1. Teaching hours validation (07:00 - 20:00)
 * 2. Start time must precede End time
 * 3. Teacher collision: teacher already scheduled for another class at that time
 * 4. Section collision: section already scheduled for another subject at that time
 * 5. Room collision: room already booked by another class at that time
 */
export async function validateTimetableSlot(entry: {
  id?: string;
  academic_term: string;
  course_id: string;
  subject_id: string;
  teacher_id: string;
  section: string;
  semester: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
}): Promise<{ hasConflict: boolean; conflicts: TimetableConflict[] }> {
  const conflicts: TimetableConflict[] = [];

  // Normalize times to HH:mm (or HH:mm:ss)
  const start = entry.start_time.length === 5 ? `${entry.start_time}:00` : entry.start_time;
  const end = entry.end_time.length === 5 ? `${entry.end_time}:00` : entry.end_time;

  if (start >= end) {
    conflicts.push({
      type: 'hours_conflict',
      message: 'Start time must be strictly before end time.',
    });
    return { hasConflict: true, conflicts };
  }

  // Institutional teaching hours: 07:00 to 20:00
  if (start < '07:00:00' || end > '20:00:00') {
    conflicts.push({
      type: 'hours_conflict',
      message: 'Class timing must be within institutional hours (07:00 to 20:00).',
    });
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return { hasConflict: conflicts.length > 0, conflicts };
  }

  try {
    // Query active or approved/proposed schedules for the same term and day
    let query = adminClient
      .from('timetables')
      .select(`
        *,
        course:courses(code, name),
        subject:subjects(code, name),
        teacher:teachers(first_name, last_name)
      `)
      .eq('academic_term', entry.academic_term)
      .eq('day_of_week', entry.day_of_week)
      .neq('status', 'rejected');

    if (entry.id) {
      query = query.neq('id', entry.id);
    }

    const { data: existingSlots } = await query;

    if (existingSlots && existingSlots.length > 0) {
      for (const slot of existingSlots) {
        const slotStart = slot.start_time.length === 5 ? `${slot.start_time}:00` : slot.start_time;
        const slotEnd = slot.end_time.length === 5 ? `${slot.end_time}:00` : slot.end_time;

        // Overlap condition: start < slotEnd AND slotStart < end
        const isOverlap = start < slotEnd && slotStart < end;

        if (!isOverlap) continue;

        // 1. Teacher collision
        if (slot.teacher_id === entry.teacher_id) {
          const teacherName = slot.teacher
            ? `${slot.teacher.first_name} ${slot.teacher.last_name}`
            : 'Faculty member';
          conflicts.push({
            type: 'teacher_conflict',
            message: `${teacherName} is already scheduled for ${slot.subject?.name || 'another subject'} (${slot.start_time} - ${slot.end_time}) on this day.`,
            conflictingEntry: slot,
          });
        }

        // 2. Class section collision
        if (
          slot.course_id === entry.course_id &&
          slot.semester === entry.semester &&
          slot.section.toUpperCase() === entry.section.toUpperCase()
        ) {
          conflicts.push({
            type: 'section_conflict',
            message: `Section ${entry.section} (Sem ${entry.semester}) already has a scheduled class (${slot.subject?.name || 'Subject'}) at this time.`,
            conflictingEntry: slot,
          });
        }

        // 3. Room collision
        if (
          slot.room &&
          entry.room &&
          slot.room.trim().toLowerCase() === entry.room.trim().toLowerCase()
        ) {
          conflicts.push({
            type: 'room_conflict',
            message: `Room "${entry.room}" is already booked for ${slot.subject?.name || 'another class'} at this time.`,
            conflictingEntry: slot,
          });
        }
      }
    }
  } catch (checkErr) {
    console.warn('[CampusOS Academic] Conflict check warning:', checkErr);
  }

  return { hasConflict: conflicts.length > 0, conflicts };
}

export async function getTimetablesAction(filters?: {
  term?: string;
  course_id?: string;
  semester?: number;
  section?: string;
  teacher_id?: string;
  status?: string;
}): Promise<{ success: boolean; timetable?: TimetableEntry[]; error?: string }> {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;

    let query = dbClient
      .from('timetables')
      .select(`
        *,
        course:courses(*),
        subject:subjects(*),
        teacher:teachers(*)
      `)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (filters?.term) query = query.eq('academic_term', filters.term);
    if (filters?.course_id) query = query.eq('course_id', filters.course_id);
    if (filters?.semester) query = query.eq('semester', filters.semester);
    if (filters?.section) query = query.eq('section', filters.section.toUpperCase());
    if (filters?.teacher_id) query = query.eq('teacher_id', filters.teacher_id);
    if (filters?.status) query = query.eq('status', filters.status);

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        return { success: true, timetable: [] };
      }
      return { success: false, error: error.message };
    }

    return { success: true, timetable: (data as TimetableEntry[]) || [] };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve timetables.',
    };
  }
}

export async function createTimetableEntryAction(
  data: TimetableFormData,
  asTeacher: boolean = false
): Promise<{
  success: boolean;
  entry?: TimetableEntry;
  conflicts?: TimetableConflict[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;

    let creatorId: string | null = null;
    let initialStatus: 'approved' | 'proposed' = 'approved';

    if (asTeacher) {
      const { user, teacher } = await requireTeacher();
      creatorId = user.id;
      initialStatus = 'proposed';

      // Verify that this teacher is actually assigned to this subject/course/section
      if (adminClient) {
        const { data: assignment } = await adminClient
          .from('teacher_subject_assignments')
          .select('id')
          .eq('teacher_id', teacher.id)
          .eq('course_id', data.course_id)
          .eq('subject_id', data.subject_id)
          .eq('semester', data.semester)
          .eq('section', data.section.toUpperCase())
          .maybeSingle();

        if (!assignment) {
          return {
            success: false,
            error: 'You are not authorized to schedule classes for this subject/section. Please contact your administrator.',
          };
        }
      }
    } else {
      const { user } = await requireAdmin();
      creatorId = user.id;
      initialStatus = 'approved';
    }

    // Run strict server-side conflict checks
    const conflictResult = await validateTimetableSlot({
      academic_term: data.academic_term,
      course_id: data.course_id,
      subject_id: data.subject_id,
      teacher_id: data.teacher_id,
      section: data.section,
      semester: data.semester,
      day_of_week: data.day_of_week,
      start_time: data.start_time,
      end_time: data.end_time,
      room: data.room,
    });

    if (conflictResult.hasConflict) {
      return {
        success: false,
        conflicts: conflictResult.conflicts,
        error: conflictResult.conflicts.map((c) => c.message).join(' | '),
      };
    }

    const payload = {
      academic_term: data.academic_term.trim(),
      course_id: data.course_id,
      subject_id: data.subject_id,
      teacher_id: data.teacher_id,
      section: data.section.trim().toUpperCase(),
      semester: Number(data.semester),
      day_of_week: Number(data.day_of_week),
      start_time: data.start_time.length === 5 ? `${data.start_time}:00` : data.start_time,
      end_time: data.end_time.length === 5 ? `${data.end_time}:00` : data.end_time,
      room: data.room.trim(),
      status: initialStatus,
      created_by: creatorId,
      approved_by: initialStatus === 'approved' ? creatorId : null,
    };

    const { data: inserted, error } = await dbClient
      .from('timetables')
      .insert(payload)
      .select(`
        *,
        course:courses(*),
        subject:subjects(*),
        teacher:teachers(*)
      `)
      .single();

    if (error) {
      if (error.code === '42P01') {
        return {
          success: false,
          error: 'Timetables table not found. Please apply Migration 006.',
        };
      }
      return { success: false, error: error.message };
    }

    if (creatorId) {
      await logAuditAction({
        action: 'TIMETABLE_CREATE',
        actorId: creatorId,
        entityType: 'timetable',
        entityId: inserted.id,
        details: payload,
      });
    }

    return { success: true, entry: inserted as TimetableEntry };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create timetable slot.',
    };
  }
}

export async function reviewTimetableEntryAction(
  id: string,
  status: 'approved' | 'rejected'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await requireAdmin();

    if (!isValidUuid(id)) {
      return { success: false, error: 'Invalid timetable slot ID.' };
    }

    const adminClient = createAdminClient();
    if (!adminClient) {
      return { success: false, error: 'Database service unavailable.' };
    }

    const updates = {
      status,
      approved_by: status === 'approved' ? user.id : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await adminClient
      .from('timetables')
      .update(updates)
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    await logAuditAction({
      action: 'TIMETABLE_REVIEW',
      actorId: user.id,
      entityType: 'timetable',
      entityId: id,
      details: updates,
    });

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to review timetable slot.',
    };
  }
}

export async function deleteTimetableEntryAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized.' };
    }

    const { error } = await dbClient
      .from('timetables')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete timetable slot.',
    };
  }
}

/**
 * Personal timetable for authenticated student:
 * Matches approved course enrollment, semester, and section.
 */
export async function getStudentPersonalTimetableAction(): Promise<{
  success: boolean;
  timetable?: TimetableEntry[];
  error?: string;
}> {
  try {
    const { student } = await requireStudent();
    const adminClient = createAdminClient();
    if (!adminClient) {
      return { success: false, error: 'Database client unavailable.' };
    }

    // 1. Find approved enrollment
    const { data: enrollment } = await adminClient
      .from('student_academic_enrollments')
      .select('course_id, semester, section, academic_term, status')
      .eq('student_id', student.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (!enrollment) {
      return { success: true, timetable: [] };
    }

    // 2. Fetch approved timetable entries for this course, semester, section
    const { data: timetable, error } = await adminClient
      .from('timetables')
      .select(`
        *,
        course:courses(*),
        subject:subjects(*),
        teacher:teachers(*)
      `)
      .eq('course_id', enrollment.course_id)
      .eq('semester', enrollment.semester)
      .eq('section', enrollment.section)
      .eq('academic_term', enrollment.academic_term)
      .eq('status', 'approved')
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      if (error.code === '42P01') {
        return { success: true, timetable: [] };
      }
      return { success: false, error: error.message };
    }

    return { success: true, timetable: (timetable as TimetableEntry[]) || [] };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve personal schedule.',
    };
  }
}
