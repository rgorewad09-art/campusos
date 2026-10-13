import React from 'react';
import Skeleton from './Skeleton';

interface StatCardSkeletonProps {
  className?: string;
}

/**
 * Skeleton placeholder for dashboard and attendance summary KPI cards.
 * Prevents layout shifts by maintaining exact proportions of StatCard.
 */
export default function StatCardSkeleton({ className = '' }: StatCardSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-xl border border-[#E5E5E5] bg-white p-4 sm:p-5 ${className}`}
    >
      {/* Top label + icon */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>

      {/* Primary KPI Value */}
      <div className="mt-3">
        <Skeleton className="h-8 w-20 sm:w-28" />
      </div>

      {/* Subtitle / context description */}
      <div className="mt-2.5">
        <Skeleton className="h-3 w-36 max-w-full" />
      </div>
    </div>
  );
}
