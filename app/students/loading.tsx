import AppShell from '../components/AppShell';
import StudentListSkeleton from '@/src/components/skeletons/StudentListSkeleton';
import Skeleton from '@/src/components/skeletons/Skeleton';

export default function StudentsLoading() {
  return (
    <AppShell pageTitle="Students">
      <div className="flex flex-col gap-6">
        {/* Top Header & Enroll Action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
          </div>
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>

        {/* Filter Bar Placeholder */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-lg border border-[#E5E5E5] bg-white p-3">
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Skeleton className="h-8 flex-1 rounded-md" />
            <Skeleton className="h-8 w-32 rounded-md" />
          </div>
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>

        {/* Full Student List Skeleton */}
        <StudentListSkeleton rows={8} />
      </div>
    </AppShell>
  );
}
