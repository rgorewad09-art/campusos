import React from 'react';
import Skeleton from './Skeleton';

interface DocumentListSkeletonProps {
  count?: number;
}

/**
 * Skeleton placeholder for student document lists and document verification reports.
 */
export default function DocumentListSkeleton({ count = 3 }: DocumentListSkeletonProps) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading student documents"
      className="space-y-4"
    >
      <span className="sr-only">Loading document records...</span>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="rounded-xl border border-[#E5E5E5] bg-white p-5 flex flex-col gap-4"
        >
          {/* Main Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Left: Icon and Details */}
            <div className="flex items-center gap-3.5 min-w-0">
              <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-44" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Skeleton className="h-7 w-16 rounded-md" />
              <Skeleton className="h-7 w-16 rounded-md" />
              <Skeleton className="h-7 w-16 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
