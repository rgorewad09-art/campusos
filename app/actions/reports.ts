'use server';

import { createClient } from '@/src/lib/supabase/server';
import { isAuthError } from '@/src/lib/security';
import type {
  StudentEnrollmentReportRow,
  StudentStatusSummaryItem,
  AttendanceReportRow,
  DocumentReportRow,
  DocumentCategorySummary,
} from '@/src/types/reports';
import { DOCUMENT_CATEGORIES } from '@/src/types/document';
import { getLocalTodayString, addDaysToDateString } from '@/src/lib/dateUtils';

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
 * Fetch Student Enrollment and Status Report data.
 */
export async function getStudentEnrollmentReportAction(options?: {
  statusFilter?: string;
}): Promise<{
  success: boolean;
  rows?: StudentEnrollmentReportRow[];
  statusSummary?: StudentStatusSummaryItem[];
  error?: string;
}> {
  try {
    const { supabase } = await requireAdmin();

    let query = supabase
      .from('students')
      .select('id, student_code, first_name, middle_name, last_name, status, enrollment_date, date_of_birth, email, phone, created_at')
      .order('enrollment_date', { ascending: false });

    if (options?.statusFilter && options.statusFilter !== 'all') {
      query = query.eq('status', options.statusFilter);
    }

    const { data: allStudents, error } = await query;
    if (error) {
      console.error('[CampusOS Reports] getStudentEnrollmentReportAction query error:', error);
      return { success: false, error: 'Failed to load student enrollment report. Please try again.' };
    }

    const rows = (allStudents as StudentEnrollmentReportRow[]) || [];

    // Also fetch all students to build overall status breakdown
    const { data: statusCountsData } = await supabase
      .from('students')
      .select('status');

    const totalStudents = statusCountsData?.length || rows.length;
    const countsByStatus: Record<string, number> = {
      active: 0,
      inactive: 0,
      pending: 0,
      suspended: 0,
      graduated: 0,
    };

    (statusCountsData || rows).forEach((s) => {
      const st = s.status || 'active';
      countsByStatus[st] = (countsByStatus[st] || 0) + 1;
    });

    const statusLabels: Record<string, string> = {
      active: 'Active',
      inactive: 'Inactive',
      pending: 'Pending',
      suspended: 'Suspended',
      graduated: 'Graduated',
    };

    const statusSummary: StudentStatusSummaryItem[] = Object.keys(countsByStatus).map((st) => {
      const count = countsByStatus[st] || 0;
      const percentage = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;
      return {
        status: st,
        label: statusLabels[st] || st,
        count,
        percentage,
      };
    });

    return {
      success: true,
      rows,
      statusSummary,
    };
  } catch (err: unknown) {
    console.error('[CampusOS Reports] getStudentEnrollmentReportAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to generate student enrollment report.';
    return { success: false, error: message };
  }
}

/**
 * Fetch Attendance Report for a selectable date range.
 * Computes per-student attendance rate: (present / recorded_sessions) * 100.
 */
export async function getAttendanceReportAction(
  startDate?: string,
  endDate?: string
): Promise<{
  success: boolean;
  rows?: AttendanceReportRow[];
  dateRange?: { start: string; end: string };
  summary?: {
    totalStudents: number;
    totalSessionsRecorded: number;
    totalPresent: number;
    totalAbsent: number;
    totalLate: number;
    overallPercentage: number | null;
  };
  error?: string;
}> {
  try {
    const { supabase } = await requireAdmin();

    const end = endDate || getLocalTodayString();
    const start = startDate || addDaysToDateString(end, -29); // default 30 days

    // 1. Fetch eligible students
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('id, student_code, first_name, middle_name, last_name, status')
      .order('student_code', { ascending: true });

    if (studentError) {
      console.error('[CampusOS Reports] getAttendanceReportAction student error:', studentError);
      return { success: false, error: 'Failed to load students for attendance report.' };
    }

    const studentList = students || [];

    // 2. Fetch attendance records in date range
    const { data: records, error: recordsError } = await supabase
      .from('attendance')
      .select('student_id, attendance_date, status')
      .gte('attendance_date', start)
      .lte('attendance_date', end);

    if (recordsError) {
      console.error('[CampusOS Reports] getAttendanceReportAction records error:', recordsError);
      return { success: false, error: 'Failed to load attendance records for report.' };
    }

    const attendanceRecords = records || [];

    // Map records per student
    const studentRecordMap = new Map<
      string,
      { total: number; present: number; absent: number; late: number }
    >();

    attendanceRecords.forEach((r) => {
      if (!studentRecordMap.has(r.student_id)) {
        studentRecordMap.set(r.student_id, { total: 0, present: 0, absent: 0, late: 0 });
      }
      const item = studentRecordMap.get(r.student_id)!;
      item.total += 1;
      if (r.status === 'present') item.present += 1;
      else if (r.status === 'absent') item.absent += 1;
      else if (r.status === 'late') item.late += 1;
    });

    let totalSessionsRecorded = 0;
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;

    const rows: AttendanceReportRow[] = studentList.map((s) => {
      const rec = studentRecordMap.get(s.id) || { total: 0, present: 0, absent: 0, late: 0 };
      totalSessionsRecorded += rec.total;
      totalPresent += rec.present;
      totalAbsent += rec.absent;
      totalLate += rec.late;

      const pct = rec.total > 0 ? Math.round((rec.present / rec.total) * 100) : null;
      const fullName = [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ');

      return {
        student_id: s.id,
        student_code: s.student_code,
        student_name: fullName,
        total_sessions: rec.total,
        present_count: rec.present,
        absent_count: rec.absent,
        late_count: rec.late,
        attendance_percentage: pct,
      };
    });

    const overallPercentage =
      totalSessionsRecorded > 0
        ? Math.round((totalPresent / totalSessionsRecorded) * 100)
        : null;

    return {
      success: true,
      rows,
      dateRange: { start, end },
      summary: {
        totalStudents: studentList.length,
        totalSessionsRecorded,
        totalPresent,
        totalAbsent,
        totalLate,
        overallPercentage,
      },
    };
  } catch (err: unknown) {
    console.error('[CampusOS Reports] getAttendanceReportAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to generate attendance report.';
    return { success: false, error: message };
  }
}

/**
 * Fetch Document Verification Summary Report data.
 */
export async function getDocumentReportAction(): Promise<{
  success: boolean;
  rows?: DocumentReportRow[];
  categorySummary?: DocumentCategorySummary[];
  error?: string;
}> {
  try {
    const { supabase } = await requireAdmin();

    // 1. Fetch all documents
    const { data: docs, error: docError } = await supabase
      .from('student_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (docError) {
      console.error('[CampusOS Reports] getDocumentReportAction doc error:', docError);
      return { success: false, error: 'Failed to load document records for report.' };
    }

    const documentList = docs || [];

    // 2. Fetch students to map names and codes
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('id, student_code, first_name, middle_name, last_name');

    if (studentError) {
      console.error('[CampusOS Reports] getDocumentReportAction student map error:', studentError);
    }

    const studentMap = new Map<string, { code: string; name: string }>();
    (students || []).forEach((s) => {
      const name = [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ');
      studentMap.set(s.id, { code: s.student_code, name });
    });

    // Map categories
    const categoryInfoMap = new Map<string, string>();
    DOCUMENT_CATEGORIES.forEach((cat) => {
      categoryInfoMap.set(cat.value, cat.label);
    });

    // Category summary aggregation
    const categorySummaryMap = new Map<
      string,
      { total: number; pending: number; verified: number; rejected: number }
    >();

    DOCUMENT_CATEGORIES.forEach((cat) => {
      categorySummaryMap.set(cat.value, { total: 0, pending: 0, verified: 0, rejected: 0 });
    });

    const rows: DocumentReportRow[] = documentList.map((d) => {
      const studentInfo = studentMap.get(d.student_id) || { code: '—', name: 'Unknown Student' };
      const catVal = d.document_type || 'other';
      const catLabel = categoryInfoMap.get(catVal) || catVal.replace(/_/g, ' ');

      if (!categorySummaryMap.has(catVal)) {
        categorySummaryMap.set(catVal, { total: 0, pending: 0, verified: 0, rejected: 0 });
      }
      const catSum = categorySummaryMap.get(catVal)!;
      catSum.total += 1;
      if (d.verification_status === 'pending') catSum.pending += 1;
      else if (d.verification_status === 'verified') catSum.verified += 1;
      else if (d.verification_status === 'rejected') catSum.rejected += 1;

      return {
        id: d.id,
        student_code: studentInfo.code,
        student_name: studentInfo.name,
        document_type: catVal,
        category_label: catLabel,
        original_filename: d.original_filename || d.file_name || 'Document',
        verification_status: d.verification_status,
        verified_at: d.verified_at,
        created_at: d.created_at,
        rejection_reason: d.rejection_reason,
      };
    });

    const categorySummary: DocumentCategorySummary[] = Array.from(
      categorySummaryMap.entries()
    ).map(([cat, counts]) => ({
      category: cat,
      category_label: categoryInfoMap.get(cat) || cat.replace(/_/g, ' '),
      ...counts,
    }));

    return {
      success: true,
      rows,
      categorySummary,
    };
  } catch (err: unknown) {
    console.error('[CampusOS Reports] getDocumentReportAction unhandled error:', err);
    const message =
      isAuthError(err) && err instanceof Error
        ? err.message
        : 'Failed to generate document report.';
    return { success: false, error: message };
  }
}
