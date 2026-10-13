'use client';

import { useState, useEffect } from 'react';
import {
  CalendarCheck,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import type { Student } from '@/src/types/student';
import type { AttendanceRecord, StudentAttendanceStats } from '@/src/types/attendance';
import { getStudentAttendanceHistoryAction } from '@/app/actions/attendance';
import StudentAttendanceHistoryModal from '@/app/attendance/components/StudentAttendanceHistoryModal';

interface StudentAttendanceSectionProps {
  student: Student;
}

export default function StudentAttendanceSection({
  student,
}: StudentAttendanceSectionProps) {
  const [stats, setStats] = useState<StudentAttendanceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    getStudentAttendanceHistoryAction(student.id)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.stats) {
          setStats(res.stats);
        }
      })
      .catch((err) => {
        console.error('Error fetching student attendance summary:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [student.id]);

  return (
    <section
      aria-labelledby="student-attendance-heading"
      className="rounded-xl border border-[#E5E5E5] bg-white p-6 sm:p-8"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E5E5E5] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h2
              id="student-attendance-heading"
              className="text-base font-semibold text-[#171717]"
            >
              Attendance Record
            </h2>
            {stats && stats.totalSessions > 0 && (
              <span className="rounded-full bg-[#F7F7F7] border border-[#E5E5E5] px-2 py-0.5 text-[11px] font-medium text-[#737373]">
                {stats.totalSessions} sessions
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#737373]">
            Track record across all recorded academic sessions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3.5 py-2 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors self-start sm:self-auto"
        >
          <ExternalLink size={13} />
          <span>View Session Log</span>
        </button>
      </div>

      {/* Content */}
      <div className="mt-6">
        {isLoading ? (
          <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin text-[#171717]" />
            <p className="text-xs text-[#737373]">Loading attendance metrics...</p>
          </div>
        ) : !stats || stats.totalSessions === 0 ? (
          <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-6 text-center text-xs text-[#737373]">
            <CalendarCheck size={20} className="mx-auto mb-1 text-[#737373]" />
            <p className="font-medium text-[#171717]">No recorded attendance sessions yet</p>
            <p className="text-[11px] text-[#737373] mt-0.5">
              Attendance percentages will appear once daily attendance is recorded for this student.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Percentage banner */}
            <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
                  Attendance Rate
                </span>
                <p className="font-mono text-3xl font-bold tracking-tight text-[#171717] mt-1">
                  {stats.percentage !== null ? `${stats.percentage}%` : '—'}
                </p>
              </div>
              <p className="text-[10px] text-[#737373] mt-2">
                Among {stats.totalSessions} recorded sessions
              </p>
            </div>

            {/* Present */}
            <div className="rounded-lg border border-[#E5E5E5] bg-white p-4">
              <div className="flex items-center justify-between text-[#737373]">
                <span className="text-xs font-medium">Present</span>
                <CheckCircle2 size={15} className="text-[#171717]" />
              </div>
              <p className="font-mono text-2xl font-bold text-[#171717] mt-2">
                {stats.presentCount}
              </p>
              <p className="text-[11px] text-[#A3A3A3] mt-1">
                Sessions attended
              </p>
            </div>

            {/* Absent */}
            <div className="rounded-lg border border-[#E5E5E5] bg-white p-4">
              <div className="flex items-center justify-between text-[#737373]">
                <span className="text-xs font-medium">Absent</span>
                <XCircle size={15} className="text-[#171717]" />
              </div>
              <p className="font-mono text-2xl font-bold text-[#171717] mt-2">
                {stats.absentCount}
              </p>
              <p className="text-[11px] text-[#A3A3A3] mt-1">
                Recorded absences
              </p>
            </div>

            {/* Late */}
            <div className="rounded-lg border border-[#E5E5E5] bg-white p-4">
              <div className="flex items-center justify-between text-[#737373]">
                <span className="text-xs font-medium">Late</span>
                <Clock size={15} className="text-[#171717]" />
              </div>
              <p className="font-mono text-2xl font-bold text-[#171717] mt-2">
                {stats.lateCount}
              </p>
              <p className="text-[11px] text-[#A3A3A3] mt-1">
                Late arrivals
              </p>
            </div>
          </div>
        )}
      </div>

      {/* History Modal */}
      <StudentAttendanceHistoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        student={student}
      />
    </section>
  );
}
