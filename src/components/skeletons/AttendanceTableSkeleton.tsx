import React from 'react';
import Skeleton from './Skeleton';

interface AttendanceTableSkeletonProps {
  rows?: number;
}

/**
 * Attendance table skeleton matching AttendanceSheet column widths and spacing.
 * Uses neutral grey placeholders for status pills to prevent any confusion with actual attendance statuses.
 */
export default function AttendanceTableSkeleton({ rows = 6 }: AttendanceTableSkeletonProps) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading student attendance roster"
      className="overflow-x-auto"
    >
      <span className="sr-only">Loading eligible student attendance...</span>
      <table className="w-full text-left text-xs" aria-hidden="true">
        <thead className="border-b border-[#E5E5E5] bg-[#F7F7F7] text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
          <tr>
            <th scope="col" className="px-5 py-3 w-[260px]">
              Student
            </th>
            <th scope="col" className="px-5 py-3 w-[140px]">
              Code
            </th>
            <th scope="col" className="px-5 py-3 w-[160px]">
              Historical Attendance
            </th>
            <th scope="col" className="px-5 py-3 text-center w-[220px]">
              Mark Attendance
            </th>
            <th scope="col" className="px-5 py-3 text-right">
              Remarks
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E5E5]">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="hover:bg-[#F7F7F7]/40 transition-colors">
              {/* Student Name */}
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                  <Skeleton className="h-4 w-36" />
                </div>
              </td>

              {/* Student Code */}
              <td className="px-5 py-3.5">
                <Skeleton className="h-4 w-20" />
              </td>

              {/* Historical Attendance Rate */}
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-2 w-14 rounded-full" />
                  <Skeleton className="h-3.5 w-8" />
                </div>
              </td>

              {/* Mark Attendance 3-button Neutral Placeholder */}
              <td className="px-5 py-3.5">
                <div className="flex items-center justify-center gap-1.5">
                  <Skeleton className="h-7 w-16 rounded-md" />
                  <Skeleton className="h-7 w-16 rounded-md" />
                  <Skeleton className="h-7 w-14 rounded-md" />
                </div>
              </td>

              {/* Remarks button */}
              <td className="px-5 py-3.5 text-right">
                <div className="flex justify-end">
                  <Skeleton className="h-6 w-20 rounded" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
