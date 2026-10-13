'use client';

import { useState, useEffect } from 'react';
import {
  X,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import type { Student } from '@/src/types/student';
import type { AttendanceRecord, StudentAttendanceStats } from '@/src/types/attendance';
import { getStudentAttendanceHistoryAction } from '@/app/actions/attendance';
import { formatLocalDate } from '@/src/lib/dateUtils';

interface StudentAttendanceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
}

export default function StudentAttendanceHistoryModal({
  isOpen,
  onClose,
  student,
}: StudentAttendanceHistoryModalProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<StudentAttendanceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !student) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    getStudentAttendanceHistoryAction(student.id)
      .then((res) => {
        if (!isMounted) return;
        if (!res.success) {
          setError(res.error || 'Failed to retrieve attendance history.');
        } else {
          setRecords(res.records || []);
          setStats(res.stats || null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, student]);

  if (!isOpen || !student) return null;

  const fullName = [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(' ');

  function renderStatusBadge(status: string) {
    switch (status) {
      case 'present':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#171717] px-2 py-0.5 text-[11px] font-medium text-white">
            <CheckCircle2 size={10} />
            <span>Present</span>
          </span>
        );
      case 'absent':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#171717] bg-white px-2 py-0.5 text-[11px] font-medium text-[#171717]">
            <XCircle size={10} />
            <span>Absent</span>
          </span>
        );
      case 'late':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#E5E5E5] bg-[#F7F7F7] px-2 py-0.5 text-[11px] font-medium text-[#737373]">
            <Clock size={10} />
            <span>Late</span>
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-history-title"
    >
      <div className="relative w-full max-w-xl rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl my-8 max-h-[90vh] flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#171717] text-white">
              <CalendarCheck size={18} />
            </div>
            <div>
              <h3 id="attendance-history-title" className="text-base font-semibold text-[#171717]">
                Attendance History
              </h3>
              <p className="text-xs text-[#737373]">
                {fullName} • <span className="font-mono">{student.student_code}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#737373] hover:text-[#171717] hover:bg-[#F7F7F7] transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto pt-4 space-y-4">
          {/* Loading */}
          {isLoading && (
            <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
              <Loader2 size={20} className="animate-spin text-[#171717]" />
              <p className="text-xs text-[#737373]">Loading attendance history...</p>
            </div>
          )}

          {/* Error */}
          {!isLoading && error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[#171717] bg-[#F7F7F7] p-3 text-xs text-[#171717]">
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#171717]" />
              <span>{error}</span>
            </div>
          )}

          {/* Stats Breakdown */}
          {!isLoading && !error && stats && (
            <>
              {/* Main percentage banner */}
              <div className="rounded-xl border border-[#E5E5E5] bg-[#F7F7F7] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                    Attendance Rate
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-mono text-3xl font-bold tracking-tight text-[#171717]">
                      {stats.percentage !== null ? `${stats.percentage}%` : '—'}
                    </span>
                    <span className="text-xs text-[#737373]">
                      ({stats.presentCount} of {stats.totalSessions} sessions)
                    </span>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[10px] bg-white border border-[#E5E5E5] px-2 py-1 rounded text-[#737373] inline-block font-medium">
                    Calculated among recorded sessions only
                  </span>
                </div>
              </div>

              {/* Counts row */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-[#E5E5E5] bg-white p-2.5">
                  <span className="text-[11px] text-[#737373] block">Present</span>
                  <span className="font-mono font-bold text-sm text-[#171717]">
                    {stats.presentCount}
                  </span>
                </div>
                <div className="rounded-lg border border-[#E5E5E5] bg-white p-2.5">
                  <span className="text-[11px] text-[#737373] block">Absent</span>
                  <span className="font-mono font-bold text-sm text-[#171717]">
                    {stats.absentCount}
                  </span>
                </div>
                <div className="rounded-lg border border-[#E5E5E5] bg-white p-2.5">
                  <span className="text-[11px] text-[#737373] block">Late</span>
                  <span className="font-mono font-bold text-sm text-[#171717]">
                    {stats.lateCount}
                  </span>
                </div>
              </div>

              {/* Sessions list */}
              <div>
                <h4 className="text-xs font-semibold text-[#171717] mb-2">
                  Recorded Sessions ({records.length})
                </h4>

                {records.length === 0 ? (
                  <div className="rounded-lg border border-[#E5E5E5] bg-white p-6 text-center text-xs text-[#737373]">
                    <FileText size={20} className="mx-auto mb-1 text-[#737373]" />
                    No attendance records exist yet for this student.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E5E5E5] rounded-lg border border-[#E5E5E5] bg-white max-h-60 overflow-y-auto">
                    {records.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between p-3 text-xs hover:bg-[#F7F7F7] transition-colors"
                      >
                        <div>
                          <p className="font-medium text-[#171717]">
                            {formatLocalDate(r.attendance_date)}
                          </p>
                          {r.remarks && (
                            <p className="text-[11px] text-[#737373] mt-0.5">
                              Remarks: {r.remarks}
                            </p>
                          )}
                        </div>
                        <div>{renderStatusBadge(r.status)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 border-t border-[#E5E5E5] pt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#171717] bg-[#171717] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
