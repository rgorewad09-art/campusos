import AppShell from '../components/AppShell';
import ReportsView from './ReportsView';
import { requireServerAuth } from '@/src/lib/auth-guard';

export const metadata = {
  title: 'Reports & Analytics | CampusOS',
  description: 'Generate institutional reports, monitor attendance trends, and export verified datasets.',
};

export default async function ReportsPage() {
  await requireServerAuth(['admin']);

  return (
    <AppShell pageTitle="Reports">
      <ReportsView />
    </AppShell>
  );
}
