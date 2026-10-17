'use server';

import { createClient } from '@/src/lib/supabase/server';
import { isAuthError } from '@/src/lib/security';
import type {
  DashboardStats,
  AttendanceAnalyticsData,
  DailyAttendanceTrendPoint,
  AuditLogEvent,
} from '@/src/types/analytics';
import {
  getLocalTodayString,
  addDaysToDateString,
  formatLocalDate,
} from '@/src/lib/dateUtils';

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

  if (profileError || !profile || profile.role !== 'admin') {
    throw new Error('Forbidden: Only authorized administrators can perform this action.');
  }

  return { supabase, user };
}

/**
 * Fetch live aggregate statistics for the dashboard cards.
 * Replaces hardcoded placeholders with live Supabase queries.
 */
export async function getDashboardStatsAction(): Promise<{
  success: boolean;
  stats?: DashboardStats;
  error?: string;
}> {
  try {
    const { supabase } = await requireAdmin();

    const todayDate = getLocalTodayString();

    // Run students, today attendance, and documents queries in parallel
    const [studentsRes, attendanceRes, documentsRes] = await Promise.all([
      supabase.from('students').select('id, status'),
      supabase.from('attendance').select('id, student_id, status').eq('attendance_date', todayDate),
      supabase.from('student_documents').select('id, verification_status'),
    ]);

    if (studentsRes.error) {
      console.error('[CampusOS Analytics] studentsError:', studentsRes.error);
      return { success: false, error: 'Failed to load students statistics.' };
    }
    if (attendanceRes.error) {
      console.error('[CampusOS Analytics] attendanceError:', attendanceRes.error);
      return { success: false, error: 'Failed to load attendance statistics.' };
    }
    if (documentsRes.error) {
      console.error('[CampusOS Analytics] documentsError:', documentsRes.error);
      return { success: false, error: 'Failed to load document statistics.' };
    }

    const studentList = studentsRes.data || [];
    const totalStudents = studentList.length;
    const activeStudents = studentList.filter((s) => s.status === 'active').length;
    const inactiveStudents = studentList.filter((s) => s.status === 'inactive').length;
    const graduatedStudents = studentList.filter((s) => s.status === 'graduated').length;
    const pendingStudents = studentList.filter((s) => s.status === 'pending').length;
    const suspendedStudents = studentList.filter((s) => s.status === 'suspended').length;

    const attendanceList = attendanceRes.data || [];
    const todayPresent = attendanceList.filter((a) => a.status === 'present').length;
    const todayAbsent = attendanceList.filter((a) => a.status === 'absent').length;
    const todayLate = attendanceList.filter((a) => a.status === 'late').length;
    const totalRecordedToday = todayPresent + todayAbsent + todayLate;

    // Total eligible for today's session = active students
    const todayTotalEligible = activeStudents;
    const todayUnmarked = Math.max(0, todayTotalEligible - attendanceList.length);

    // Percentage among recorded sessions today (do not count unmarked as absent)
    const todayPercentage =
      totalRecordedToday > 0
        ? Math.round((todayPresent / totalRecordedToday) * 100)
        : null;

    const docList = documentsRes.data || [];
    const totalDocuments = docList.length;
    const pendingDocuments = docList.filter((d) => d.verification_status === 'pending').length;
    const verifiedDocuments = docList.filter((d) => d.verification_status === 'verified').length;
    const rejectedDocuments = docList.filter((d) => d.verification_status === 'rejected').length;

    const stats: DashboardStats = {
      totalStudents,
      activeStudents,
      inactiveStudents,
      graduatedStudents,
      pendingStudents,
      suspendedStudents,
      todayDate,
      todayTotalEligible,
      todayPresent,
      todayAbsent,
      todayLate,
      todayUnmarked,
      todayPercentage,
      totalDocuments,
      pendingDocuments,
      verifiedDocuments,
      rejectedDocuments,
    };

    return { success: true, stats };
  } catch (err: unknown) {
    console.error('[CampusOS Analytics] getDashboardStatsAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to retrieve dashboard metrics.';
    return { success: false, error: message };
  }
}

/**
 * Fetch attendance analytics and day-by-day trends over a selectable window (e.g. 7, 14, 30 days).
 */
export async function getAttendanceAnalyticsAction(
  rangeDays: number = 7
): Promise<{
  success: boolean;
  data?: AttendanceAnalyticsData;
  error?: string;
}> {
  try {
    const { supabase } = await requireAdmin();

    const safeDays = Math.max(1, Math.min(60, rangeDays));
    const endDate = getLocalTodayString();
    const startDate = addDaysToDateString(endDate, -(safeDays - 1));

    // Fetch records in range
    const { data: records, error } = await supabase
      .from('attendance')
      .select('attendance_date, status')
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)
      .order('attendance_date', { ascending: true });

    if (error) {
      console.error('[CampusOS Analytics] getAttendanceAnalyticsAction error:', error);
      return { success: false, error: 'Failed to retrieve attendance analytics.' };
    }

    const rows = records || [];

    // Map daily records
    const dayMap = new Map<string, { present: number; absent: number; late: number }>();

    rows.forEach((r) => {
      const d = r.attendance_date;
      if (!dayMap.has(d)) {
        dayMap.set(d, { present: 0, absent: 0, late: 0 });
      }
      const entry = dayMap.get(d)!;
      if (r.status === 'present') entry.present += 1;
      else if (r.status === 'absent') entry.absent += 1;
      else if (r.status === 'late') entry.late += 1;
    });

    // Build contiguous daily trends list
    const dailyTrends: DailyAttendanceTrendPoint[] = [];
    let curDate = startDate;
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;
    let totalSessionsRecorded = 0;

    for (let i = 0; i < safeDays; i++) {
      const counts = dayMap.get(curDate) || { present: 0, absent: 0, late: 0 };
      const dayTotal = counts.present + counts.absent + counts.late;

      totalPresent += counts.present;
      totalAbsent += counts.absent;
      totalLate += counts.late;
      totalSessionsRecorded += dayTotal;

      const pct = dayTotal > 0 ? Math.round((counts.present / dayTotal) * 100) : null;

      // Format short display date (e.g. "Oct 12")
      const parts = curDate.split('-');
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      const mIdx = parseInt(parts[1], 10) - 1;
      const displayDate = `${monthNames[mIdx]} ${parseInt(parts[2], 10)}`;

      dailyTrends.push({
        date: curDate,
        displayDate,
        present: counts.present,
        absent: counts.absent,
        late: counts.late,
        totalRecorded: dayTotal,
        percentage: pct,
      });

      curDate = addDaysToDateString(curDate, 1);
    }

    const averagePercentage =
      totalSessionsRecorded > 0
        ? Math.round((totalPresent / totalSessionsRecorded) * 100)
        : null;

    const data: AttendanceAnalyticsData = {
      rangeDays: safeDays,
      startDate,
      endDate,
      totalSessionsRecorded,
      totalPresent,
      totalAbsent,
      totalLate,
      averagePercentage,
      dailyTrends,
    };

    return { success: true, data };
  } catch (err: unknown) {
    console.error('[CampusOS Analytics] getAttendanceAnalyticsAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to retrieve attendance analytics.';
    return { success: false, error: message };
  }
}

/**
 * Fetch real system events from public.audit_logs.
 * Never invents fake events.
 */
export async function getRecentActivityAction(
  limit: number = 8
): Promise<{
  success: boolean;
  events?: AuditLogEvent[];
  error?: string;
}> {
  try {
    const { supabase } = await requireAdmin();

    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[CampusOS Analytics] getRecentActivityAction error:', error);
      return { success: false, error: 'Failed to retrieve audit activity.' };
    }

    return {
      success: true,
      events: (data as AuditLogEvent[]) || [],
    };
  } catch (err: unknown) {
    console.error('[CampusOS Analytics] getRecentActivityAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to retrieve audit activity.';
    return { success: false, error: message };
  }
}
