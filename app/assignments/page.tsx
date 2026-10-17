import Link from 'next/link';
import AppShell from '../components/AppShell';
import AssignmentsView from './AssignmentsView';
import { requireServerAuth } from '@/src/lib/auth-guard';
import ThemeToggle from '../components/ThemeToggle';
import { ClipboardList, ArrowLeft, BookOpen, GraduationCap } from 'lucide-react';

export default async function AssignmentsPage() {
  const user = await requireServerAuth(['admin', 'teacher', 'student']);

  // Teacher role
  if (user.role === 'teacher') {
    return (
      <div className="min-h-screen bg-[#F7F7F7]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E5E5E5] bg-white px-6">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold tracking-tight text-[#171717] select-none">
              Campus<span className="text-[#737373]">OS</span>
            </span>
            <span className="rounded border border-[#E5E5E5] bg-[#F7F7F7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
              Faculty Portal
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/teacher/dashboard"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#171717] transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#171717]">
              Faculty Coursework & Subject Assignments
            </h2>
            <p className="text-xs text-[#737373] mt-0.5">
              Review your teaching workload, assigned subjects, and authorized student rosters.
            </p>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] bg-white p-8 text-center shadow-xs">
            <BookOpen size={36} className="mx-auto mb-3 text-[#A3A3A3]" />
            <h3 className="text-sm font-semibold text-[#171717]">
              Your Assigned Coursework is Managed in the Faculty Dashboard
            </h3>
            <p className="text-xs text-[#737373] max-w-md mx-auto mt-2 leading-relaxed">
              You can inspect your authorized subjects, weekly timetable schedule, and student rosters
              directly from your dedicated Faculty Dashboard.
            </p>
            <div className="mt-5">
              <Link
                href="/teacher/dashboard"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
              >
                <span>View My Teaching Schedule & Coursework</span>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Student role
  if (user.role === 'student') {
    return (
      <div className="min-h-screen bg-[#F7F7F7]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E5E5E5] bg-white px-6">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold tracking-tight text-[#171717] select-none">
              Campus<span className="text-[#737373]">OS</span>
            </span>
            <span className="rounded border border-[#E5E5E5] bg-[#F7F7F7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
              Student Portal
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/student/dashboard"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#171717] transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#171717]">
              Student Academic Coursework
            </h2>
            <p className="text-xs text-[#737373] mt-0.5">
              Your enrolled subjects, curriculum syllabus, and weekly lecture timetable.
            </p>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] bg-white p-8 text-center shadow-xs">
            <GraduationCap size={36} className="mx-auto mb-3 text-[#A3A3A3]" />
            <h3 className="text-sm font-semibold text-[#171717]">
              Enrolled Coursework & Timetable
            </h3>
            <p className="text-xs text-[#737373] max-w-md mx-auto mt-2 leading-relaxed">
              Your mandatory and elective coursework, faculty instructors, and synchronized class schedule
              are accessible directly in your Student Portal.
            </p>
            <div className="mt-5">
              <Link
                href="/student/dashboard"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
              >
                <span>Go to Academic Profile & Timetable</span>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Admin role: render full Assignments Management view
  return (
    <AppShell pageTitle="Assignments">
      <AssignmentsView />
    </AppShell>
  );
}
