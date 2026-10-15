import AppShell from '../components/AppShell';
import PlaceholderPage from '../components/PlaceholderPage';
import { requireServerAuth } from '@/src/lib/auth-guard';

export default async function DocumentsPage() {
  await requireServerAuth(['admin']);

  return (
    <AppShell pageTitle="Documents">
      <PlaceholderPage
        title="Document Management"
        description="Upload, review, and verify student documents such as transcripts, ID proofs, and enrollment certificates."
      />
    </AppShell>
  );
}
