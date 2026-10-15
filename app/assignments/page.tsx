import AppShell from '../components/AppShell';
import PlaceholderPage from '../components/PlaceholderPage';
import { requireServerAuth } from '@/src/lib/auth-guard';

export default async function AssignmentsPage() {
  await requireServerAuth(['admin']);

  return (
    <AppShell pageTitle="Assignments">
      <PlaceholderPage
        title="Assignments"
        description="Create, distribute, and grade student assignments across all courses."
      />
    </AppShell>
  );
}
