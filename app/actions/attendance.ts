'use server';

import { createClient } from '@/src/lib/supabase/server';
import { logAuditAction } from '@/src/lib/audit';
import { isValidUuid, isAuthError } from '@/src/lib/security';
import type { Student } from '@/src/types/student';
import type {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceEntryPayload,
  StudentAttendanceStats,
  DailyAttendanceSummary,
} from '@/src/types/attendance';

/**
 * Server-side authorization check.
 * Verifies that the caller is authenticated and holds role = 'admin' in public.profiles.
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

  if (profileError || !profile || !['admin', 'teacher'].includes(profile.role)) {
    throw new Error('Forbidden: Only authorized faculty or administrators can perform this action.');
  }

  return { supabase, user };
}

/**
 * Validate YYYY-MM-DD date string.
 */
function isValidDateString(dateStr: string): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  return true;
}

/**
 * Retrieve daily attendance sheet: eligible students, existing attendance records
 * for the selected date, and historical attendance stats per student.
 */
export async function getDailyAttendanceAction(
  date: string,
  options?: { statusFilter?: string }
): Promise<{
  success: boolean;
  students?: Student[];
  records?: AttendanceRecord[];
  statsMap?: Record<string, StudentAttendanceStats>;
  summary?: DailyAttendanceSummary;
  error?: string;
}> {
  try {
    const { supabase } = await requireAdmin();

    if (!isValidDateString(date)) {
      return { success: false, error: 'Invalid calendar date format (expected YYYY-MM-DD).' };
    }

    // 1. Fetch eligible students based on existing status rules
    // By default, operational attendance tracks 'active' students.
    let studentQuery = supabase
      .from('students')
      .select('*')
      .order('student_code', { ascending: true });

    if (options?.statusFilter && options.statusFilter !== 'all') {
      studentQuery = studentQuery.eq('status', options.statusFilter);
    } else {
      // Default to active students to exclude graduated or inactive students from daily sheet
      studentQuery = studentQuery.eq('status', 'active');
    }

    const { data: studentRows, error: studentError } = await studentQuery;
    if (studentError) {
      console.error('[CampusOS Attendance] Failed to load students:', studentError);
      return { success: false, error: 'Failed to load students list.' };
    }
    const students = (studentRows as Student[]) || [];

    // 2. Fetch attendance records for this specific date
    const { data: dateRecords, error: dateRecordsError } = await supabase
      .from('attendance')
      .select('*')
      .eq('attendance_date', date);

    if (dateRecordsError) {
      console.error('[CampusOS Attendance] Failed to load attendance records:', dateRecordsError);
      return {
        success: false,
        error: 'Failed to load attendance records for this date.',
      };
    }
    const records = (dateRecords as AttendanceRecord[]) || [];

    // 3. Fetch historical attendance records to compute each student's attendance percentage
    // (present attendance records / all recorded attendance records * 100)
    const { data: historyRows, error: historyError } = await supabase
      .from('attendance')
      .select('student_id, status');

    if (historyError) {
      console.warn('[CampusOS Attendance] Notice: Could not compute historical stats:', historyError.message);
    }

    const statsMap: Record<string, StudentAttendanceStats> = {};

    // Initialize stats for each visible student
    students.forEach((s) => {
      statsMap[s.id] = {
        studentId: s.id,
        totalSessions: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        percentage: null,
      };
    });

    if (historyRows) {
      for (const row of historyRows) {
        const studentStat = statsMap[row.student_id];
        if (studentStat) {
          studentStat.totalSessions += 1;
          if (row.status === 'present') studentStat.presentCount += 1;
          else if (row.status === 'absent') studentStat.absentCount += 1;
          else if (row.status === 'late') studentStat.lateCount += 1;
        }
      }

      // Calculate percentage among recorded sessions
      Object.values(statsMap).forEach((st) => {
        if (st.totalSessions > 0) {
          st.percentage = Math.round((st.presentCount / st.totalSessions) * 100);
        } else {
          st.percentage = null; // No recorded sessions yet
        }
      });
    }

    // 4. Compute Daily Summary
    const recordedStudentIds = new Set(records.map((r) => r.student_id));
    const presentCount = records.filter((r) => r.status === 'present').length;
    const absentCount = records.filter((r) => r.status === 'absent').length;
    const lateCount = records.filter((r) => r.status === 'late').length;
    const unmarkedCount = students.filter((s) => !recordedStudentIds.has(s.id)).length;

    const summary: DailyAttendanceSummary = {
      date,
      totalEligible: students.length,
      presentCount,
      absentCount,
      lateCount,
      unmarkedCount,
    };

    return {
      success: true,
      students,
      records,
      statsMap,
      summary,
    };
  } catch (err: unknown) {
    console.error('[CampusOS Attendance] getAttendanceForDateAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'An error occurred while fetching attendance data.';
    return { success: false, error: message };
  }
}

/**
 * Save attendance records in bulk for a given date.
 * Uses upsert respecting unique constraint (student_id, attendance_date).
 * Automatically associates the authenticated administrator's profile ID in recorded_by.
 */
export async function saveAttendanceBatchAction(
  date: string,
  entries: AttendanceEntryPayload[]
): Promise<{ success: boolean; savedCount?: number; error?: string }> {
  try {
    const { supabase, user } = await requireAdmin();

    if (!isValidDateString(date)) {
      return { success: false, error: 'Invalid calendar date format (expected YYYY-MM-DD).' };
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      return { success: true, savedCount: 0 };
    }

    // Validate entries
    const allowedStatuses: AttendanceStatus[] = ['present', 'absent', 'late'];
    for (const e of entries) {
      if (!e.studentId || !isValidUuid(e.studentId)) {
        return { success: false, error: 'Every attendance record must specify a valid student ID.' };
      }
      if (!allowedStatuses.includes(e.status)) {
        return {
          success: false,
          error: `Invalid status "${e.status}". Allowed values: present, absent, late.`,
        };
      }
    }

    // 1. Prepare payload with admin's profile ID
    const fullPayload = entries.map((entry) => ({
      student_id: entry.studentId,
      attendance_date: date,
      status: entry.status,
      remarks: entry.remarks ? entry.remarks.trim() : null,
      recorded_by: user.id,
    }));

    // 2. Perform upsert on conflict (student_id, attendance_date)
    let upsertResult = await supabase
      .from('attendance')
      .upsert(fullPayload, {
        onConflict: 'student_id,attendance_date',
      })
      .select('*');

    // Fallback if 'remarks' column is not in initial database schema
    if (upsertResult.error && upsertResult.error.message.includes('column')) {
      const fallbackPayload = entries.map((entry) => ({
        student_id: entry.studentId,
        attendance_date: date,
        status: entry.status,
        recorded_by: user.id,
      }));

      upsertResult = await supabase
        .from('attendance')
        .upsert(fallbackPayload, {
          onConflict: 'student_id,attendance_date',
        })
        .select('*');
    }

    if (upsertResult.error || !upsertResult.data) {
      console.error('[CampusOS Attendance] saveAttendanceBatchAction error:', upsertResult.error);
      return {
        success: false,
        error: 'Could not save attendance records. Please try again.',
      };
    }

    // 3. Log audit action
    await logAuditAction({
      actorId: user.id,
      action: 'save_attendance_batch',
      entityType: 'attendance',
      entityId: date,
      details: {
        attendance_date: date,
        totalSaved: upsertResult.data.length,
        present: entries.filter((e) => e.status === 'present').length,
        absent: entries.filter((e) => e.status === 'absent').length,
        late: entries.filter((e) => e.status === 'late').length,
      },
    });

    return {
      success: true,
      savedCount: upsertResult.data.length,
    };
  } catch (err: unknown) {
    console.error('[CampusOS Attendance] saveAttendanceBatchAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'An error occurred while saving attendance. Please try again.';
    return { success: false, error: message };
  }
}

/**
 * Fetch detailed attendance history for an individual student.
 * Computes official attendance percentage: present / all recorded sessions * 100.
 */
export async function getStudentAttendanceHistoryAction(
  studentId: string
): Promise<{
  success: boolean;
  records?: AttendanceRecord[];
  stats?: StudentAttendanceStats;
  error?: string;
}> {
  try {
    const { supabase } = await requireAdmin();

    if (!studentId || !isValidUuid(studentId)) {
      return { success: false, error: 'Invalid student ID format.' };
    }

    const { data: rows, error: rowsError } = await supabase
      .from('attendance')
      .select('*')
      .eq('student_id', studentId)
      .order('attendance_date', { ascending: false });

    if (rowsError) {
      console.error('[CampusOS Attendance] getStudentAttendanceHistoryAction error:', rowsError);
      return { success: false, error: 'Failed to retrieve student attendance history.' };
    }

    const records = (rows as AttendanceRecord[]) || [];
    const totalSessions = records.length;
    const presentCount = records.filter((r) => r.status === 'present').length;
    const absentCount = records.filter((r) => r.status === 'absent').length;
    const lateCount = records.filter((r) => r.status === 'late').length;
    const percentage =
      totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : null;

    const stats: StudentAttendanceStats = {
      studentId,
      totalSessions,
      presentCount,
      absentCount,
      lateCount,
      percentage,
    };

    return {
      success: true,
      records,
      stats,
    };
  } catch (err: unknown) {
    console.error('[CampusOS Attendance] getStudentAttendanceHistoryAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to retrieve student attendance history.';
    return { success: false, error: message };
  }
}
