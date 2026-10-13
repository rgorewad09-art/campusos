import React from 'react';
import Skeleton from './Skeleton';

/**
 * Skeleton layout for the student profile view (/students/[id]).
 * Mirrors the exact hero card, demographic grid, guardian, and document containers.
 */
export default function StudentProfileSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading student profile"
      className="max-w-5xl mx-auto flex flex-col gap-6"
    >
      <span className="sr-only">Loading student profile details...</span>

      {/* Back link */}
      <div aria-hidden="true">
        <Skeleton className="h-4 w-36" />
      </div>

      {/* Header Hero Card */}
      <div
        aria-hidden="true"
        className="rounded-xl border border-[#E5E5E5] bg-white p-6 sm:p-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-full shrink-0" />
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-32" />
              </div>
            </div>
          </div>

          <Skeleton className="h-8 w-28 rounded-md shrink-0" />
        </div>
      </div>

      {/* Academic & Personal Details Card */}
      <div
        aria-hidden="true"
        className="rounded-xl border border-[#E5E5E5] bg-white p-6 sm:p-8"
      >
        <div className="border-b border-[#E5E5E5] pb-4 mb-6 space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>

        {/* 6-8 information tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-[#E5E5E5] bg-white p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-4 rounded" />
              </div>
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>

      {/* Guardian Section Skeleton */}
      <div
        aria-hidden="true"
        className="rounded-xl border border-[#E5E5E5] bg-white p-6 sm:p-8 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
          <div className="space-y-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-7 w-28 rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-[#E5E5E5] p-4 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="rounded-lg border border-[#E5E5E5] p-4 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      </div>

      {/* Documents Section Skeleton */}
      <div
        aria-hidden="true"
        className="rounded-xl border border-[#E5E5E5] bg-white p-6 sm:p-8 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
          <div className="space-y-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-7 w-28 rounded-md" />
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-[#E5E5E5] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <Skeleton className="h-6 w-20 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
