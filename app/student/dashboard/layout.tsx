import { requireServerAuth } from '@/src/lib/auth-guard';

export default async function StudentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireServerAuth(['student']);
  return <>{children}</>;
}
