import AppShell from '../components/AppShell';
import PlaceholderPage from '../components/PlaceholderPage';

export default function SettingsPage() {
  return (
    <AppShell pageTitle="Settings">
      <PlaceholderPage
        title="Settings"
        description="Configure institution details, user roles, permissions, and system preferences."
      />
    </AppShell>
  );
}
