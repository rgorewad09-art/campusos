'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { logAuditAction } from '@/src/lib/audit';
import { isValidUuid, isAuthError } from '@/src/lib/security';
import {
  generateAttendanceOtp,
  hashAttendanceOtp,
  encryptAttendanceOtp,
  decryptAttendanceOtp,
} from '@/src/lib/otp';
import type { Teacher } from '@/src/types/teacher';
import type { TeacherSubjectAssignment, TimetableEntry } from '@/src/types/academic';
import type { Student } from '@/src/types/student';
import type {
  AttendanceSession,
  AttendanceRecord,
  AttendanceStatus,
  AttendanceRosterStudent,
} from '@/src/types/attendance';
import crypto from 'crypto';

/**
 * Server-side authorization check for faculty members or administrators.
 */
async function requireTeacherOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized: You must be signed in to access the faculty attendance portal.');
  }

  const adminClient = createAdminClient();
  const dbClient = adminClient || supabase;

  let { data: profile } = await dbClient
    .from('profiles')
    .select('id, role, display_name')
    .eq('id', user.id)
    .maybeSingle();

  // Self-heal: If profile row is missing or lacks role, check if user is a registered faculty member
  if ((!profile || !profile.role) && user.email && adminClient) {
    const cleanEmail = user.email.trim().toLowerCase();
    const { data: matchedT } = await adminClient
      .from('teachers')
      .select('id, user_id, first_name, last_name, status')
      .ilike('email', cleanEmail)
      .neq('status', 'suspended')
      .maybeSingle();

    if (matchedT) {
      if (!matchedT.user_id) {
        await adminClient
          .from('teachers')
          .update({ user_id: user.id })
          .eq('id', matchedT.id);
      }

      const displayName =
        [matchedT.first_name, matchedT.last_name].filter(Boolean).join(' ') || 'Teacher';

      await adminClient.from('profiles').upsert({
        id: user.id,
        display_name: displayName,
        role: 'teacher',
      });

      profile = { id: user.id, role: 'teacher', display_name: displayName };
    }
  }

  if (!profile || !['admin', 'teacher'].includes(profile.role)) {
    throw new Error('Forbidden: Only faculty members or administrators can perform attendance management.');
  }

  // Resolve teacher record
  let teacher: Teacher | null = null;
  if (profile.role === 'teacher') {
    let { data: tData } = await dbClient
      .from('teachers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tData && user.email) {
      const { data: matchedT } = await dbClient
        .from('teachers')
        .select('*')
        .ilike('email', user.email.trim())
        .maybeSingle();

      if (matchedT) {
        if (adminClient && !matchedT.user_id) {
          await adminClient
            .from('teachers')
            .update({ user_id: user.id })
            .eq('id', matchedT.id);
        }
        tData = { ...matchedT, user_id: user.id };
      }
    }

    teacher = tData as Teacher | null;
    if (!teacher) {
      throw new Error('Faculty profile record not found. Please contact your college administrator.');
    }
  }

  return { supabase, user, profile, teacher, adminClient: dbClient };
}

/**
 * Loads the complete context for a teacher's attendance portal:
 * - Teacher profile
 * - Assigned courses and subjects (from both direct assignments and timetable scheduling)
 * - Active / today's timetable sessions
 * - Currently active attendance sessions
 */
