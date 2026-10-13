import React from 'react';
import Skeleton from './Skeleton';

interface StudentListSkeletonProps {
  rows?: number;
}

/**
 * Full skeleton layout for the Student Directory.
 * Renders desktop table rows and mobile card skeletons with an accessible loading state.
 */
export default function StudentListSkeleton({ rows = 6 }: StudentListSkeletonProps) {
  return (
    <div aria-busy="true" aria-label="Loading student records" className="space-y-4">
      <span className="sr-only">Loading student directory...</span>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-lg border border-[#E5E5E5] bg-white overflow-hidden">
        <table className="w-full text-left text-xs" aria-hidden="true">
          <thead className="border-b border-[#E5E5E5] bg-[#F7F7F7] text-[#737373] uppercase font-semibold text-[10px]">
            <tr>
              <th className="py-3 px-4">Student ID</th>
              <th className="py-3 px-4">Student Name</th>
              <th className="py-3 px-4">Contact</th>
              <th className="py-3 px-4">Enrollment Date</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E5]">
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="hover:bg-[#FAFAFA]/50 transition-colors">
                {/* Student Code */}
                <td className="py-3.5 px-4">
                  <Skeleton className="h-4 w-20" />
                </td>
                {/* Name + Avatar */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                </td>
                {/* Contact */}
                <td className="py-3.5 px-4 space-y-1">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-24" />
                </td>
                {/* Enrollment Date */}
                <td className="py-3.5 px-4">
                  <Skeleton className="h-3.5 w-24" />
                </td>
                {/* Status */}
                <td className="py-3.5 px-4">
                  <Skeleton className="h-5 w-16 rounded-full" />
                </td>
                {/* Actions */}
                <td className="py-3.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Skeleton className="h-6 w-6 rounded" />
                    <Skeleton className="h-6 w-6 rounded" />
                    <Skeleton className="h-6 w-6 rounded" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View */}
      <div className="md:hidden space-y-3" aria-hidden="true">
        {Array.from({ length: Math.min(rows, 4) }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[#E5E5E5] bg-white p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-b border-[#F0F0F0] py-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-28" />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Skeleton className="h-6 w-16 rounded" />
              <Skeleton className="h-6 w-14 rounded" />
              <Skeleton className="h-6 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Footer Skeleton */}
      <div
        aria-hidden="true"
        className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#E5E5E5] pt-4"
      >
        <Skeleton className="h-3.5 w-40" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-16 rounded-md" />
        </div>
      </div>
    </div>
  );
}
