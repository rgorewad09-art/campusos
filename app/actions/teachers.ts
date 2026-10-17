'use server';

import { headers } from 'next/headers';
import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { logAuditAction } from '@/src/lib/audit';
import {
  isValidUuid,
  sanitizePostgrestSearch,
  isAuthError,
  getPublicAppUrl,
  buildActivationLink,
} from '@/src/lib/security';
import type {
  Teacher,
  TeacherFormData,
  GetTeachersOptions,
  TeachersListResponse,
} from '@/src/types/teacher';
import type { TeacherSubjectAssignment, TimetableEntry } from '@/src/types/academic';
import type { Student } from '@/src/types/student';

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

  const { data: profile, error: profileError } = await supabase
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
 * Server-side authorization check for Teacher or Administrator.
 */
async function requireTeacherOrAdmin() {
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

  let { data: profile } = await dbClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || (profile.role !== 'teacher' && profile.role !== 'admin')) {
    // Try self-healing teacher profile
    if (user.email && adminClient) {
      const cleanEmail = user.email.trim().toLowerCase();
      const { data: teacher } = await adminClient
        .from('teachers')
        .select('*')
        .ilike('email', cleanEmail)
        .neq('status', 'suspended')
        .maybeSingle();

      if (teacher) {
        if (!teacher.user_id) {
          await adminClient
            .from('teachers')
            .update({ user_id: user.id })
            .eq('id', teacher.id);
        }
        await adminClient.from('profiles').upsert({
          id: user.id,
          display_name: `${teacher.first_name} ${teacher.last_name}`.trim(),
          role: 'teacher',
        });
        profile = { role: 'teacher' };
      }
    }
  }

  if (!profile || (profile.role !== 'teacher' && profile.role !== 'admin')) {
    throw new Error('Forbidden: Access is restricted to faculty members.');
  }

  return { supabase, user, role: profile.role as 'teacher' | 'admin' };
}

/**
 * Validates teacher form data.
 */
function validateTeacherData(data: TeacherFormData): { valid: boolean; error?: string } {
  if (!data.first_name || data.first_name.trim().length === 0) {
    return { valid: false, error: 'First name is required.' };
  }
  if (!data.last_name || data.last_name.trim().length === 0) {
    return { valid: false, error: 'Last name is required.' };
  }
  if (!data.email || data.email.trim().length === 0) {
    return { valid: false, error: 'Email address is required.' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email.trim())) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  return { valid: true };
}

/**
 * Fetch paginated teachers with optional search and status filtering.
 */
export async function getTeachersAction(
  options: GetTeachersOptions = {}
): Promise<{ success: boolean; data?: TeachersListResponse; error?: string }> {
  try {
    const { supabase } = await requireAdmin();

    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(50, Math.max(1, options.pageSize || 10));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('teachers')
      .select('*', { count: 'exact' });

    if (options.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }

    if (options.department && options.department !== 'all') {
      query = query.eq('department', options.department);
    }

    if (options.search && options.search.trim().length > 0) {
      const cleanSearch = sanitizePostgrestSearch(options.search);
      if (cleanSearch.length > 0) {
        query = query.or(
          `teacher_code.ilike.%${cleanSearch}%,first_name.ilike.%${cleanSearch}%,last_name.ilike.%${cleanSearch}%,email.ilike.%${cleanSearch}%`
        );
      }
    }

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error('[CampusOS Teachers] getTeachersAction query error:', error);
      return { success: false, error: 'Failed to retrieve teachers.' };
    }

    const totalCount = count ?? 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      success: true,
      data: {
        teachers: (data as Teacher[]) || [],
        totalCount,
        page,
        pageSize,
        totalPages,
      },
    };
  } catch (err: unknown) {
    console.error('[CampusOS Teachers] getTeachersAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to retrieve teachers.';
    return { success: false, error: message };
  }
}

/**
 * Fetch a single teacher by ID with their subject assignments.
 */
export async function getTeacherByIdAction(
  id: string
): Promise<{
  success: boolean;
  teacher?: Teacher;
  assignments?: TeacherSubjectAssignment[];
  error?: string;
}> {
  try {
    const { supabase } = await requireAdmin();

    if (!isValidUuid(id)) {
      return { success: false, error: 'Invalid teacher ID format.' };
    }

    const { data: teacher, error } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !teacher) {
      return { success: false, error: 'Teacher not found.' };
    }

    // Try fetching subject assignments if table exists
    let assignments: TeacherSubjectAssignment[] = [];
    try {
      const { data: assData } = await supabase
        .from('teacher_subject_assignments')
        .select(`
          *,
          course:courses(*),
          subject:subjects(*)
        `)
        .eq('teacher_id', id);

      if (assData) {
        assignments = assData as TeacherSubjectAssignment[];
      }
    } catch {
      // Table may not yet be initialized in Supabase
    }

    return { success: true, teacher: teacher as Teacher, assignments };
  } catch (err: unknown) {
    console.error('[CampusOS Teachers] getTeacherByIdAction error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to retrieve teacher.';
    return { success: false, error: message };
  }
}

