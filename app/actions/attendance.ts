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

    const dateRecordsQuery = supabase
      .from('attendance')
      .select('*')
      .eq('attendance_date', date);

    const historyQuery = supabase
      .from('attendance')
      .select('student_id, status');

    // Run all 3 queries concurrently
    const [studentRes, dateRecordsRes, historyRes] = await Promise.all([
      studentQuery,
      dateRecordsQuery,
      historyQuery,
    ]);

    if (studentRes.error) {
      console.error('[CampusOS Attendance] Failed to load students:', studentRes.error);
      return { success: false, error: 'Failed to load students list.' };
    }
    const students = (studentRes.data as Student[]) || [];

    if (dateRecordsRes.error) {
      console.error('[CampusOS Attendance] Failed to load attendance records:', dateRecordsRes.error);
      return {
        success: false,
        error: 'Failed to load attendance records for this date.',
      };
    }
    const records = (dateRecordsRes.data as AttendanceRecord[]) || [];

    if (historyRes.error) {
      console.warn('[CampusOS Attendance] Notice: Could not compute historical stats:', historyRes.error.message);
    }
    const historyRows = historyRes.data || [];

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

    // 1. Query existing records for this date and target students to prevent constraint mismatch errors
    const studentIds = entries.map((e) => e.studentId);
    const { data: existingRows, error: fetchErr } = await supabase
      .from('attendance')
      .select('id, student_id, session_id, subject_id')
      .eq('attendance_date', date)
      .in('student_id', studentIds);

    if (fetchErr) {
      console.error('[CampusOS Attendance] Error checking existing records:', fetchErr);
      return {
        success: false,
        error: `Could not verify existing attendance records: ${fetchErr.message}`,
      };
    }

    // Map existing records per student (prioritizing general daily records)
    const existingMap = new Map<string, string>();
    (existingRows || []).forEach((r) => {
      if (!r.session_id && !r.subject_id) {
        existingMap.set(r.student_id, r.id);
      } else if (!existingMap.has(r.student_id)) {
        existingMap.set(r.student_id, r.id);
      }
    });

    const nowIso = new Date().toISOString();
    const toUpdate: { id: string; status: AttendanceStatus; remarks: string | null }[] = [];
    const toInsert: {
      student_id: string;
      attendance_date: string;
      status: AttendanceStatus;
      remarks: string | null;
      recorded_by: string;
      verification_method: string;
      created_at: string;
      updated_at: string;
    }[] = [];

    for (const entry of entries) {
      const existingId = existingMap.get(entry.studentId);
      const cleanRemarks = entry.remarks ? entry.remarks.trim() : null;

      if (existingId) {
        toUpdate.push({
          id: existingId,
          status: entry.status,
          remarks: cleanRemarks,
        });
      } else {
        toInsert.push({
          student_id: entry.studentId,
          attendance_date: date,
          status: entry.status,
          remarks: cleanRemarks,
          recorded_by: user.id,
          verification_method: 'manual',
          created_at: nowIso,
          updated_at: nowIso,
        });
      }
    }

    let savedCount = 0;

    // 2. Perform batch insert for new attendance records
    if (toInsert.length > 0) {
      const { data: insertedData, error: insertError } = await supabase
        .from('attendance')
        .insert(toInsert)
        .select('id');

      if (insertError) {
        console.error('[CampusOS Attendance] Batch insert error:', insertError);
        return {
          success: false,
          error: `Failed to insert new attendance records: ${insertError.message}`,
        };
      }
      savedCount += insertedData?.length || toInsert.length;
    }

    // 3. Perform updates for existing records
    if (toUpdate.length > 0) {
      const updatePromises = toUpdate.map(async (item) => {
        const { data, error } = await supabase
          .from('attendance')
          .update({
            status: item.status,
            remarks: item.remarks,
            recorded_by: user.id,
            updated_at: nowIso,
            verification_method: 'manual',
          })
          .eq('id', item.id)
          .select('id');

        if (error) {
          throw new Error(`Failed to update attendance for record ${item.id}: ${error.message}`);
        }
        return data;
      });

      const updatedResults = await Promise.all(updatePromises);
      savedCount += updatedResults.length;
    }

    // 4. Log audit action
    await logAuditAction({
      actorId: user.id,
      action: 'save_attendance_batch',
      entityType: 'attendance',
      entityId: date,
      details: {
        attendance_date: date,
        totalSaved: savedCount,
        present: entries.filter((e) => e.status === 'present').length,
        absent: entries.filter((e) => e.status === 'absent').length,
        late: entries.filter((e) => e.status === 'late').length,
      },
    });

    return {
      success: true,
      savedCount,
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
