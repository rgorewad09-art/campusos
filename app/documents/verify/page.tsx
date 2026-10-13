import AppShell from '../../components/AppShell';
import PlaceholderPage from '../../components/PlaceholderPage';

export default function VerifyDocumentsPage() {
  return (
    <AppShell pageTitle="Verify Documents">
      <PlaceholderPage
        title="Verify Pending Documents"
        description="Review and approve or reject student-submitted documents awaiting verification."
      />
    </AppShell>
  );
}
