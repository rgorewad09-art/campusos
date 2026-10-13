import AppShell from './components/AppShell';
import DashboardView from './DashboardView';

export const metadata = {
  title: 'Dashboard | CampusOS',
  description: 'Administrator dashboard overview for CampusOS.',
};

export default function DashboardPage() {
  return (
    <AppShell pageTitle="Dashboard">
      <DashboardView />
    </AppShell>
  );
}