/**
 * Create a new teacher record and send an activation invitation email.
 */
export async function createTeacherAction(
  formData: TeacherFormData
): Promise<{
  success: boolean;
  teacher?: Teacher;
  invitationSent?: boolean;
  activationLink?: string;
  error?: string;
}> {
  try {
    const { supabase, user } = await requireAdmin();

    const validation = validateTeacherData(formData);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const cleanEmail = formData.email.trim().toLowerCase();

    // Check duplicate email
    const { data: existingTeacher } = await supabase
      .from('teachers')
      .select('id, teacher_code')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existingTeacher) {
      return {
        success: false,
        error: `A teacher with email "${cleanEmail}" is already registered (Teacher ID: ${existingTeacher.teacher_code}).`,
      };
    }

    const payload = {
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      email: cleanEmail,
      phone: formData.phone?.trim() || null,
      department: formData.department?.trim() || 'General',
      status: formData.status || 'active',
      created_by: user.id,
    };

    const { data, error } = await supabase
      .from('teachers')
      .insert(payload)
      .select()
      .single();

    if (error || !data) {
      console.error('[CampusOS Teachers] createTeacherAction insert error:', error);
      return {
        success: false,
        error: 'Failed to create teacher record. Please verify fields and try again.',
      };
    }

    const createdTeacher = data as Teacher;
    let inviteSent = false;
    let activationLink: string | undefined;

    // Send invitation email via Supabase Auth Admin
    const adminClient = createAdminClient();
    if (adminClient) {
      try {
        const headerList = await headers();
        const origin = getPublicAppUrl(headerList);
        const redirectTo = `${origin}/auth/confirm?next=/activate/password&role=teacher`;

        const { data: inviteData, error: inviteError } =
          await adminClient.auth.admin.inviteUserByEmail(cleanEmail, {
            data: {
              teacher_id: createdTeacher.id,
              teacher_code: createdTeacher.teacher_code,
              role: 'teacher',
            },
            redirectTo,
          });

        if (inviteError) {
          console.warn('[CampusOS Teachers] Invite notice:', inviteError.message);
          let { data: linkData } = await adminClient.auth.admin.generateLink({
            type: 'invite',
            email: cleanEmail,
            options: {
              data: {
                teacher_id: createdTeacher.id,
                teacher_code: createdTeacher.teacher_code,
                role: 'teacher',
              },
              redirectTo,
            },
          });

          if (!linkData?.properties) {
            const { data: recData } = await adminClient.auth.admin.generateLink({
              type: 'recovery',
              email: cleanEmail,
              options: { redirectTo },
            });
            linkData = recData;
          }

          if (linkData?.properties) {
            activationLink = buildActivationLink(origin, linkData.properties, 'teacher');
            inviteSent = true;
            if (linkData.user) {
              await adminClient
                .from('teachers')
                .update({ user_id: linkData.user.id })
                .eq('id', createdTeacher.id);

              const teacherDisplayName = `${createdTeacher.first_name} ${createdTeacher.last_name}`.trim();
              await adminClient.from('profiles').upsert({
                id: linkData.user.id,
                display_name: teacherDisplayName || 'Teacher',
                role: 'teacher',
              });
            }
          }
        } else if (inviteData?.user) {
          inviteSent = true;
          // Link user_id in public.teachers and public.profiles
          await adminClient
            .from('teachers')
            .update({ user_id: inviteData.user.id })
            .eq('id', createdTeacher.id);

          const teacherDisplayName = `${createdTeacher.first_name} ${createdTeacher.last_name}`.trim();
          await adminClient.from('profiles').upsert({
            id: inviteData.user.id,
            display_name: teacherDisplayName || 'Teacher',
            role: 'teacher',
          });

          // Provide direct activation link for immediate copying and verification
          const { data: devLink } = await adminClient.auth.admin.generateLink({
            type: 'recovery',
            email: cleanEmail,
            options: { redirectTo },
          });
          if (devLink?.properties) {
            activationLink = buildActivationLink(origin, devLink.properties, 'teacher');
          }
        }
      } catch (inviteErr) {
        console.warn('[CampusOS Teachers] Invite dispatch error:', inviteErr);
      }
    }

    await logAuditAction({
      action: 'TEACHER_CREATE',
      actorId: user.id,
      entityType: 'teacher',
      entityId: createdTeacher.id,
      details: {
        teacher_code: createdTeacher.teacher_code,
        email: createdTeacher.email,
        department: createdTeacher.department,
        invitationSent: inviteSent,
      },
    });

    return {
      success: true,
      teacher: createdTeacher,
      invitationSent: inviteSent,
      activationLink,
    };
  } catch (err: unknown) {
    console.error('[CampusOS Teachers] createTeacherAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to create teacher.';
    return { success: false, error: message };
  }
}

