/**
 * src/types/attendance.ts
 *
 * TypeScript types for CampusOS attendance management and reporting.
 */

import type { Student } from './student';
import type { Course, Subject, TimetableEntry } from './academic';
import type { Teacher } from './teacher';

export type AttendanceStatus = 'present' | 'absent' | 'late';
export type VerificationMethod = 'otp' | 'manual' | 'override';

export interface AttendanceRecord {
  id: string;
  student_id: string;
  attendance_date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  remarks?: string | null;
  recorded_by?: string | null;
  created_at: string;
  updated_at?: string | null;

  // Academic & Session fields
  session_id?: string | null;
  subject_id?: string | null;
  course_id?: string | null;
  section?: string | null;
  semester?: number | null;
  verification_method?: VerificationMethod | null;
  override_reason?: string | null;
  overridden_by?: string | null;
  overridden_at?: string | null;

  // Joined relations
  subject?: Subject | null;
  course?: Course | null;
  student?: Student | null;
}

export interface AttendanceSession {
  id: string;
  teacher_id: string;
  course_id?: string | null;
  subject_id?: string | null;
  class_id?: string | null;
  timetable_id?: string | null;
  section: string;
  semester: number;
  academic_term: string;
  session_date: string;
  status: 'active' | 'expired' | 'closed';
  expires_at: string;
  created_at: string;
  closed_at?: string | null;

  // Transient/Display fields
  otp_code?: string;
  course?: Course | null;
  subject?: Subject | null;
  teacher?: Teacher | null;
  timetable?: TimetableEntry | null;
  total_enrolled?: number;
  present_count?: number;
}

export interface AttendanceRosterStudent {
  student: Student;
  attendance: AttendanceRecord | null;
  status: AttendanceStatus | 'unmarked';
}

export interface StudentAttendanceStats {
  studentId: string;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  percentage: number | null; // null if totalSessions === 0
}

export interface AttendanceEntryPayload {
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
}

export interface DailyAttendanceSummary {
  date: string;
  totalEligible: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  unmarkedCount: number;
}
