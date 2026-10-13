'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '../components/AppShell';
import AttendanceDatePicker from './components/AttendanceDatePicker';
import AttendanceSummaryCards from './components/AttendanceSummaryCards';
import AttendanceSheet from './components/AttendanceSheet';
import { getDailyAttendanceAction } from '@/app/actions/attendance';
import { getLocalTodayString } from '@/src/lib/dateUtils';
import type { Student } from '@/src/types/student';
import type {
  AttendanceRecord,
  StudentAttendanceStats,
  DailyAttendanceSummary,
} from '@/src/types/attendance';
import { AlertCircle } from 'lucide-react';

export default function AttendanceView() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, StudentAttendanceStats>>({});
  const [summary, setSummary] = useState<DailyAttendanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDate(getLocalTodayString());
  }, []);

  const fetchAttendance = useCallback(async () => {
    if (!selectedDate) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await getDailyAttendanceAction(selectedDate);
      if (!res.success) {
        setError(res.error || 'Failed to retrieve attendance data.');
      } else {
        setStudents(res.students || []);
        setRecords(res.records || []);
        setStatsMap(res.statsMap || {});
        setSummary(res.summary || null);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'An error occurred while loading attendance.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  return (
    <AppShell pageTitle="Attendance">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Subtitle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#171717]">
              Daily Attendance Management
            </h1>
            <p className="text-xs text-[#737373] mt-0.5">
              Record, review, and adjust daily student presence, absences, and late arrivals.
            </p>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-[#171717] bg-white p-4 text-xs text-[#171717]">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#171717]" />
            <div className="flex-1">
              <p className="font-semibold">Unable to load attendance</p>
              <p className="mt-0.5 text-[#737373]">{error}</p>
            </div>
            <button
              onClick={fetchAttendance}
              className="rounded border border-[#171717] bg-[#171717] px-3 py-1 text-xs text-white hover:bg-[#262626] transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Date Selector Banner */}
        <AttendanceDatePicker
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          disabled={isLoading}
        />

        {/* Attendance Metric Counters */}
        <AttendanceSummaryCards summary={summary} isLoading={isLoading} />

        {/* Interactive Attendance Sheet */}
        <AttendanceSheet
          selectedDate={selectedDate}
          students={students}
          records={records}
          statsMap={statsMap}
          onRefresh={fetchAttendance}
          isLoading={isLoading}
        />
      </div>
    </AppShell>
  );
}