/**
 * Update teacher details.
 */
export async function updateTeacherAction(
  id: string,
  formData: Partial<TeacherFormData>
): Promise<{ success: boolean; teacher?: Teacher; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    if (!isValidUuid(id)) {
      return { success: false, error: 'Invalid teacher ID format.' };
    }

    const updates: Record<string, unknown> = {};
    if (formData.first_name !== undefined) updates.first_name = formData.first_name.trim();
    if (formData.last_name !== undefined) updates.last_name = formData.last_name.trim();
    if (formData.phone !== undefined) updates.phone = formData.phone?.trim() || null;
    if (formData.department !== undefined) updates.department = formData.department.trim();
    if (formData.status !== undefined) updates.status = formData.status;

    const { data, error } = await supabase
      .from('teachers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      console.error('[CampusOS Teachers] updateTeacherAction error:', error);
      return { success: false, error: 'Failed to update teacher record.' };
    }

    await logAuditAction({
      action: 'TEACHER_UPDATE',
      actorId: user.id,
      entityType: 'teacher',
      entityId: id,
      details: updates,
    });

    return { success: true, teacher: data as Teacher };
  } catch (err: unknown) {
    console.error('[CampusOS Teachers] updateTeacherAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to update teacher.';
    return { success: false, error: message };
  }
}

/**
 * Assign a teacher to a course, subject, semester, and section.
 */
