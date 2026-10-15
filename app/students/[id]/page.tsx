import { Suspense } from 'react';
import StudentProfileView from './StudentProfileView';
import AppShell from '../../components/AppShell';
import StudentProfileSkeleton from '@/src/components/skeletons/StudentProfileSkeleton';
import { requireServerAuth } from '@/src/lib/auth-guard';

export const instant = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentProfilePage({ params }: PageProps) {
  await requireServerAuth(['admin', 'teacher']);
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <AppShell pageTitle="Student Profile">
          <StudentProfileSkeleton />
        </AppShell>
      }
    >
      <StudentProfileView studentId={id} />
    </Suspense>
  );
}
