import AppShell from '../../components/AppShell';
import StudentProfileSkeleton from '@/src/components/skeletons/StudentProfileSkeleton';

export default function StudentDetailLoading() {
  return (
    <AppShell pageTitle="Student Profile">
      <StudentProfileSkeleton />
    </AppShell>
  );
}
