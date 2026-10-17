import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppShell from '../components/AppShell';
import DocumentsView from './DocumentsView';
import { requireServerAuth } from '@/src/lib/auth-guard';
import ThemeToggle from '../components/ThemeToggle';
import { FileText, ArrowLeft, Shield } from 'lucide-react';

export default async function DocumentsPage() {
  const user = await requireServerAuth(['admin', 'teacher', 'student']);

  // Student role: direct to their personal documents workspace
  if (user.role === 'student') {
    redirect('/student/dashboard');
  }

  // Teacher role: view faculty documents portal
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
              Academic Documents & Records
            </h2>
            <p className="text-xs text-[#737373] mt-0.5">
              Access institutional curriculum outlines, student verification status, and departmental archives.
            </p>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] bg-white p-8 text-center shadow-xs">
            <FileText size={32} className="mx-auto mb-3 text-[#A3A3A3]" />
            <h3 className="text-sm font-semibold text-[#171717]">Faculty Document Archives</h3>
            <p className="text-xs text-[#737373] max-w-md mx-auto mt-1 leading-relaxed">
              Official student identity documents and enrollment verification records are managed by the admissions administration.
              You can inspect enrolled students in your assigned sections directly from your dashboard roster.
            </p>
            <div className="mt-5">
              <Link
                href="/teacher/dashboard"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
              >
                <span>Return to Faculty Dashboard</span>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Admin role: render full Documents Management View
  return (
    <AppShell pageTitle="Documents">
      <DocumentsView />
    </AppShell>
  );
}
