/**
 * src/types/attendance.ts
 *
 * TypeScript types for CampusOS attendance management and reporting.
 */

import type { Student } from './student';

export type AttendanceStatus = 'present' | 'absent' | 'late';

export interface AttendanceRecord {
  id: string;
  student_id: string;
  attendance_date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  remarks?: string | null;
  recorded_by?: string | null;
  created_at: string;
  updated_at?: string | null;
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
