/**
 * src/types/reports.ts
 *
 * TypeScript types for CampusOS administrative reports and data export.
 */

export interface StudentEnrollmentReportRow {
  id: string;
  student_code: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  status: string;
  enrollment_date: string;
  date_of_birth: string;
  email?: string | null;
  phone?: string | null;
  created_at: string;
}

export interface StudentStatusSummaryItem {
  status: string;
  label: string;
  count: number;
  percentage: number;
}

export interface AttendanceReportRow {
  student_id: string;
  student_code: string;
  student_name: string;
  total_sessions: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  attendance_percentage: number | null;
}

export interface DocumentReportRow {
  id: string;
  student_code: string;
  student_name: string;
  document_type: string;
  category_label: string;
  original_filename: string;
  verification_status: string;
  verified_at: string | null;
  created_at: string;
  rejection_reason?: string | null;
}

export interface DocumentCategorySummary {
  category: string;
  category_label: string;
  total: number;
  pending: number;
  verified: number;
  rejected: number;
}
