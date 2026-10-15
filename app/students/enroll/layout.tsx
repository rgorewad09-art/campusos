import { requireServerAuth } from '@/src/lib/auth-guard';

export default async function EnrollStudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireServerAuth(['admin']);
  return <>{children}</>;
}
