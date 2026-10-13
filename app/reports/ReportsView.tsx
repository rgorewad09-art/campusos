'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  CalendarCheck,
  FileCheck,
  Download,
  Search,
  RotateCw,
  AlertCircle,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  ArrowUpRight,
} from 'lucide-react';
import StatusBadge from '../students/components/StatusBadge';
import {
  getStudentEnrollmentReportAction,
  getAttendanceReportAction,
  getDocumentReportAction,
} from '@/app/actions/reports';
import type {
  StudentEnrollmentReportRow,
  StudentStatusSummaryItem,
  AttendanceReportRow,
  DocumentReportRow,
  DocumentCategorySummary,
} from '@/src/types/reports';
import type { StudentStatus } from '@/src/types/student';
import { generateCsvString, downloadCsvFile } from '@/src/lib/csvExport';
import {
  getLocalTodayString,
  addDaysToDateString,
  formatLocalDate,
} from '@/src/lib/dateUtils';
import StatCardSkeleton from '@/src/components/skeletons/StatCardSkeleton';
import StudentListSkeleton from '@/src/components/skeletons/StudentListSkeleton';
import AttendanceTableSkeleton from '@/src/components/skeletons/AttendanceTableSkeleton';
import DocumentListSkeleton from '@/src/components/skeletons/DocumentListSkeleton';
import Skeleton from '@/src/components/skeletons/Skeleton';

type ReportTab = 'enrollment' | 'attendance' | 'documents';

