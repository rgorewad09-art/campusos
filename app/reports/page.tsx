import AppShell from '../components/AppShell';
import ReportsView from './ReportsView';

export const metadata = {
  title: 'Reports & Analytics | CampusOS',
  description: 'Generate institutional reports, monitor attendance trends, and export verified datasets.',
};

export default function ReportsPage() {
  return (
    <AppShell pageTitle="Reports">
      <ReportsView />
    </AppShell>
  );
}
