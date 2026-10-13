'use client';

import { useState, useEffect, useCallback } from 'react';
import { RotateCw, AlertCircle } from 'lucide-react';
import DashboardStatCards from './components/DashboardStatCards';
import AttendanceTrendChart from './components/AttendanceTrendChart';
import RecentActivity from './components/RecentActivity';
import QuickActions from './components/QuickActions';
import { getDashboardStatsAction } from '@/app/actions/analytics';
import type { DashboardStats } from '@/src/types/analytics';

export default function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getDashboardStatsAction();
      if (!res.success || !res.stats) {
        setError(res.error || 'Failed to retrieve dashboard statistics.');
      } else {
        setStats(res.stats);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Error retrieving dashboard statistics.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="flex flex-col gap-8">
      {/* Top Greeting and Refresh Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#171717]">
            Good morning, Administrator
          </h2>
          <p className="mt-1 text-xs text-[#737373]">
            Here&rsquo;s an overview of CampusOS operational activity and live metrics.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchStats}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] hover:border-[#171717] transition-colors disabled:opacity-50 self-start sm:self-auto"
          title="Refresh dashboard metrics"
        >
          <RotateCw size={13} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Error alert if stats failed */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-[#171717] bg-[#F7F7F7] p-4 text-xs text-[#171717]">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#171717]" />
          <div className="flex-1">
            <p className="font-semibold">Unable to load live dashboard statistics</p>
            <p className="text-[#737373] mt-0.5">{error}</p>
          </div>
          <button
            onClick={fetchStats}
            className="rounded border border-[#171717] bg-[#171717] px-2.5 py-1 text-xs text-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* Primary and Secondary Live Stat Cards */}
      <section aria-labelledby="stats-heading">
        <h3 id="stats-heading" className="sr-only">
          Dashboard statistics
        </h3>
        <DashboardStatCards stats={stats} isLoading={isLoading} />
      </section>

      {/* Attendance Trends & Analytics Visualizer */}
      <AttendanceTrendChart />

      {/* Bottom Grid: Live Audit Activity + Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Audit Activity Stream */}
        <div className="lg:col-span-2">
          <RecentActivity />
        </div>

        {/* Quick Actions Strip */}
        <div>
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
