import AppShell from '../components/AppShell';
import PlaceholderPage from '../components/PlaceholderPage';
import { requireServerAuth } from '@/src/lib/auth-guard';

export default async function SettingsPage() {
  await requireServerAuth(['admin']);

  return (
    <AppShell pageTitle="Settings">
      <PlaceholderPage
        title="Settings"
        description="Configure institution details, user roles, permissions, and system preferences."
      />
    </AppShell>
  );
}
