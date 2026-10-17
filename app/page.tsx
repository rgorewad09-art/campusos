import { connection } from 'next/server';
import AppShell from './components/AppShell';
import DashboardView from './DashboardView';
import { requireServerAuth } from '@/src/lib/auth-guard';

export const metadata = {
  title: 'Dashboard | CampusOS',
  description: 'Administrator dashboard overview for CampusOS.',
};

export default async function DashboardPage() {
  await connection();
  const user = await requireServerAuth(['admin']);

  return (
    <AppShell pageTitle="Dashboard">
      <DashboardView displayName={user.displayName} />
    </AppShell>
  );
}
