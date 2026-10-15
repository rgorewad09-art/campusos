import AppShell from '../../components/AppShell';
import PlaceholderPage from '../../components/PlaceholderPage';
import { requireServerAuth } from '@/src/lib/auth-guard';

export default async function VerifyDocumentsPage() {
  await requireServerAuth(['admin']);

  return (
    <AppShell pageTitle="Verify Documents">
      <PlaceholderPage
        title="Verify Pending Documents"
        description="Review and approve or reject student-submitted documents awaiting verification."
      />
    </AppShell>
  );
}
