import React from 'react';
import Skeleton from './Skeleton';

interface ChartSkeletonProps {
  bars?: number;
}

// Fixed deterministic bar heights to avoid server/client hydration mismatch
const STATIC_BAR_HEIGHTS = ['45%', '70%', '60%', '85%', '75%', '90%', '65%', '80%', '55%', '95%', '70%', '85%', '60%', '75%'];

/**
 * Skeleton placeholder for the Attendance Trend Chart.
 * Prevents layout jumps by preserving the exact chart aspect ratio, KPI strip, and bar distribution.
 */
export default function ChartSkeleton({ bars = 7 }: ChartSkeletonProps) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading attendance trends chart"
      className="rounded-xl border border-[#E5E5E5] bg-white p-5 sm:p-6"
    >
      <span className="sr-only">Loading attendance trend metrics...</span>

      {/* Header with Title and Range Selector */}
      <div
        aria-hidden="true"
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E5E5E5] pb-4"
      >
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>

        {/* 7/14/30 day toggle pill */}
        <div className="flex items-center gap-1 rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-1 self-start sm:self-auto">
          <Skeleton className="h-6 w-14 rounded-md" />
          <Skeleton className="h-6 w-14 rounded-md" />
          <Skeleton className="h-6 w-14 rounded-md" />
        </div>
      </div>

      {/* Aggregate KPI Strip */}
      <div
        aria-hidden="true"
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-b border-[#E5E5E5]"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>

      {/* Main Bar Chart Placeholder */}
      <div aria-hidden="true" className="pt-4">
        <div className="h-48 flex items-end gap-2 sm:gap-3 pt-6 pb-2">
          {Array.from({ length: bars }).map((_, i) => {
            const height = STATIC_BAR_HEIGHTS[i % STATIC_BAR_HEIGHTS.length];
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center h-full justify-end"
              >
                <div
                  style={{ height }}
                  className="w-full rounded-t shimmer-effect"
                />
                <Skeleton className="h-2.5 w-6 mt-2" />
              </div>
            );
          })}
        </div>

        {/* Footer info line */}
        <div className="mt-3 flex items-center justify-between border-t border-[#E5E5E5] pt-2">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-3 w-48 hidden sm:block" />
        </div>
      </div>
    </div>
  );
}
