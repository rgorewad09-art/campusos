import React from 'react';
import Skeleton from './Skeleton';
import StatCardSkeleton from './StatCardSkeleton';
import ChartSkeleton from './ChartSkeleton';

/**
 * Full dashboard skeleton matching the CampusOS administrative dashboard layout.
 */
export default function DashboardSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading dashboard analytics and overview"
      className="flex flex-col gap-8"
    >
      <span className="sr-only">Loading dashboard metrics...</span>

      {/* Top Greeting and Refresh Action */}
      <div
        aria-hidden="true"
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-72 max-w-full" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md shrink-0 self-start sm:self-auto" />
      </div>

      {/* 4 Primary Metric Cards */}
      <div
        aria-hidden="true"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Secondary Operational Strips */}
      <div
        aria-hidden="true"
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        {/* Today's Attendance Operational Status */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-2 space-y-1.5">
                <Skeleton className="h-2.5 w-12 mx-auto" />
                <Skeleton className="h-5 w-8 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Document Verification Health */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-2 space-y-1.5">
                <Skeleton className="h-2.5 w-12 mx-auto" />
                <Skeleton className="h-5 w-8 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Attendance Trends & Analytics Visualizer */}
      <ChartSkeleton bars={7} />

      {/* Bottom Grid: Live Audit Activity + Quick Actions */}
      <div
        aria-hidden="true"
        className="grid grid-cols-1 gap-6 lg:grid-cols-3"
      >
        {/* Recent Audit Activity Skeleton (spans 2 columns) */}
        <div className="lg:col-span-2 rounded-xl border border-[#E5E5E5] bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>

          <div className="divide-y divide-[#E5E5E5]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="py-3 flex items-start gap-3">
                <Skeleton className="h-7 w-7 rounded-md shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3.5 w-36" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions Skeleton */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-5 space-y-4">
          <Skeleton className="h-4 w-28" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-[#E5E5E5] p-3"
              >
                <Skeleton className="h-8 w-8 rounded-md shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
