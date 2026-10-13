/**
 * src/types/analytics.ts
 *
 * TypeScript types for CampusOS dashboard analytics and metrics.
 */

export interface DashboardStats {
  // Students by status
  totalStudents: number;
  activeStudents: number;
  inactiveStudents: number;
  graduatedStudents: number;
  pendingStudents: number;
  suspendedStudents: number;

  // Today's attendance
  todayDate: string;
  todayTotalEligible: number;
  todayPresent: number;
  todayAbsent: number;
  todayLate: number;
  todayUnmarked: number;
  todayPercentage: number | null; // present / (present + absent + late) * 100

  // Documents
  totalDocuments: number;
  pendingDocuments: number;
  verifiedDocuments: number;
  rejectedDocuments: number;
}

export interface DailyAttendanceTrendPoint {
  date: string; // YYYY-MM-DD
  displayDate: string; // e.g. "Oct 12"
  present: number;
  absent: number;
  late: number;
  totalRecorded: number;
  percentage: number | null;
}

export interface AttendanceAnalyticsData {
  rangeDays: number;
  startDate: string;
  endDate: string;
  totalSessionsRecorded: number;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  averagePercentage: number | null;
  dailyTrends: DailyAttendanceTrendPoint[];
}

export interface AuditLogEvent {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown> | string | null;
  created_at: string;
}