export async function getTeacherAttendanceContextAction(): Promise<{
  success: boolean;
  data?: {
    teacher: Teacher | null;
    assignments: TeacherSubjectAssignment[];
    timetables: TimetableEntry[];
    activeSessions: AttendanceSession[];
  };
  error?: string;
}> {
  try {
    const { teacher, user, profile, adminClient } = await requireTeacherOrAdmin();

    const teacherId = teacher?.id;
    let assignments: TeacherSubjectAssignment[] = [];
    let timetables: TimetableEntry[] = [];
    let activeSessions: AttendanceSession[] = [];

    // If teacher role, fetch their assignments from both direct subject assignments and timetable allocations
    if (teacherId) {
      const assignmentMap = new Map<string, TeacherSubjectAssignment>();

      // 1. Direct assignments
      const { data: assData } = await adminClient
        .from('teacher_subject_assignments')
        .select(`
          *,
          course:courses(*),
          subject:subjects(*)
        `)
        .eq('teacher_id', teacherId);

      if (assData) {
        (assData as TeacherSubjectAssignment[]).forEach((a) => {
          const sec = (a.section || 'A').trim().toUpperCase();
          const key = `${a.course_id}_${a.subject_id}_${a.semester}_${sec}`;
          assignmentMap.set(key, { ...a, section: sec });
        });
      }

      // 2. Timetable schedule allocations
      const { data: ttData } = await adminClient
        .from('timetables')
        .select(`
          *,
          course:courses(*),
          subject:subjects(*)
        `)
        .eq('teacher_id', teacherId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (ttData) {
        timetables = ttData as TimetableEntry[];
        timetables.forEach((tt) => {
          const sec = (tt.section || 'A').trim().toUpperCase();
          const key = `${tt.course_id}_${tt.subject_id}_${tt.semester}_${sec}`;
          if (!assignmentMap.has(key) && tt.course && tt.subject) {
            assignmentMap.set(key, {
              id: tt.id,
              teacher_id: teacherId,
              course_id: tt.course_id,
              subject_id: tt.subject_id,
              semester: tt.semester,
              section: sec,
              academic_term: tt.academic_term || '2026-Fall',
              assigned_by: tt.approved_by || user.id,
              assigned_at: tt.created_at,
              course: tt.course,
              subject: tt.subject,
            } as TeacherSubjectAssignment);
          }
        });
      }

      assignments = Array.from(assignmentMap.values());

      // Fetch active sessions from attendance_sessions table
      try {
        const nowIso = new Date().toISOString();
        const { data: sessData } = await adminClient
          .from('attendance_sessions')
          .select(`
            *,
            course:courses(*),
            subject:subjects(*)
          `)
          .eq('teacher_id', teacherId)
          .eq('status', 'active')
          .gt('expires_at', nowIso)
          .order('created_at', { ascending: false });

        if (sessData) {
          activeSessions = sessData.map((s: any) => {
            let decryptedOtp: string | undefined = undefined;
            if (s.encrypted_otp) {
              decryptedOtp = decryptAttendanceOtp(s.encrypted_otp) || undefined;
            }
            return {
              ...s,
              otp_code: decryptedOtp,
            } as AttendanceSession;
          });
        }
      } catch (sessErr) {
        console.warn('[CampusOS Teacher Attendance] attendance_sessions table query:', sessErr);
      }
    } else if (profile.role === 'admin') {
      // Admin sees institutional assignments across all faculty
      const assignmentMap = new Map<string, TeacherSubjectAssignment>();

      const { data: assData } = await adminClient
        .from('teacher_subject_assignments')
        .select(`
          *,
          course:courses(*),
          subject:subjects(*)
        `)
        .limit(100);

      if (assData) {
        (assData as TeacherSubjectAssignment[]).forEach((a) => {
          const sec = (a.section || 'A').trim().toUpperCase();
          const key = `${a.course_id}_${a.subject_id}_${a.semester}_${sec}`;
          assignmentMap.set(key, { ...a, section: sec });
        });
      }

      const { data: ttData } = await adminClient
        .from('timetables')
        .select(`
          *,
          course:courses(*),
          subject:subjects(*)
        `)
        .limit(100);

      if (ttData) {
        ttData.forEach((tt: any) => {
          const sec = (tt.section || 'A').trim().toUpperCase();
          const key = `${tt.course_id}_${tt.subject_id}_${tt.semester}_${sec}`;
          if (!assignmentMap.has(key) && tt.course && tt.subject) {
            assignmentMap.set(key, {
              id: tt.id,
              teacher_id: tt.teacher_id,
              course_id: tt.course_id,
              subject_id: tt.subject_id,
              semester: tt.semester,
              section: sec,
              academic_term: tt.academic_term || '2026-Fall',
              assigned_by: tt.approved_by || user.id,
              assigned_at: tt.created_at,
              course: tt.course,
              subject: tt.subject,
            } as TeacherSubjectAssignment);
          }
        });
      }

      assignments = Array.from(assignmentMap.values());
    }

    return {
      success: true,
      data: {
        teacher,
        assignments,
        timetables,
        activeSessions,
      },
    };
  } catch (err: unknown) {
    console.error('[CampusOS Teacher Attendance] getTeacherAttendanceContextAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load faculty attendance context.',
    };
  }
}

/**
 * Loads the enrolled student roster for an assigned course, subject, and section,
 * merged with their recorded attendance status for a given session or date.
 */
export async function getTeacherSessionRosterAction(params: {
  courseId: string;
  subjectId: string;
  section: string;
  semester: number;
  date?: string;
  sessionId?: string;
}): Promise<{
  success: boolean;
  roster?: AttendanceRosterStudent[];
  session?: AttendanceSession | null;
  presentCount?: number;
  totalEnrolled?: number;
  error?: string;
}> {
  try {
    const { teacher, profile, adminClient } = await requireTeacherOrAdmin();

    if (!isValidUuid(params.courseId) || !isValidUuid(params.subjectId)) {
      return { success: false, error: 'Invalid course or subject identifier.' };
    }

    const cleanSection = params.section.trim().toUpperCase();
    const queryDate = params.date || new Date().toISOString().split('T')[0];

    // 1. Verify teacher is assigned to this course, subject, section (unless admin)
    if (profile.role === 'teacher' && teacher) {
      let isAssigned = false;

      // Check direct assignment
      const { data: assignment } = await adminClient
        .from('teacher_subject_assignments')
        .select('id')
        .eq('teacher_id', teacher.id)
        .eq('course_id', params.courseId)
        .eq('subject_id', params.subjectId)
        .ilike('section', cleanSection)
        .maybeSingle();

      if (assignment) {
        isAssigned = true;
      } else {
        // Check timetable schedule allocation
        const { data: ttAssignment } = await adminClient
          .from('timetables')
          .select('id')
          .eq('teacher_id', teacher.id)
          .eq('course_id', params.courseId)
          .eq('subject_id', params.subjectId)
          .ilike('section', cleanSection)
          .maybeSingle();

        if (ttAssignment) {
          isAssigned = true;
        }
      }

      if (!isAssigned) {
        return {
          success: false,
          error: 'Forbidden: You are not assigned to instruct this course, subject, and section.',
        };
      }
    }

    // 2. Fetch approved student academic enrollments for this course and section
    const studentMap = new Map<string, Student>();

    const { data: enrollments, error: enrollError } = await adminClient
      .from('student_academic_enrollments')
      .select(`
        id,
        course_id,
        semester,
        section,
        status,
        student:students(*)
      `)
      .eq('course_id', params.courseId)
      .eq('semester', params.semester)
      .ilike('section', cleanSection)
      .eq('status', 'approved');

    if (enrollError) {
      console.error('[CampusOS Teacher Attendance] enrollments query error:', enrollError);
      return { success: false, error: 'Failed to retrieve enrolled student roster.' };
    }

    if (enrollments) {
      for (const item of enrollments) {
        const s = (item as any).student as Student | undefined;
        if (s && s.status === 'active') {
          studentMap.set(s.id, s);
        }
      }
    }

    // Also check student_selected_subjects to include any student who specifically selected this subject
    const { data: subjectSelections } = await adminClient
      .from('student_selected_subjects')
      .select(`
        student_id,
        student:students(*)
      `)
      .eq('subject_id', params.subjectId)
      .eq('status', 'approved');

    if (subjectSelections) {
      for (const item of subjectSelections) {
        const s = (item as any).student as Student | undefined;
        if (s && s.status === 'active' && !studentMap.has(s.id)) {
          studentMap.set(s.id, s);
        }
      }
    }

    const enrolledStudents = Array.from(studentMap.values());
    enrolledStudents.sort((a, b) => a.student_code.localeCompare(b.student_code));

    // 3. Fetch existing attendance records
    let attendanceQuery = adminClient.from('attendance').select('*');

    if (params.sessionId && isValidUuid(params.sessionId)) {
      attendanceQuery = attendanceQuery.eq('session_id', params.sessionId);
    } else {
      attendanceQuery = attendanceQuery
        .eq('attendance_date', queryDate)
        .eq('subject_id', params.subjectId)
        .eq('section', cleanSection);
    }

    const { data: attRecords } = await attendanceQuery;
    const recordsMap = new Map<string, AttendanceRecord>();
    if (attRecords) {
      for (const r of attRecords) {
        recordsMap.set(r.student_id, r as AttendanceRecord);
      }
    }

    // 4. Also fetch session details if sessionId is provided
    let sessionObj: AttendanceSession | null = null;
    if (params.sessionId && isValidUuid(params.sessionId)) {
      const { data: sRow } = await adminClient
        .from('attendance_sessions')
        .select(`
          *,
          course:courses(*),
          subject:subjects(*)
        `)
        .eq('id', params.sessionId)
        .maybeSingle();

      if (sRow) {
        let decryptedOtp: string | undefined = undefined;
        if (sRow.encrypted_otp) {
          decryptedOtp = decryptAttendanceOtp(sRow.encrypted_otp) || undefined;
        }
        sessionObj = { ...sRow, otp_code: decryptedOtp } as AttendanceSession;
      }
    }

    // 5. Build unified roster
    let presentCount = 0;
    const roster: AttendanceRosterStudent[] = enrolledStudents.map((stu) => {
      const att = recordsMap.get(stu.id) || null;
      let status: AttendanceStatus | 'unmarked' = 'unmarked';
      if (att) {
        status = att.status;
        if (att.status === 'present' || att.status === 'late') {
          presentCount++;
        }
      }
      return {
        student: stu,
        attendance: att,
        status,
      };
    });

    return {
      success: true,
      roster,
      session: sessionObj,
      presentCount,
      totalEnrolled: enrolledStudents.length,
    };
  } catch (err: unknown) {
    console.error('[CampusOS Teacher Attendance] getTeacherSessionRosterAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve session roster.',
    };
  }
}

/**
 * Creates a new attendance session and generates a cryptographically secure 6-digit OTP.
 */
export async function createAttendanceSessionAction(params: {
  courseId: string;
  subjectId: string;
  section: string;
  semester: number;
  timetableId?: string;
  durationMinutes?: number;
}): Promise<{
  success: boolean;
  session?: AttendanceSession;
  otpCode?: string;
  error?: string;
}> {
  try {
    const { teacher, user, profile, adminClient } = await requireTeacherOrAdmin();

    const teacherId = teacher?.id;
    if (!teacherId && profile.role !== 'admin') {
      return { success: false, error: 'Only registered faculty members can initiate attendance sessions.' };
    }

    if (!isValidUuid(params.courseId) || !isValidUuid(params.subjectId)) {
      return { success: false, error: 'Invalid course or subject identifier.' };
    }

    const cleanSection = params.section.trim().toUpperCase();
    const duration = Math.min(Math.max(params.durationMinutes || 10, 1), 60); // 1 to 60 mins (default 10)
    const sessionId = crypto.randomUUID();
    const otp = generateAttendanceOtp();
    const otpHash = hashAttendanceOtp(otp, sessionId);
    const encryptedOtp = encryptAttendanceOtp(otp);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + duration * 60 * 1000).toISOString();
    const sessionDate = now.toISOString().split('T')[0];

    // 1. Close any existing active sessions for this teacher and subject/section
    await adminClient
      .from('attendance_sessions')
      .update({ status: 'closed', closed_at: now.toISOString() })
      .eq('teacher_id', teacherId)
      .eq('course_id', params.courseId)
      .eq('subject_id', params.subjectId)
      .eq('section', cleanSection)
      .eq('status', 'active');

    // 2. Insert new session
    const payload = {
      id: sessionId,
      teacher_id: teacherId,
      course_id: params.courseId,
      subject_id: params.subjectId,
      timetable_id: params.timetableId && isValidUuid(params.timetableId) ? params.timetableId : null,
      section: cleanSection,
      semester: params.semester,
      academic_term: '2026-Fall',
      session_date: sessionDate,
      otp_hash: otpHash,
      encrypted_otp: encryptedOtp,
      status: 'active',
      expires_at: expiresAt,
      created_by: user.id,
      created_at: now.toISOString(),
    };

    const { data: inserted, error: insertError } = await adminClient
      .from('attendance_sessions')
      .insert(payload)
      .select(`
        *,
        course:courses(*),
        subject:subjects(*)
      `)
      .single();

    if (insertError || !inserted) {
      console.error('[CampusOS Teacher Attendance] createAttendanceSessionAction insert error:', insertError);
      return {
        success: false,
        error: 'Failed to initiate attendance session. Please ensure migration 007 is applied.',
      };
    }

    await logAuditAction({
      action: 'ATTENDANCE_SESSION_CREATED',
      actorId: user.id,
      entityType: 'attendance_session',
      entityId: sessionId,
      details: {
        teacher_id: teacherId,
        course_id: params.courseId,
        subject_id: params.subjectId,
        section: cleanSection,
        expires_at: expiresAt,
      },
    });

    const resultSession: AttendanceSession = {
      ...(inserted as any),
      otp_code: otp,
    };

    return {
      success: true,
      session: resultSession,
      otpCode: otp,
    };
  } catch (err: unknown) {
    console.error('[CampusOS Teacher Attendance] createAttendanceSessionAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create attendance session.',
    };
  }
}

