import AppShell from './components/AppShell';
import DashboardSkeleton from '@/src/components/skeletons/DashboardSkeleton';

export default function DashboardLoading() {
  return (
    <AppShell pageTitle="Dashboard">
      <DashboardSkeleton />
    </AppShell>
  );
}
