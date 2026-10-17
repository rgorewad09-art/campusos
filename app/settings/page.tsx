import Link from 'next/link';
import AppShell from '../components/AppShell';
import SettingsView from './SettingsView';
import { requireServerAuth } from '@/src/lib/auth-guard';
import ThemeToggle from '../components/ThemeToggle';
import { Shield, GraduationCap, User, ArrowLeft, Clock, Laptop } from 'lucide-react';

export default async function SettingsPage() {
  const user = await requireServerAuth(['admin', 'teacher', 'student']);

  // Admin Portal Settings
  if (user.role === 'admin') {
    return (
      <AppShell pageTitle="Settings">
        <SettingsView />
      </AppShell>
    );
  }

  // Teacher Portal Settings
  if (user.role === 'teacher') {
    return (
      <div className="min-h-screen bg-[#F7F7F7]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E5E5E5] bg-white px-6">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold tracking-tight text-[#171717] select-none">
              Campus<span className="text-[#737373]">OS</span>
            </span>
            <span className="rounded border border-[#E5E5E5] bg-[#F7F7F7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
              Faculty Settings
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

        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#171717]">
              Faculty Profile & Preferences
            </h2>
            <p className="text-xs text-[#737373] mt-1">
              View your authenticated faculty profile and customize your display preferences.
            </p>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
              <div className="flex items-center gap-2">
                <GraduationCap size={18} className="text-[#171717]" />
                <h3 className="text-sm font-semibold text-[#171717]">Faculty Member Record</h3>
              </div>
              <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-semibold uppercase">
                Active Faculty
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[#737373] text-[11px]">Display Name</span>
                <p className="font-semibold text-[#171717] mt-0.5">{user.displayName}</p>
              </div>
              <div>
                <span className="text-[#737373] text-[11px]">Email Address</span>
                <p className="font-semibold text-[#171717] mt-0.5">{user.email || '—'}</p>
              </div>
              <div>
                <span className="text-[#737373] text-[11px]">System Role</span>
                <p className="font-semibold text-[#171717] mt-0.5 capitalize">{user.role}</p>
              </div>
              <div>
                <span className="text-[#737373] text-[11px]">Session Security</span>
                <p className="font-semibold text-emerald-700 mt-0.5">15-Minute Inactive Guard</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xs space-y-4">
            <div className="border-b border-[#E5E5E5] pb-4">
              <h3 className="text-sm font-semibold text-[#171717]">Appearance & Theme</h3>
              <p className="text-[11px] text-[#737373] mt-0.5">
                Toggle between light and dark themes using the theme button in the header.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[#171717]">Current Theme Mode</p>
                <p className="text-[11px] text-[#737373]">
                  Select your preferred color scheme across all faculty tools.
                </p>
              </div>
              <ThemeToggle showLabel />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Student Portal Settings
  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E5E5E5] bg-white px-6">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight text-[#171717] select-none">
            Campus<span className="text-[#737373]">OS</span>
          </span>
          <span className="rounded border border-[#E5E5E5] bg-[#F7F7F7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
            Student Settings
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

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[#171717]">
            Student Account & Preferences
          </h2>
          <p className="text-xs text-[#737373] mt-1">
            Personal profile details and portal display preferences.
          </p>
        </div>

        <div className="rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
            <div className="flex items-center gap-2">
              <User size={18} className="text-[#171717]" />
              <h3 className="text-sm font-semibold text-[#171717]">Student Identity Record</h3>
            </div>
            <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-semibold uppercase">
              Enrolled Student
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[#737373] text-[11px]">Student Name</span>
              <p className="font-semibold text-[#171717] mt-0.5">{user.displayName}</p>
            </div>
            <div>
              <span className="text-[#737373] text-[11px]">Email Address</span>
              <p className="font-semibold text-[#171717] mt-0.5">{user.email || '—'}</p>
            </div>
            <div>
              <span className="text-[#737373] text-[11px]">Account Security</span>
              <p className="font-semibold text-[#171717] mt-0.5">Password & OTP Protected</p>
            </div>
            <div>
              <span className="text-[#737373] text-[11px]">Session Inactivity Guard</span>
              <p className="font-semibold text-emerald-700 mt-0.5">15-Minute Auto-Timeout</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xs space-y-4">
          <div className="border-b border-[#E5E5E5] pb-4">
            <h3 className="text-sm font-semibold text-[#171717]">Appearance & Theme</h3>
            <p className="text-[11px] text-[#737373] mt-0.5">
              Customize your student portal theme preference.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#171717]">Current Theme Mode</p>
              <p className="text-[11px] text-[#737373]">
                Toggle between light and dark themes anytime.
              </p>
            </div>
            <ThemeToggle showLabel />
          </div>
        </div>
      </main>
    </div>
  );
}
