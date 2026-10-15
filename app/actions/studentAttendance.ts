'use server';

import { headers } from 'next/headers';
import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { logAuditAction } from '@/src/lib/audit';
import { isValidUuid } from '@/src/lib/security';
import { verifyAttendanceOtp } from '@/src/lib/otp';
import { verifyCampusNetwork } from '@/src/lib/network';
import type { Student } from '@/src/types/student';
import type { AttendanceRecord } from '@/src/types/attendance';

/**
 * Server-side authorization check for student portal attendance actions.
 */
async function requireStudent() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized: You must be signed in to submit attendance.');
  }

  const adminClient = createAdminClient();
  const dbClient = adminClient || supabase;

  // Resolve student record
  let { data: student } = await dbClient
    .from('students')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!student && user.email) {
    const { data: matchedStu } = await dbClient
      .from('students')
      .select('*')
      .ilike('email', user.email.trim())
      .neq('status', 'graduated')
      .maybeSingle();

    if (matchedStu) {
      if (adminClient && !matchedStu.user_id) {
        await adminClient
          .from('students')
          .update({ user_id: user.id })
          .eq('id', matchedStu.id);
      }
      student = { ...matchedStu, user_id: user.id };
    }
  }

  if (!student) {
    throw new Error('Student account record not found. Please contact your college registrar.');
  }

  return { supabase, user, student: student as Student, adminClient: dbClient };
}

/**
 * Fetches currently active attendance sessions that match the student's enrolled courses/sections.
 * Securely projects session metadata WITHOUT exposing OTP hashes or secrets.
 */
export async function getStudentActiveAttendanceSessionsAction(): Promise<{
  success: boolean;
  sessions?: Array<{
    id: string;
    courseCode: string;
    courseName: string;
    subjectCode: string;
    subjectName: string;
    section: string;
    semester: number;
    teacherName: string;
    expiresAt: string;
    alreadyMarked: boolean;
  }>;
  error?: string;
}> {
  try {
    const { student, adminClient } = await requireStudent();

    // 1. Fetch student's approved enrollments
    const { data: enrollments } = await adminClient
      .from('student_academic_enrollments')
      .select('course_id, semester, section')
      .eq('student_id', student.id)
      .eq('status', 'approved');

    if (!enrollments || enrollments.length === 0) {
      return { success: true, sessions: [] };
    }

    const courseIds = enrollments.map((e) => e.course_id);
    const sections = Array.from(new Set(enrollments.map((e) => e.section)));

    // 2. Fetch active sessions matching these courses and sections
    const nowIso = new Date().toISOString();
    const { data: activeSessions, error: sessError } = await adminClient
      .from('attendance_sessions')
      .select(`
        id,
        section,
        semester,
        expires_at,
        course:courses(code, name),
        subject:subjects(code, name),
        teacher:teachers(first_name, last_name)
      `)
      .in('course_id', courseIds)
      .in('section', sections)
      .eq('status', 'active')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false });

    if (sessError) {
      console.error('[CampusOS Student Attendance] active sessions error:', sessError);
      return { success: true, sessions: [] };
    }

    if (!activeSessions || activeSessions.length === 0) {
      return { success: true, sessions: [] };
    }

    // 3. Check which sessions the student has already marked
    const sessionIds = activeSessions.map((s) => s.id);
    const { data: markedRecords } = await adminClient
      .from('attendance')
      .select('session_id')
      .eq('student_id', student.id)
      .in('session_id', sessionIds);

    const markedSet = new Set((markedRecords || []).map((r) => r.session_id));

    const result = activeSessions.map((s: any) => ({
      id: s.id,
      courseCode: s.course?.code || 'COURSE',
      courseName: s.course?.name || 'General Program',
      subjectCode: s.subject?.code || 'SUBJ',
      subjectName: s.subject?.name || 'Class Session',
      section: s.section,
      semester: s.semester,
      teacherName: s.teacher ? `${s.teacher.first_name} ${s.teacher.last_name}` : 'Faculty Member',
      expiresAt: s.expires_at,
      alreadyMarked: markedSet.has(s.id),
    }));

    return {
      success: true,
      sessions: result,
    };
  } catch (err: unknown) {
    console.error('[CampusOS Student Attendance] getStudentActiveAttendanceSessionsAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve active class sessions.',
    };
  }
}

/**
 * Validates and records a student's OTP submission for an active attendance session.
 * Enforces rate limiting, Wi-Fi verification, enrollment eligibility, and duplicate checks.
 */