export async function assignTeacherSubjectAction(data: {
  teacher_id: string;
  course_id: string;
  subject_id: string;
  semester: number;
  section: string;
  academic_term: string;
}): Promise<{ success: boolean; assignment?: TeacherSubjectAssignment; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    if (!isValidUuid(data.teacher_id) || !isValidUuid(data.course_id) || !isValidUuid(data.subject_id)) {
      return { success: false, error: 'Invalid assignment parameters.' };
    }

    const payload = {
      teacher_id: data.teacher_id,
      course_id: data.course_id,
      subject_id: data.subject_id,
      semester: data.semester,
      section: data.section.trim().toUpperCase(),
      academic_term: data.academic_term.trim(),
      assigned_by: user.id,
    };

    const { data: assignment, error } = await supabase
      .from('teacher_subject_assignments')
      .insert(payload)
      .select(`
        *,
        course:courses(*),
        subject:subjects(*)
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          error: 'This teacher is already assigned to this subject, section, and term.',
        };
      }
      if (error.code === '42P01') {
        return {
          success: false,
          error: 'Academic Management tables not yet initialized. Please apply Migration 006.',
        };
      }
      console.error('[CampusOS Teachers] assignTeacherSubjectAction error:', error);
      return { success: false, error: 'Failed to assign teacher.' };
    }

    await logAuditAction({
      action: 'TEACHER_ASSIGN',
      actorId: user.id,
      entityType: 'teacher_assignment',
      entityId: data.teacher_id,
      details: payload,
    });

    return { success: true, assignment: assignment as TeacherSubjectAssignment };
  } catch (err: unknown) {
    console.error('[CampusOS Teachers] assignTeacherSubjectAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to assign teacher.';
    return { success: false, error: message };
  }
}

/**
 * Remove a teacher subject assignment.
 */
export async function removeTeacherSubjectAssignmentAction(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    if (!isValidUuid(assignmentId)) {
      return { success: false, error: 'Invalid assignment ID format.' };
    }

    const { error } = await supabase
      .from('teacher_subject_assignments')
      .delete()
      .eq('id', assignmentId);

    if (error) {
      return { success: false, error: 'Failed to remove teacher assignment.' };
    }

    await logAuditAction({
      action: 'TEACHER_UNASSIGN',
      actorId: user.id,
      entityType: 'teacher_assignment',
      entityId: assignmentId,
      details: { assignmentId },
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('[CampusOS Teachers] removeTeacherSubjectAssignmentAction error:', err);
    return { success: false, error: 'Failed to remove assignment.' };
  }
}

/**
 * Resends the account activation invitation for an existing teacher.
 * Uses the server-only admin client to dispatch via Supabase Auth Admin.
 * Returns the direct activation link for safe testing and instant copying.
 */
export async function resendTeacherInviteAction(teacherId: string): Promise<{
  success: boolean;
  message?: string;
  activationLink?: string;
  error?: string;
}> {
  try {
    const { supabase, user } = await requireAdmin();

    const adminClient = createAdminClient();
    if (!adminClient) {
      return {
        success: false,
        error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not configured.',
      };
    }

    if (!isValidUuid(teacherId)) {
      return { success: false, error: 'Invalid teacher ID format.' };
    }

    // 1. Fetch teacher record
    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('id, teacher_code, first_name, last_name, email, status, user_id')
      .eq('id', teacherId)
      .maybeSingle();

    if (teacherError || !teacher) {
      return { success: false, error: 'Teacher record not found.' };
    }

    if (!teacher.email) {
      return {
        success: false,
        error: 'This teacher does not have an email address on file.',
      };
    }

    if (teacher.status === 'suspended') {
      return {
        success: false,
        error: 'Cannot dispatch activation for a suspended teacher.',
      };
    }

    const headerList = await headers();
    const origin = getPublicAppUrl(headerList);
    const redirectTo = `${origin}/auth/confirm?next=/activate/password&role=teacher`;
    const cleanEmail = teacher.email.trim().toLowerCase();

    let activationLink: string | undefined;
    let inviteSent = false;

    // Check if the user already exists in auth.users
    if (teacher.user_id) {
      // User exists in auth.users -> generate recovery for password setup
      const { data: linkData, error: linkError } =
        await adminClient.auth.admin.generateLink({
          type: 'recovery',
          email: cleanEmail,
          options: { redirectTo },
        });

      if (!linkError && linkData?.properties) {
        activationLink = buildActivationLink(origin, linkData.properties, 'teacher');
        inviteSent = true;
      }
    } else {
      // User does not exist in auth.users -> generate invite
      const { data: inviteData, error: inviteError } =
        await adminClient.auth.admin.inviteUserByEmail(cleanEmail, {
          data: {
            teacher_id: teacher.id,
            teacher_code: teacher.teacher_code,
            role: 'teacher',
          },
          redirectTo,
        });

      if (!inviteError && inviteData?.user) {
        inviteSent = true;
        // Link user_id
        await adminClient
          .from('teachers')
          .update({ user_id: inviteData.user.id })
          .eq('id', teacher.id);

        const teacherDisplayName = `${teacher.first_name} ${teacher.last_name}`.trim();
        await adminClient.from('profiles').upsert({
          id: inviteData.user.id,
          display_name: teacherDisplayName || 'Teacher',
          role: 'teacher',
        });

        // Generate direct activation link
        const { data: devLink } = await adminClient.auth.admin.generateLink({
          type: 'recovery',
          email: cleanEmail,
          options: { redirectTo },
        });
        if (devLink?.properties) {
          activationLink = buildActivationLink(origin, devLink.properties, 'teacher');
        }
      } else {
        // Fallback: inviteUserByEmail might fail due to rate limits or existing auth user
        let { data: linkData } = await adminClient.auth.admin.generateLink({
          type: 'invite',
          email: cleanEmail,
          options: {
            data: {
              teacher_id: teacher.id,
              teacher_code: teacher.teacher_code,
              role: 'teacher',
            },
            redirectTo,
          },
        });
        if (!linkData?.properties) {
          const { data: recData } = await adminClient.auth.admin.generateLink({
            type: 'recovery',
            email: cleanEmail,
            options: { redirectTo },
          });
          linkData = recData;
        }
        if (linkData?.properties) {
          activationLink = buildActivationLink(origin, linkData.properties, 'teacher');
          inviteSent = true;
          if (linkData.user) {
            await adminClient
              .from('teachers')
              .update({ user_id: linkData.user.id })
              .eq('id', teacher.id);

            const teacherDisplayName = `${teacher.first_name} ${teacher.last_name}`.trim();
            await adminClient.from('profiles').upsert({
              id: linkData.user.id,
              display_name: teacherDisplayName || 'Teacher',
              role: 'teacher',
            });
          }
        }
      }
    }

    await logAuditAction({
      action: 'TEACHER_INVITE_RESENT',
      actorId: user.id,
      entityType: 'teacher',
      entityId: teacher.id,
      details: {
        teacher_code: teacher.teacher_code,
        email: cleanEmail,
        inviteSent,
      },
    });

    return {
      success: true,
      message: inviteSent
        ? `Activation invitation dispatched to ${cleanEmail}.`
        : 'Activation link generated.',
      activationLink,
    };
  } catch (err: unknown) {
    console.error('[CampusOS Teachers] resendTeacherInviteAction error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to resend teacher invitation.';
    return { success: false, error: message };
  }
}

/**
 * Fetch real faculty dashboard data for the authenticated teacher:
 * - Teacher profile
 * - Assigned courses & subjects
 * - Weekly timetable schedule
 * - Today's classes
 * - Student roster for assigned sections
 */
export async function getTeacherPortalDataAction(): Promise<{
  success: boolean;
  data?: {
    teacher: Teacher;
    assignments: TeacherSubjectAssignment[];
    timetable: TimetableEntry[];
    todayClasses: TimetableEntry[];
    rosterStudents: Student[];
  };
  error?: string;
}> {
  try {
    const { supabase, user } = await requireTeacherOrAdmin();
    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;

    // 1. Locate teacher record
    let { data: teacher } = await dbClient
      .from('teachers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!teacher && user.email) {
      const cleanEmail = user.email.trim().toLowerCase();
      const { data: matchedTeacher } = await dbClient
        .from('teachers')
        .select('*')
        .ilike('email', cleanEmail)
        .neq('status', 'suspended')
        .maybeSingle();

      if (matchedTeacher) {
        if (adminClient && !matchedTeacher.user_id) {
          await adminClient
            .from('teachers')
            .update({ user_id: user.id })
            .eq('id', matchedTeacher.id);
        }
        teacher = { ...matchedTeacher, user_id: user.id };
      }
    }

    if (!teacher) {
      return {
        success: false,
        error: 'Teacher profile could not be found. Please contact administration.',
      };
    }

    // 2. Fetch assignments & timetable concurrently in parallel
    let assignments: TeacherSubjectAssignment[] = [];
    let timetable: TimetableEntry[] = [];

    const [assRes, ttRes] = await Promise.all([
      dbClient
        .from('teacher_subject_assignments')
        .select(`
          *,
          course:courses(*),
          subject:subjects(*)
        `)
        .eq('teacher_id', teacher.id),
      dbClient
        .from('timetables')
        .select(`
          *,
          course:courses(*),
          subject:subjects(*)
        `)
        .eq('teacher_id', teacher.id)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true }),
    ]);

    if (assRes.data) {
      assignments = assRes.data as TeacherSubjectAssignment[];
    }
    if (ttRes.data) {
      timetable = ttRes.data as TimetableEntry[];
    }

    // 4. Calculate today's classes
    // JS getDay(): 0 is Sunday, 1 is Monday, ..., 6 is Saturday.
    // In our model: 1 is Mon, 2 is Tue, ..., 7 is Sun.
    const jsDay = new Date().getDay();
    const todayDayOfWeek = jsDay === 0 ? 7 : jsDay;
    const todayClasses = timetable.filter((t) => t.day_of_week === todayDayOfWeek);

    // 5. Fetch student roster for assigned sections & courses (from assignments AND timetable)
    let rosterStudents: Student[] = [];
    const assignedCourseIds = Array.from(
      new Set([
        ...assignments.map((a) => a.course_id),
        ...timetable.map((t) => t.course_id),
      ].filter(Boolean))
    );
    const assignedSections = Array.from(
      new Set([
        ...assignments.map((a) => a.section),
        ...timetable.map((t) => t.section),
      ].filter(Boolean))
    );

    if (assignedCourseIds.length > 0 && assignedSections.length > 0) {
      try {
        const { data: enrollments } = await dbClient
          .from('student_academic_enrollments')
          .select(`
            student:students(*)
          `)
          .in('course_id', assignedCourseIds)
          .in('section', assignedSections)
          .eq('status', 'approved');

        if (enrollments) {
          const studentMap = new Map<string, Student>();
          for (const item of enrollments) {
            const stu = (item as any).student as Student | undefined;
            if (stu && !studentMap.has(stu.id)) {
              studentMap.set(stu.id, stu);
            }
          }
          rosterStudents = Array.from(studentMap.values());
        }
      } catch {
        // Table may not yet exist
      }
    }

    return {
      success: true,
      data: {
        teacher: teacher as Teacher,
        assignments,
        timetable,
        todayClasses,
        rosterStudents,
      },
    };
  } catch (err: unknown) {
    console.error('[CampusOS Teachers] getTeacherPortalDataAction error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to retrieve teacher portal data.';
    return { success: false, error: message };
  }
}
