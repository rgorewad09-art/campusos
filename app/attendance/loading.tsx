import AppShell from '../components/AppShell';
import StatCardSkeleton from '@/src/components/skeletons/StatCardSkeleton';
import AttendanceTableSkeleton from '@/src/components/skeletons/AttendanceTableSkeleton';
import Skeleton from '@/src/components/skeletons/Skeleton';

export default function AttendanceLoading() {
  return (
    <AppShell pageTitle="Attendance">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Subtitle */}
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>

        {/* Date Selector Banner Placeholder */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-5 w-44" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>

        {/* 5 Attendance Metric Counters Skeletons */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Attendance Sheet Skeleton */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white overflow-hidden">
          <div className="p-3.5 border-b border-[#E5E5E5] flex items-center justify-between">
            <Skeleton className="h-8 w-44 rounded-md" />
            <Skeleton className="h-8 w-32 rounded-md" />
          </div>
          <AttendanceTableSkeleton rows={8} />
        </div>
      </div>
    </AppShell>
  );
}