export default function ReportsView() {
  const [activeTab, setActiveTab] = useState<ReportTab>('enrollment');

  // ==========================================
  // TAB 1: Student Enrollment Report State
  // ==========================================
  const [enrollmentRows, setEnrollmentRows] = useState<StudentEnrollmentReportRow[]>([]);
  const [statusSummary, setStatusSummary] = useState<StudentStatusSummaryItem[]>([]);
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState<string>('all');
  const [enrollmentSearch, setEnrollmentSearch] = useState<string>('');
  const [isEnrollmentLoading, setIsEnrollmentLoading] = useState<boolean>(true);
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);

  // ==========================================
  // TAB 2: Attendance Summary Report State
  // ==========================================
  const [attendanceRows, setAttendanceRows] = useState<AttendanceReportRow[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<{
    totalStudents: number;
    totalSessionsRecorded: number;
    totalPresent: number;
    totalAbsent: number;
    totalLate: number;
    overallPercentage: number | null;
  } | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [onlyLowAttendance, setOnlyLowAttendance] = useState<boolean>(false);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState<boolean>(true);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  // ==========================================
  // TAB 3: Document Verification Report State
  // ==========================================
  const [documentRows, setDocumentRows] = useState<DocumentReportRow[]>([]);
  const [categorySummary, setCategorySummary] = useState<DocumentCategorySummary[]>([]);
  const [docCategoryFilter, setDocCategoryFilter] = useState<string>('all');
  const [docStatusFilter, setDocStatusFilter] = useState<string>('all');
  const [docSearch, setDocSearch] = useState<string>('');
  const [isDocLoading, setIsDocLoading] = useState<boolean>(true);
  const [docError, setDocError] = useState<string | null>(null);

  // ------------------------------------------
  // Fetch Enrollment Report
  // ------------------------------------------
  const fetchEnrollmentData = useCallback(async () => {
    setIsEnrollmentLoading(true);
    setEnrollmentError(null);
    try {
      const res = await getStudentEnrollmentReportAction({
        statusFilter: enrollmentStatusFilter,
      });
      if (!res.success || !res.rows) {
        setEnrollmentError(res.error || 'Failed to load enrollment report.');
      } else {
        setEnrollmentRows(res.rows);
        if (res.statusSummary) {
          setStatusSummary(res.statusSummary);
        }
      }
    } catch (err: unknown) {
      setEnrollmentError(
        err instanceof Error ? err.message : 'Error fetching enrollment report.'
      );
    } finally {
      setIsEnrollmentLoading(false);
    }
  }, [enrollmentStatusFilter]);

  // ------------------------------------------
  // Fetch Attendance Report
  // ------------------------------------------
  const fetchAttendanceData = useCallback(
    async (start?: string, end?: string) => {
      setIsAttendanceLoading(true);
      setAttendanceError(null);
      try {
        const res = await getAttendanceReportAction(start, end);
        if (!res.success || !res.rows) {
          setAttendanceError(res.error || 'Failed to load attendance report.');
        } else {
          setAttendanceRows(res.rows);
          if (res.summary) {
            setAttendanceSummary(res.summary);
          }
          if (res.dateRange) {
            setStartDate(res.dateRange.start);
            setEndDate(res.dateRange.end);
          }
        }
      } catch (err: unknown) {
        setAttendanceError(
          err instanceof Error ? err.message : 'Error fetching attendance report.'
        );
      } finally {
        setIsAttendanceLoading(false);
      }
    },
    []
  );

  // ------------------------------------------
  // Fetch Document Report
  // ------------------------------------------
  const fetchDocumentData = useCallback(async () => {
    setIsDocLoading(true);
    setDocError(null);
    try {
      const res = await getDocumentReportAction();
      if (!res.success || !res.rows) {
        setDocError(res.error || 'Failed to load document report.');
      } else {
        setDocumentRows(res.rows);
        if (res.categorySummary) {
          setCategorySummary(res.categorySummary);
        }
      }
    } catch (err: unknown) {
      setDocError(
        err instanceof Error ? err.message : 'Error fetching document report.'
      );
    } finally {
      setIsDocLoading(false);
    }
  }, []);

  // Initialize tabs without SSR hydration mismatch
  useEffect(() => {
    fetchEnrollmentData();
  }, [fetchEnrollmentData]);

  useEffect(() => {
    if (activeTab === 'attendance' && !startDate) {
      const today = getLocalTodayString();
      const past30 = addDaysToDateString(today, -29);
      setStartDate(past30);
      setEndDate(today);
      fetchAttendanceData(past30, today);
    } else if (activeTab === 'documents' && documentRows.length === 0 && !docError) {
      fetchDocumentData();
    }
  }, [activeTab, startDate, documentRows.length, docError, fetchAttendanceData, fetchDocumentData]);

  // ==========================================
  // CSV Export Handlers
  // ==========================================
  function exportEnrollmentCsv() {
    const headers = [
      'Student Code',
      'First Name',
      'Middle Name',
      'Last Name',
      'Status',
      'Enrollment Date',
      'Date of Birth',
      'Email',
      'Phone',
      'Registered Date',
    ];

    const rows = filteredEnrollmentRows.map((s) => [
      s.student_code,
      s.first_name,
      s.middle_name || '',
      s.last_name,
      s.status,
      s.enrollment_date,
      s.date_of_birth,
      s.email || '',
      s.phone || '',
      s.created_at ? s.created_at.split('T')[0] : '',
    ]);

    const csvContent = generateCsvString(headers, rows);
    const today = getLocalTodayString();
    downloadCsvFile(`campusos_student_enrollment_report_${today}.csv`, csvContent);
  }

  function exportAttendanceCsv() {
    const headers = [
      'Student Code',
      'Student Name',
      'Total Sessions Recorded',
      'Present Count',
      'Absent Count',
      'Late Count',
      'Attendance Percentage (%)',
    ];

    const rows = filteredAttendanceRows.map((a) => [
      a.student_code,
      a.student_name,
      a.total_sessions,
      a.present_count,
      a.absent_count,
      a.late_count,
      a.attendance_percentage !== null ? `${a.attendance_percentage}%` : 'N/A',
    ]);

    const csvContent = generateCsvString(headers, rows);
    downloadCsvFile(
      `campusos_attendance_summary_${startDate || 'start'}_to_${endDate || 'end'}.csv`,
      csvContent
    );
  }

  function exportDocumentsCsv() {
    const headers = [
      'Student Code',
      'Student Name',
      'Category',
      'Original Filename',
      'Verification Status',
      'Verified At',
      'Uploaded At',
      'Rejection Reason',
    ];

    const rows = filteredDocumentRows.map((d) => [
      d.student_code,
      d.student_name,
      d.category_label,
      d.original_filename,
      d.verification_status,
      d.verified_at ? d.verified_at.split('T')[0] : '',
      d.created_at ? d.created_at.split('T')[0] : '',
      d.rejection_reason || '',
    ]);

    const csvContent = generateCsvString(headers, rows);
    const today = getLocalTodayString();
    downloadCsvFile(`campusos_document_verification_report_${today}.csv`, csvContent);
  }

  // Filtered rows for client search / status
  const filteredEnrollmentRows = enrollmentRows.filter((r) => {
    if (!enrollmentSearch) return true;
    const q = enrollmentSearch.toLowerCase();
    const fullName = `${r.first_name} ${r.middle_name || ''} ${r.last_name}`.toLowerCase();
    return (
      r.student_code.toLowerCase().includes(q) ||
      fullName.includes(q) ||
      (r.email && r.email.toLowerCase().includes(q))
    );
  });

  const filteredAttendanceRows = attendanceRows.filter((r) => {
    if (!onlyLowAttendance) return true;
    return r.attendance_percentage !== null && r.attendance_percentage < 75;
  });

  const filteredDocumentRows = documentRows.filter((d) => {
    const matchesCat = docCategoryFilter === 'all' || d.document_type === docCategoryFilter;
    const matchesStatus =
      docStatusFilter === 'all' || d.verification_status === docStatusFilter;
    const q = docSearch.toLowerCase();
    const matchesSearch =
      !docSearch ||
      d.student_code.toLowerCase().includes(q) ||
      d.student_name.toLowerCase().includes(q) ||
      d.original_filename.toLowerCase().includes(q);
    return matchesCat && matchesStatus && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#171717]">
            Reports &amp; Analytics
          </h1>
          <p className="mt-0.5 text-xs text-[#737373]">
            Generate institutional reports, monitor attendance trends, and export verified datasets to CSV.
          </p>
        </div>
      </div>

      {/* Main Tab Navigation Bar */}
      <div className="border-b border-[#E5E5E5]">
        <nav className="flex space-x-2 sm:space-x-4" aria-label="Reports navigation">
          <button
            type="button"
            onClick={() => setActiveTab('enrollment')}
            className={`flex items-center gap-2 border-b-2 py-3 px-2 text-xs font-medium transition-colors ${
              activeTab === 'enrollment'
                ? 'border-[#171717] text-[#171717]'
                : 'border-transparent text-[#737373] hover:border-[#D4D4D4] hover:text-[#171717]'
            }`}
          >
            <Users size={15} />
            <span>Student Enrollment &amp; Status</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('attendance');
              if (!startDate) {
                const today = getLocalTodayString();
                const past30 = addDaysToDateString(today, -29);
                setStartDate(past30);
                setEndDate(today);
                fetchAttendanceData(past30, today);
              }
            }}
            className={`flex items-center gap-2 border-b-2 py-3 px-2 text-xs font-medium transition-colors ${
              activeTab === 'attendance'
                ? 'border-[#171717] text-[#171717]'
                : 'border-transparent text-[#737373] hover:border-[#D4D4D4] hover:text-[#171717]'
            }`}
          >
            <CalendarCheck size={15} />
            <span>Attendance Summary</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('documents');
              if (documentRows.length === 0) {
                fetchDocumentData();
              }
            }}
            className={`flex items-center gap-2 border-b-2 py-3 px-2 text-xs font-medium transition-colors ${
              activeTab === 'documents'
                ? 'border-[#171717] text-[#171717]'
                : 'border-transparent text-[#737373] hover:border-[#D4D4D4] hover:text-[#171717]'
            }`}
          >
            <FileCheck size={15} />
            <span>Document Verification</span>
          </button>
        </nav>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: Student Enrollment & Status Report */}
      {/* ========================================================================= */}
      {activeTab === 'enrollment' && (
        <div className="space-y-6">
          {/* Status Breakdown Summary Cards */}
          {isEnrollmentLoading && statusSummary.length === 0 ? (
            <div
              aria-busy="true"
              aria-label="Loading enrollment status breakdown"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
            >
              <span className="sr-only">Loading status summary...</span>
              {Array.from({ length: 6 }).map((_, i) => (
                <StatCardSkeleton key={i} />
              ))}
            </div>
          ) : statusSummary.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {statusSummary.map((item) => (
                <div
                  key={item.status}
                  className="rounded-xl border border-[#E5E5E5] bg-white p-4"
                >
                  <span className="text-[11px] font-medium text-[#737373] uppercase tracking-wider block">
                    {item.label}
                  </span>
                  <p className="mt-1 font-mono text-2xl font-bold text-[#171717]">
                    {item.count}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#737373]">
                    {item.percentage}% of total
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {/* Action & Filter Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-lg border border-[#E5E5E5] bg-white p-3">
            <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]"
                />
                <input
                  type="text"
                  placeholder="Filter by ID, student name, or email..."
                  value={enrollmentSearch}
                  onChange={(e) => setEnrollmentSearch(e.target.value)}
                  className="w-full rounded-md border border-[#E5E5E5] bg-white py-1.5 pl-9 pr-3 text-xs text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#737373] shrink-0">Status:</span>
                <select
                  value={enrollmentStatusFilter}
                  onChange={(e) => setEnrollmentStatusFilter(e.target.value)}
                  className="rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                >
                  <option value="all">All Enrolled</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                  <option value="graduated">Graduated</option>
                </select>
              </div>
            </div>

            {/* Buttons: Refresh and Export CSV */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => fetchEnrollmentData()}
                disabled={isEnrollmentLoading}
                className="flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] hover:border-[#171717] transition-colors disabled:opacity-50"
                title="Refresh enrollment dataset"
              >
                <RotateCw size={13} className={isEnrollmentLoading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={exportEnrollmentCsv}
                disabled={filteredEnrollmentRows.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#262626] transition-colors disabled:opacity-40"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {enrollmentError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[#171717] bg-[#F7F7F7] p-4 text-xs text-[#171717]">
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#171717]" />
              <div className="flex-1">
                <p className="font-semibold">Unable to load enrollment report</p>
                <p className="text-[#737373] mt-0.5">{enrollmentError}</p>
              </div>
              <button
                onClick={() => fetchEnrollmentData()}
                className="rounded border border-[#171717] bg-[#171717] px-2.5 py-1 text-xs text-white"
              >
                Retry
              </button>
            </div>
          )}

          {/* Table Container */}
          {isEnrollmentLoading ? (
            <StudentListSkeleton rows={8} />
          ) : filteredEnrollmentRows.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#737373] rounded-xl border border-[#E5E5E5] bg-white">
              <Users size={24} className="mx-auto text-[#737373] mb-2" />
              <p className="font-semibold text-[#171717]">No Student Records Matching Criteria</p>
              <p className="text-[11px] text-[#737373] mt-0.5">
                Adjust search queries or clear status filters to view enrollment data.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#E5E5E5] bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E5E5E5] bg-[#F7F7F7] text-[#737373] uppercase font-semibold tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Student ID</th>
                      <th className="py-3 px-4">Full Name</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Enrollment Date</th>
                      <th className="py-3 px-4">Date of Birth</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4 text-right">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5]">
                    {filteredEnrollmentRows.map((s) => {
                      const fullName = [s.first_name, s.middle_name, s.last_name]
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <tr key={s.id} className="hover:bg-[#FAFAFA] transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-[#171717]">
                            <Link href={`/students/${s.id}`} className="hover:underline">
                              {s.student_code}
                            </Link>
                          </td>
                          <td className="py-3 px-4 font-medium text-[#171717]">
                            <Link href={`/students/${s.id}`} className="hover:underline">
                              {fullName}
                            </Link>
                          </td>
                          <td className="py-3 px-4">
                            <StatusBadge status={s.status as StudentStatus} />
                          </td>
                          <td className="py-3 px-4 text-[#737373]">
                            {formatLocalDate(s.enrollment_date)}
                          </td>
                          <td className="py-3 px-4 text-[#737373]">
                            {formatLocalDate(s.date_of_birth)}
                          </td>
                          <td className="py-3 px-4 text-[#737373]">
                            <div>{s.email || '—'}</div>
                            {s.phone && (
                              <div className="text-[11px] text-[#A3A3A3] mt-0.5">{s.phone}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              href={`/students/${s.id}`}
                              className="inline-flex items-center gap-1 rounded border border-[#E5E5E5] px-2 py-1 text-[11px] font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors"
                            >
                              <span>Profile</span>
                              <ArrowUpRight size={11} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="flex items-center justify-between border-t border-[#E5E5E5] px-4 py-3 text-xs text-[#737373] bg-[#FAFAFA]">
                <span>
                  Showing{' '}
                  <strong className="text-[#171717] font-semibold">
                    {filteredEnrollmentRows.length}
                  </strong>{' '}
                  student records
                </span>
                <span>Protected against formula injection in CSV export</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: Attendance Summary Report */}
      {/* ========================================================================= */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* Attendance KPI Strip */}
          {isAttendanceLoading && !attendanceSummary ? (
            <div
              aria-busy="true"
              aria-label="Loading attendance metrics summary"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
            >
              <span className="sr-only">Loading attendance metrics...</span>
              {Array.from({ length: 6 }).map((_, i) => (
                <StatCardSkeleton key={i} />
              ))}
            </div>
          ) : attendanceSummary ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                <span className="text-[11px] font-medium text-[#737373] uppercase tracking-wider block">
                  Students
                </span>
                <p className="mt-1 font-mono text-2xl font-bold text-[#171717]">
                  {attendanceSummary.totalStudents}
                </p>
                <p className="mt-0.5 text-[11px] text-[#737373]">In system</p>
              </div>

              <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                <span className="text-[11px] font-medium text-[#737373] uppercase tracking-wider block">
                  Sessions Logged
                </span>
                <p className="mt-1 font-mono text-2xl font-bold text-[#171717]">
                  {attendanceSummary.totalSessionsRecorded}
                </p>
                <p className="mt-0.5 text-[11px] text-[#737373]">In selected range</p>
              </div>

              <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                <span className="text-[11px] font-medium text-[#737373] uppercase tracking-wider block">
                  Period Rate
                </span>
                <p className="mt-1 font-mono text-2xl font-bold text-[#171717]">
                  {attendanceSummary.overallPercentage !== null
                    ? `${attendanceSummary.overallPercentage}%`
                    : '—'}
                </p>
                <p className="mt-0.5 text-[11px] text-[#737373]">Present / recorded</p>
              </div>

              <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                <span className="text-[11px] font-medium text-[#737373] uppercase tracking-wider block">
                  Total Present
                </span>
                <p className="mt-1 font-mono text-2xl font-bold text-[#171717]">
                  {attendanceSummary.totalPresent}
                </p>
                <p className="mt-0.5 text-[11px] text-[#737373]">Marked present</p>
              </div>

              <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                <span className="text-[11px] font-medium text-[#737373] uppercase tracking-wider block">
                  Total Absent
                </span>
                <p className="mt-1 font-mono text-2xl font-bold text-[#171717]">
                  {attendanceSummary.totalAbsent}
                </p>
                <p className="mt-0.5 text-[11px] text-[#737373]">Marked absent</p>
              </div>

              <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
                <span className="text-[11px] font-medium text-[#737373] uppercase tracking-wider block">
                  Total Late
                </span>
                <p className="mt-1 font-mono text-2xl font-bold text-[#171717]">
                  {attendanceSummary.totalLate}
                </p>
                <p className="mt-0.5 text-[11px] text-[#737373]">Marked late</p>
              </div>
            </div>
          ) : null}

          {/* Date Range Selector & Action Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 rounded-lg border border-[#E5E5E5] bg-white p-3.5">
            <div className="flex flex-wrap items-center gap-3">
              {/* Date pickers */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#737373]">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#737373]">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1 rounded-md border border-[#E5E5E5] bg-[#F7F7F7] p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const today = getLocalTodayString();
                    const past7 = addDaysToDateString(today, -6);
                    setStartDate(past7);
                    setEndDate(today);
                    fetchAttendanceData(past7, today);
                  }}
                  className="rounded px-2 py-1 text-[11px] font-medium text-[#737373] hover:text-[#171717]"
                >
                  7 Days
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = getLocalTodayString();
                    const past14 = addDaysToDateString(today, -13);
                    setStartDate(past14);
                    setEndDate(today);
                    fetchAttendanceData(past14, today);
                  }}
                  className="rounded px-2 py-1 text-[11px] font-medium text-[#737373] hover:text-[#171717]"
                >
                  14 Days
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = getLocalTodayString();
                    const past30 = addDaysToDateString(today, -29);
                    setStartDate(past30);
                    setEndDate(today);
                    fetchAttendanceData(past30, today);
                  }}
                  className="rounded px-2 py-1 text-[11px] font-medium text-[#737373] hover:text-[#171717]"
                >
                  30 Days
                </button>
              </div>

              {/* Apply custom dates */}
              <button
                type="button"
                onClick={() => fetchAttendanceData(startDate, endDate)}
                disabled={isAttendanceLoading || !startDate || !endDate}
                className="rounded-md border border-[#171717] bg-[#171717] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#262626] transition-colors disabled:opacity-50"
              >
                Apply Range
              </button>
            </div>

            {/* Filter Toggle & CSV Export */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[#171717] select-none">
                <input
                  type="checkbox"
                  checked={onlyLowAttendance}
                  onChange={(e) => setOnlyLowAttendance(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-[#E5E5E5] accent-[#171717]"
                />
                <span>Low Attendance (&lt; 75%)</span>
              </label>

              <button
                type="button"
                onClick={exportAttendanceCsv}
                disabled={filteredAttendanceRows.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#262626] transition-colors disabled:opacity-40"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Attendance Error */}
          {attendanceError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[#171717] bg-[#F7F7F7] p-4 text-xs text-[#171717]">
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#171717]" />
              <div className="flex-1">
                <p className="font-semibold">Unable to load attendance report</p>
                <p className="text-[#737373] mt-0.5">{attendanceError}</p>
              </div>
              <button
                onClick={() => fetchAttendanceData(startDate, endDate)}
                className="rounded border border-[#171717] bg-[#171717] px-2.5 py-1 text-xs text-white"
              >
                Retry
              </button>
            </div>
          )}

          {/* Attendance Table */}
          {isAttendanceLoading ? (
            <div className="rounded-xl border border-[#E5E5E5] bg-white overflow-hidden">
              <AttendanceTableSkeleton rows={8} />
            </div>
          ) : filteredAttendanceRows.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#737373] rounded-xl border border-[#E5E5E5] bg-white">
              <CalendarCheck size={24} className="mx-auto text-[#737373] mb-2" />
              <p className="font-semibold text-[#171717]">No Attendance Records Found</p>
              <p className="text-[11px] text-[#737373] mt-0.5">
                No attendance sessions match the selected date range ({startDate} to {endDate}).
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#E5E5E5] bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E5E5E5] bg-[#F7F7F7] text-[#737373] uppercase font-semibold tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Student ID</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Sessions</th>
                      <th className="py-3 px-4">Present</th>
                      <th className="py-3 px-4">Absent</th>
                      <th className="py-3 px-4">Late</th>
                      <th className="py-3 px-4">Attendance Rate</th>
                      <th className="py-3 px-4 text-right">Profile</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5]">
                    {filteredAttendanceRows.map((r) => {
                      const isLow = r.attendance_percentage !== null && r.attendance_percentage < 75;
                      const hasRecorded = r.total_sessions > 0;

                      return (
                        <tr key={r.student_id} className="hover:bg-[#FAFAFA] transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-[#171717]">
                            <Link href={`/students/${r.student_id}`} className="hover:underline">
                              {r.student_code}
                            </Link>
                          </td>
                          <td className="py-3 px-4 font-medium text-[#171717]">
                            <Link href={`/students/${r.student_id}`} className="hover:underline">
                              {r.student_name}
                            </Link>
                          </td>
                          <td className="py-3 px-4 font-mono text-[#171717]">
                            {r.total_sessions}
                          </td>
                          <td className="py-3 px-4 font-mono text-[#171717]">
                            {r.present_count}
                          </td>
                          <td className="py-3 px-4 font-mono text-[#737373]">
                            {r.absent_count}
                          </td>
                          <td className="py-3 px-4 font-mono text-[#737373]">
                            {r.late_count}
                          </td>
                          <td className="py-3 px-4">
                            {hasRecorded ? (
                              <div className="flex items-center gap-2.5">
                                <div className="w-16 h-2 rounded-full bg-[#E5E5E5] overflow-hidden">
                                  <div
                                    className="h-full bg-[#171717]"
                                    style={{ width: `${r.attendance_percentage}%` }}
                                  />
                                </div>
                                <span className="font-mono font-semibold text-[#171717]">
                                  {r.attendance_percentage}%
                                </span>
                                {isLow && (
                                  <span
                                    className="inline-flex items-center gap-1 rounded border border-[#171717] bg-[#F7F7F7] px-1.5 py-0.5 text-[10px] font-medium text-[#171717]"
                                    title="Student attendance is under institutional threshold (75%)"
                                  >
                                    <AlertTriangle size={10} />
                                    <span>Low</span>
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#A3A3A3]">No sessions</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              href={`/students/${r.student_id}`}
                              className="inline-flex items-center gap-1 rounded border border-[#E5E5E5] px-2 py-1 text-[11px] font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors"
                            >
                              <span>View</span>
                              <ArrowUpRight size={11} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="flex items-center justify-between border-t border-[#E5E5E5] px-4 py-3 text-xs text-[#737373] bg-[#FAFAFA]">
                <span>
                  Date Range: <strong className="text-[#171717]">{startDate}</strong> to{' '}
                  <strong className="text-[#171717]">{endDate}</strong>
                </span>
                <span>Calculated per-student attendance rate from recorded sessions</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: Document Verification Summary */}
      {/* ========================================================================= */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          {/* Category Breakdown Cards */}
          {isDocLoading && categorySummary.length === 0 ? (
            <div aria-busy="true" aria-label="Loading document categories">
              <span className="sr-only">Loading document category breakdown...</span>
              <h2 className="text-xs font-semibold text-[#171717] mb-2 uppercase tracking-wider">
                Document Category Pipeline
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-[#E5E5E5] bg-white p-3.5 space-y-2">
                    <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-6" />
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <Skeleton className="h-8 rounded" />
                      <Skeleton className="h-8 rounded" />
                      <Skeleton className="h-8 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : categorySummary.length > 0 ? (
            <div>
              <h2 className="text-xs font-semibold text-[#171717] mb-2 uppercase tracking-wider">
                Document Category Pipeline
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {categorySummary.map((cat) => (
                  <div
                    key={cat.category}
                    className="rounded-xl border border-[#E5E5E5] bg-white p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-1.5">
                      <span className="text-xs font-medium text-[#171717] truncate">
                        {cat.category_label}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#171717]">
                        {cat.total}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[10px] text-center">
                      <div className="bg-[#F7F7F7] rounded p-1">
                        <span className="text-[#737373] block">Pending</span>
                        <span className="font-mono font-bold text-[#171717]">
                          {cat.pending}
                        </span>
                      </div>
                      <div className="bg-[#F7F7F7] rounded p-1">
                        <span className="text-[#737373] block">Verified</span>
                        <span className="font-mono font-bold text-[#171717]">
                          {cat.verified}
                        </span>
                      </div>
                      <div className="bg-[#F7F7F7] rounded p-1">
                        <span className="text-[#737373] block">Rejected</span>
                        <span className="font-mono font-bold text-[#171717]">
                          {cat.rejected}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Action & Filter Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-lg border border-[#E5E5E5] bg-white p-3">
            <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]"
                />
                <input
                  type="text"
                  placeholder="Filter by student ID, student name, or filename..."
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  className="w-full rounded-md border border-[#E5E5E5] bg-white py-1.5 pl-9 pr-3 text-xs text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none"
                />
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#737373] shrink-0">Category:</span>
                <select
                  value={docCategoryFilter}
                  onChange={(e) => setDocCategoryFilter(e.target.value)}
                  className="rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  <option value="student_photograph">Photograph</option>
                  <option value="identity_document">Identity Document</option>
                  <option value="academic_marksheet">Marksheet</option>
                  <option value="enrollment_document">Enrollment Doc</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#737373] shrink-0">Status:</span>
                <select
                  value={docStatusFilter}
                  onChange={(e) => setDocStatusFilter(e.target.value)}
                  className="rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Buttons: Refresh and Export CSV */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => fetchDocumentData()}
                disabled={isDocLoading}
                className="flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] hover:border-[#171717] transition-colors disabled:opacity-50"
                title="Refresh documents"
              >
                <RotateCw size={13} className={isDocLoading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={exportDocumentsCsv}
                disabled={filteredDocumentRows.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#262626] transition-colors disabled:opacity-40"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Doc Error */}
          {docError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[#171717] bg-[#F7F7F7] p-4 text-xs text-[#171717]">
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#171717]" />
              <div className="flex-1">
                <p className="font-semibold">Unable to load document report</p>
                <p className="text-[#737373] mt-0.5">{docError}</p>
              </div>
              <button
                onClick={() => fetchDocumentData()}
                className="rounded border border-[#171717] bg-[#171717] px-2.5 py-1 text-xs text-white"
              >
                Retry
              </button>
            </div>
          )}

          {/* Documents Table */}
          {isDocLoading ? (
            <DocumentListSkeleton count={4} />
          ) : filteredDocumentRows.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#737373] rounded-xl border border-[#E5E5E5] bg-white">
              <FileCheck size={24} className="mx-auto text-[#737373] mb-2" />
              <p className="font-semibold text-[#171717]">No Documents Matching Filter</p>
              <p className="text-[11px] text-[#737373] mt-0.5">
                Upload student documents through the student profile to populate this report.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#E5E5E5] bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E5E5E5] bg-[#F7F7F7] text-[#737373] uppercase font-semibold tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Student ID</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Filename</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Rejection Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5]">
                    {filteredDocumentRows.map((doc) => (
                      <tr key={doc.id} className="hover:bg-[#FAFAFA] transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-[#171717]">
                          {doc.student_code}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#171717]">
                          {doc.student_name}
                        </td>
                        <td className="py-3 px-4 text-[#737373]">
                          {doc.category_label}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-[#171717] max-w-xs truncate">
                          {doc.original_filename}
                        </td>
                        <td className="py-3 px-4">
                          {doc.verification_status === 'verified' ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#171717] px-2.5 py-0.5 text-[11px] font-medium text-white">
                              <CheckCircle2 size={11} />
                              <span>Verified</span>
                            </span>
                          ) : doc.verification_status === 'rejected' ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#171717] bg-white px-2.5 py-0.5 text-[11px] font-medium text-[#171717]">
                              <XCircle size={11} />
                              <span>Rejected</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-[#F7F7F7] px-2.5 py-0.5 text-[11px] font-medium text-[#737373]">
                              <Clock size={11} />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#737373]">
                          {doc.verified_at
                            ? formatLocalDate(doc.verified_at)
                            : formatLocalDate(doc.created_at)}
                        </td>
                        <td className="py-3 px-4 text-[#737373] text-[11px] max-w-xs truncate">
                          {doc.rejection_reason || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="flex items-center justify-between border-t border-[#E5E5E5] px-4 py-3 text-xs text-[#737373] bg-[#FAFAFA]">
                <span>
                  Showing{' '}
                  <strong className="text-[#171717] font-semibold">
                    {filteredDocumentRows.length}
                  </strong>{' '}
                  documents
                </span>
                <span>Protected against formula injection in CSV export</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