/**
 * Closes an active attendance session immediately, invalidating the OTP.
 */
export async function closeAttendanceSessionAction(sessionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { teacher, user, profile, adminClient } = await requireTeacherOrAdmin();

    if (!isValidUuid(sessionId)) {
      return { success: false, error: 'Invalid session ID format.' };
    }

    const nowIso = new Date().toISOString();
    let query = adminClient
      .from('attendance_sessions')
      .update({
        status: 'closed',
        closed_at: nowIso,
      })
      .eq('id', sessionId);

    if (profile.role === 'teacher' && teacher) {
      query = query.eq('teacher_id', teacher.id);
    }

    const { error } = await query;
    if (error) {
      console.error('[CampusOS Teacher Attendance] closeAttendanceSessionAction error:', error);
      return { success: false, error: 'Failed to close attendance session.' };
    }

    await logAuditAction({
      action: 'ATTENDANCE_SESSION_CLOSED',
      actorId: user.id,
      entityType: 'attendance_session',
      entityId: sessionId,
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('[CampusOS Teacher Attendance] closeAttendanceSessionAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to close attendance session.',
    };
  }
}

/**
 * Allows a teacher or administrator to manually mark or override attendance for a student.
 * Requires a mandatory override reason and logs an audit record.
 */
export async function overrideStudentAttendanceAction(params: {
  studentId: string;
  status: AttendanceStatus;
  reason: string;
  sessionId?: string;
  courseId?: string;
  subjectId?: string;
  section?: string;
  semester?: number;
  date?: string;
}): Promise<{
  success: boolean;
  record?: AttendanceRecord;
  error?: string;
}> {
  try {
    const { teacher, user, profile, adminClient } = await requireTeacherOrAdmin();

    if (!isValidUuid(params.studentId)) {
      return { success: false, error: 'Invalid student ID format.' };
    }

    const cleanReason = params.reason.trim();
    if (!cleanReason || cleanReason.length < 3) {
      return { success: false, error: 'Please enter a valid override reason (minimum 3 characters).' };
    }

    const cleanStatus = params.status;
    if (!['present', 'absent', 'late'].includes(cleanStatus)) {
      return { success: false, error: 'Invalid attendance status.' };
    }

    const dateStr = params.date || new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    // Check if session exists to inherit course/subject metadata
    let courseId = params.courseId || null;
    let subjectId = params.subjectId || null;
    let section = params.section ? params.section.trim().toUpperCase() : null;
    let semester = params.semester || null;

    if (params.sessionId && isValidUuid(params.sessionId)) {
      const { data: sess } = await adminClient
        .from('attendance_sessions')
        .select('*')
        .eq('id', params.sessionId)
        .maybeSingle();

      if (sess) {
        courseId = courseId || sess.course_id;
        subjectId = subjectId || sess.subject_id;
        section = section || sess.section;
        semester = semester || sess.semester;
      }
    }

    // Verify teacher assignment if not admin
    if (profile.role === 'teacher' && teacher && subjectId) {
      let isAssigned = false;
      const { data: assignment } = await adminClient
        .from('teacher_subject_assignments')
        .select('id')
        .eq('teacher_id', teacher.id)
        .eq('subject_id', subjectId)
        .maybeSingle();

      if (assignment) {
        isAssigned = true;
      } else {
        const { data: ttAssignment } = await adminClient
          .from('timetables')
          .select('id')
          .eq('teacher_id', teacher.id)
          .eq('subject_id', subjectId)
          .maybeSingle();

        if (ttAssignment) {
          isAssigned = true;
        }
      }

      if (!isAssigned && !params.sessionId) {
        return {
          success: false,
          error: 'Forbidden: You can only record attendance for your assigned subjects.',
        };
      }
    }

    // Check for existing record
    let existingQuery = adminClient.from('attendance').select('id');
    if (params.sessionId && isValidUuid(params.sessionId)) {
      existingQuery = existingQuery.eq('student_id', params.studentId).eq('session_id', params.sessionId);
    } else if (subjectId) {
      existingQuery = existingQuery
        .eq('student_id', params.studentId)
        .eq('attendance_date', dateStr)
        .eq('subject_id', subjectId);
    } else {
      existingQuery = existingQuery.eq('student_id', params.studentId).eq('attendance_date', dateStr);
    }

    const { data: existingRec } = await existingQuery.maybeSingle();

    let recordResult: any;

    if (existingRec) {
      // Update existing record with override audit fields
      const { data: updated, error: updateError } = await adminClient
        .from('attendance')
        .update({
          status: cleanStatus,
          verification_method: 'override',
          override_reason: cleanReason,
          overridden_by: user.id,
          overridden_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', existingRec.id)
        .select()
        .single();

      if (updateError) {
        console.error('[CampusOS Teacher Attendance] override update error:', updateError);
        return { success: false, error: 'Failed to update attendance record.' };
      }
      recordResult = updated;
    } else {
      // Insert new record
      const payload: Record<string, any> = {
        student_id: params.studentId,
        attendance_date: dateStr,
        status: cleanStatus,
        session_id: params.sessionId && isValidUuid(params.sessionId) ? params.sessionId : null,
        subject_id: subjectId,
        course_id: courseId,
        section,
        semester,
        verification_method: 'override',
        override_reason: cleanReason,
        overridden_by: user.id,
        overridden_at: nowIso,
        recorded_by: user.id,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const { data: inserted, error: insertError } = await adminClient
        .from('attendance')
        .insert(payload)
        .select()
        .single();

      if (insertError) {
        console.error('[CampusOS Teacher Attendance] override insert error:', insertError);
        return { success: false, error: 'Failed to record attendance override.' };
      }
      recordResult = inserted;
    }

    await logAuditAction({
      action: 'ATTENDANCE_OVERRIDE',
      actorId: user.id,
      entityType: 'attendance',
      entityId: recordResult.id,
      details: {
        student_id: params.studentId,
        status: cleanStatus,
        reason: cleanReason,
        sessionId: params.sessionId,
      },
    });

    return {
      success: true,
      record: recordResult as AttendanceRecord,
    };
  } catch (err: unknown) {
    console.error('[CampusOS Teacher Attendance] overrideStudentAttendanceAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to record attendance override.',
    };
  }
}
