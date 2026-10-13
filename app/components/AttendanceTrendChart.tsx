'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import type { AttendanceAnalyticsData } from '@/src/types/analytics';
import { getAttendanceAnalyticsAction } from '@/app/actions/analytics';
import ChartSkeleton from '@/src/components/skeletons/ChartSkeleton';

export default function AttendanceTrendChart() {
  const [rangeDays, setRangeDays] = useState<number>(7);
  const [analytics, setAnalytics] = useState<AttendanceAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getAttendanceAnalyticsAction(rangeDays);
      if (!res.success || !res.data) {
        setError(res.error || 'Failed to load attendance trends.');
      } else {
        setAnalytics(res.data);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Error loading attendance trends.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  if (isLoading) {
    return <ChartSkeleton bars={rangeDays} />;
  }

  return (
    <section
      aria-labelledby="attendance-analytics-heading"
      className="rounded-xl border border-[#E5E5E5] bg-white p-5 sm:p-6"
    >
      {/* Header with Title and Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E5E5E5] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2
              id="attendance-analytics-heading"
              className="text-sm font-semibold text-[#171717] flex items-center gap-1.5"
            >
              <TrendingUp size={16} />
              <span>Attendance Trends & Analytics</span>
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-[#737373]">
            Daily attendance rate and session volumes across recorded dates.
          </p>
        </div>

        {/* Date range filter buttons */}
        <div className="flex items-center gap-1 self-start sm:self-auto rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-1">
          <button
            type="button"
            onClick={() => setRangeDays(7)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              rangeDays === 7
                ? 'bg-white text-[#171717] shadow-sm'
                : 'text-[#737373] hover:text-[#171717]'
            }`}
          >
            7 Days
          </button>
          <button
            type="button"
            onClick={() => setRangeDays(14)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              rangeDays === 14
                ? 'bg-white text-[#171717] shadow-sm'
                : 'text-[#737373] hover:text-[#171717]'
            }`}
          >
            14 Days
          </button>
          <button
            type="button"
            onClick={() => setRangeDays(30)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              rangeDays === 30
                ? 'bg-white text-[#171717] shadow-sm'
                : 'text-[#737373] hover:text-[#171717]'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* Aggregate Metrics Header Strip */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-b border-[#E5E5E5] text-xs">
          <div>
            <span className="text-[#737373] block text-[11px]">Period Rate</span>
            <span className="font-mono text-xl font-bold text-[#171717]">
              {analytics.averagePercentage !== null ? `${analytics.averagePercentage}%` : '—'}
            </span>
          </div>
          <div>
            <span className="text-[#737373] block text-[11px]">Total Present</span>
            <span className="font-mono text-xl font-bold text-[#171717]">
              {analytics.totalPresent}
            </span>
          </div>
          <div>
            <span className="text-[#737373] block text-[11px]">Total Absent</span>
            <span className="font-mono text-xl font-bold text-[#171717]">
              {analytics.totalAbsent}
            </span>
          </div>
          <div>
            <span className="text-[#737373] block text-[11px]">Total Late</span>
            <span className="font-mono text-xl font-bold text-[#171717]">
              {analytics.totalLate}
            </span>
          </div>
        </div>
      )}

      {/* Main Chart Body */}
      <div className="pt-4">
        {error ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-[#171717] bg-[#F7F7F7] p-4 text-xs text-[#171717]">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#171717]" />
            <div className="flex-1">
              <p className="font-semibold">Unable to load trend data</p>
              <p className="text-[#737373] mt-0.5">{error}</p>
            </div>
            <button
              onClick={fetchTrends}
              className="rounded border border-[#171717] bg-[#171717] px-2.5 py-1 text-xs text-white"
            >
              Retry
            </button>
          </div>
        ) : !analytics || analytics.totalSessionsRecorded === 0 ? (
          <div className="py-12 text-center text-xs text-[#737373]">
            <Calendar size={22} className="mx-auto text-[#737373] mb-1.5" />
            <p className="font-medium text-[#171717]">No Attendance Sessions in Range</p>
            <p className="text-[11px] text-[#737373] mt-0.5">
              Record daily attendance on the Attendance page to generate historical visual trends.
            </p>
          </div>
        ) : (
          <div>
            {/* Visual Bar Chart */}
            <div className="h-48 flex items-end gap-1.5 sm:gap-2 pt-6 pb-2">
              {analytics.dailyTrends.map((trend) => {
                const heightPercent = trend.percentage !== null ? Math.max(8, trend.percentage) : 0;
                const hasData = trend.totalRecorded > 0;

                return (
                  <div
                    key={trend.date}
                    className="flex-1 flex flex-col items-center h-full justify-end group relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center rounded-md bg-[#111111] px-2.5 py-1.5 text-[10px] text-white shadow-lg pointer-events-none whitespace-nowrap">
                      <span className="font-semibold">{trend.displayDate}</span>
                      <span>
                        {hasData
                          ? `${trend.percentage}% • ${trend.present}P, ${trend.absent}A, ${trend.late}L`
                          : 'No session'}
                      </span>
                    </div>

                    {/* Bar */}
                    {hasData ? (
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-full rounded-t bg-[#171717] hover:bg-[#333333] transition-all relative flex flex-col justify-between p-0.5"
                      >
                        <span className="text-[9px] font-mono text-white text-center select-none hidden md:block">
                          {trend.percentage}%
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-1 bg-[#E5E5E5] rounded-t" />
                    )}

                    {/* Day label */}
                    <span className="text-[9px] sm:text-[10px] text-[#737373] mt-2 font-mono truncate max-w-full">
                      {rangeDays <= 14
                        ? trend.displayDate.split(' ')[1]
                        : trend.displayDate.split(' ')[1]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Chart footer footnote */}
            <div className="mt-3 flex items-center justify-between text-[11px] text-[#737373] border-t border-[#E5E5E5] pt-2">
              <span>
                Window: {analytics.startDate} to {analytics.endDate}
              </span>
              <span>
                Bar heights represent attendance % among recorded sessions
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
