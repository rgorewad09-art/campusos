import { requireServerAuth } from '@/src/lib/auth-guard';

export default async function StudentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireServerAuth(['admin', 'teacher']);
  return <>{children}</>;
}
