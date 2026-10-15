import AttendanceView from './AttendanceView';
import { requireServerAuth } from '@/src/lib/auth-guard';

export default async function AttendancePage() {
  await requireServerAuth(['admin']);
  return <AttendanceView />;
}
