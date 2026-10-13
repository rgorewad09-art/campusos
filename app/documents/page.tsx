import AppShell from '../components/AppShell';
import PlaceholderPage from '../components/PlaceholderPage';

export default function DocumentsPage() {
  return (
    <AppShell pageTitle="Documents">
      <PlaceholderPage
        title="Document Management"
        description="Upload, review, and verify student documents such as transcripts, ID proofs, and enrollment certificates."
      />
    </AppShell>
  );
}