export async function submitStudentOtpAttendanceAction(params: {
  otpCode: string;
  sessionId?: string;
}): Promise<{
  success: boolean;
  message?: string;
  record?: AttendanceRecord;
  error?: string;
}> {
  try {
    const { student, user, adminClient } = await requireStudent();

    const cleanOtp = params.otpCode.trim();
    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      return {
        success: false,
        error: 'Please enter a valid 6-digit attendance code.',
      };
    }

    // 1. Campus Wi-Fi Network Verification
    const headerList = await headers();
    const networkCheck = verifyCampusNetwork(headerList);
    if (!networkCheck.verified) {
      return {
        success: false,
        error: networkCheck.reason || 'Attendance submission is only permitted from verified campus Wi-Fi networks.',
      };
    }

    // 2. Resolve target session
    const now = new Date();
    const nowIso = now.toISOString();

    let targetSession: any = null;

    if (params.sessionId && isValidUuid(params.sessionId)) {
      const { data: sData } = await adminClient
        .from('attendance_sessions')
        .select(`
          *,
          subject:subjects(name)
        `)
        .eq('id', params.sessionId)
        .maybeSingle();

      targetSession = sData;
    } else {
      // If no specific sessionId, locate any active session matching student's enrolled courses/sections
      const { data: enrollments } = await adminClient
        .from('student_academic_enrollments')
        .select('course_id, semester, section')
        .eq('student_id', student.id)
        .eq('status', 'approved');

      if (!enrollments || enrollments.length === 0) {
        return {
          success: false,
          error: 'You do not have any approved academic program enrollments.',
        };
      }

      const courseIds = enrollments.map((e) => e.course_id);
      const sections = Array.from(new Set(enrollments.map((e) => e.section)));

      const { data: candidateSessions } = await adminClient
        .from('attendance_sessions')
        .select(`
          *,
          subject:subjects(name)
        `)
        .in('course_id', courseIds)
        .in('section', sections)
        .eq('status', 'active')
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false });

      if (!candidateSessions || candidateSessions.length === 0) {
        return {
          success: false,
          error: 'No active attendance sessions found for your classes.',
        };
      }

      // Check candidate sessions for matching OTP
      for (const cs of candidateSessions) {
        if (verifyAttendanceOtp(cleanOtp, cs.otp_hash, cs.id)) {
          targetSession = cs;
          break;
        }
      }

      if (!targetSession) {
        targetSession = candidateSessions[0]; // Used for attempt tracking
      }
    }

    if (!targetSession) {
      return {
        success: false,
        error: 'Attendance session not found.',
      };
    }

    // 3. Check Session Status & Expiration
    if (targetSession.status !== 'active' || new Date(targetSession.expires_at) <= now) {
      return {
        success: false,
        error: 'This attendance session has closed or expired. Please contact your instructor.',
      };
    }

    // 4. Rate-Limiting & Attempt Limits (Max 5 attempts per student per session)
    let { data: attemptRow } = await adminClient
      .from('attendance_otp_attempts')
      .select('*')
      .eq('session_id', targetSession.id)
      .eq('student_id', student.id)
      .maybeSingle();

    if (attemptRow && (attemptRow.is_blocked || attemptRow.attempt_count >= 5)) {
      return {
        success: false,
        error: 'Maximum attempt limit exceeded (5 attempts). This attendance session has been locked for your account.',
      };
    }

    // 5. Verify Student Enrollment Eligibility for this session's course & section
    const { data: eligibleEnrollment } = await adminClient
      .from('student_academic_enrollments')
      .select('id')
      .eq('student_id', student.id)
      .eq('course_id', targetSession.course_id)
      .eq('section', targetSession.section)
      .eq('status', 'approved')
      .maybeSingle();

    if (!eligibleEnrollment) {
      return {
        success: false,
        error: 'You are not enrolled in the class or section associated with this attendance session.',
      };
    }

    // 6. Verify Timing-Safe OTP Cryptographic Hash
    const isOtpValid = verifyAttendanceOtp(cleanOtp, targetSession.otp_hash, targetSession.id);

    if (!isOtpValid) {
      // Record failed attempt
      const nextCount = (attemptRow?.attempt_count || 0) + 1;
      const isNowBlocked = nextCount >= 5;

      await adminClient.from('attendance_otp_attempts').upsert({
        session_id: targetSession.id,
        student_id: student.id,
        attempt_count: nextCount,
        last_attempt_at: nowIso,
        is_blocked: isNowBlocked,
      });

      const remaining = 5 - nextCount;
      const warning = remaining > 0 ? ` (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)` : ' (Session locked)';
      return {
        success: false,
        error: `Invalid attendance code. Please check the code shown by your instructor and try again.${warning}`,
      };
    }

    // 7. Prevent Duplicate Submissions
    const { data: existingAttendance } = await adminClient
      .from('attendance')
      .select('id, status, created_at')
      .eq('student_id', student.id)
      .eq('session_id', targetSession.id)
      .maybeSingle();

    if (existingAttendance) {
      return {
        success: false,
        error: 'You have already submitted and recorded attendance for this session.',
      };
    }

    // 8. Record Verified Attendance
    const payload = {
      student_id: student.id,
      session_id: targetSession.id,
      course_id: targetSession.course_id,
      subject_id: targetSession.subject_id,
      section: targetSession.section,
      semester: targetSession.semester,
      attendance_date: targetSession.session_date,
      status: 'present',
      verification_method: 'otp',
      remarks: 'Verified via OTP',
      recorded_by: user.id,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const { data: insertedRecord, error: insertError } = await adminClient
      .from('attendance')
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return {
          success: false,
          error: 'Attendance already recorded for this session.',
        };
      }
      console.error('[CampusOS Student Attendance] insert error:', insertError);
      return {
        success: false,
        error: 'Could not record attendance. Please try again.',
      };
    }

    // 9. Reset attempt counter on success
    if (attemptRow) {
      await adminClient
        .from('attendance_otp_attempts')
        .delete()
        .eq('session_id', targetSession.id)
        .eq('student_id', student.id);
    }

    await logAuditAction({
      action: 'STUDENT_ATTENDANCE_OTP_SUBMITTED',
      actorId: user.id,
      entityType: 'attendance',
      entityId: insertedRecord.id,
      details: {
        student_id: student.id,
        session_id: targetSession.id,
        subject_id: targetSession.subject_id,
        verification_method: 'otp',
      },
    });

    const subjectName = targetSession.subject?.name || 'Class';
    return {
      success: true,
      message: `Attendance marked as Present for ${subjectName}!`,
      record: insertedRecord as AttendanceRecord,
    };
  } catch (err: unknown) {
    console.error('[CampusOS Student Attendance] submitStudentOtpAttendanceAction error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An error occurred while submitting attendance.',
    };
  }
}
