import { connection } from 'next/server';
import { requireServerAuth } from '@/src/lib/auth-guard';
import TeacherAttendanceView from './TeacherAttendanceView';

export const metadata = {
  title: 'Faculty Attendance | CampusOS',
  description: 'Manage class attendance sessions, generate OTP codes, and record verified student attendance.',
};

export default async function TeacherAttendancePage() {
  await connection();
  await requireServerAuth(['teacher']);
  return <TeacherAttendanceView />;
}
