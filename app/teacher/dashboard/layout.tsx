import { requireServerAuth } from '@/src/lib/auth-guard';

export default async function TeacherDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireServerAuth(['teacher']);
  return <>{children}</>;
}
