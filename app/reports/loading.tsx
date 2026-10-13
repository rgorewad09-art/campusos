import AppShell from '../components/AppShell';
import StatCardSkeleton from '@/src/components/skeletons/StatCardSkeleton';
import StudentListSkeleton from '@/src/components/skeletons/StudentListSkeleton';
import Skeleton from '@/src/components/skeletons/Skeleton';

export default function ReportsLoading() {
  return (
    <AppShell pageTitle="Reports">
      <div className="flex flex-col gap-6">
        {/* Top Header */}
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>

        {/* Tab Navigation Placeholder */}
        <div className="border-b border-[#E5E5E5] pb-2 flex gap-4">
          <Skeleton className="h-7 w-44 rounded-md" />
          <Skeleton className="h-7 w-36 rounded-md" />
          <Skeleton className="h-7 w-40 rounded-md" />
        </div>

        {/* 6 Metric Card Skeletons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Table Skeleton */}
        <StudentListSkeleton rows={8} />
      </div>
    </AppShell>
  );
}
