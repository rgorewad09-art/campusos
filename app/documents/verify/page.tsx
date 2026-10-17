import AppShell from '../../components/AppShell';
import DocumentsView from '../DocumentsView';
import { requireServerAuth } from '@/src/lib/auth-guard';

export default async function VerifyDocumentsPage() {
  await requireServerAuth(['admin']);

  return (
    <AppShell pageTitle="Verify Documents">
      <DocumentsView
        initialStatus="pending"
        pageTitle="Verify Pending Documents"
        pageSubtitle="Review, approve, or reject student-submitted documents awaiting verification."
      />
    </AppShell>
  );
}
