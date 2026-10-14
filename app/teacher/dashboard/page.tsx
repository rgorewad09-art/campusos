'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  CalendarCheck,
  ClipboardList,
  LogOut,
  GraduationCap,
} from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';

export default function TeacherDashboardPage() {
  async function handleSignOut() {
    await logoutAction();
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Top Header */}
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
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] hover:border-[#171717] transition-colors"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Welcome */}
        <div className="mb-8 rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-2 text-[#171717]">
              <GraduationCap size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#171717]">
                Teacher Dashboard
              </h1>
              <p className="text-xs text-[#737373]">
                Manage classroom attendance, view student rosters, and track performance.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Access Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <CalendarCheck size={18} className="text-[#171717]" />
              <h2 className="text-sm font-semibold text-[#171717]">Attendance Recording</h2>
            </div>
            <p className="text-xs text-[#737373] leading-relaxed mb-4">
              Access the digital attendance sheet to record present, absent, and late marks for assigned students.
            </p>
            <Link
              href="/attendance"
              className="inline-flex items-center justify-center rounded-md bg-[#111111] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
            >
              Open Daily Attendance Sheet
            </Link>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <Users size={18} className="text-[#171717]" />
              <h2 className="text-sm font-semibold text-[#171717]">Student Directory</h2>
            </div>
            <p className="text-xs text-[#737373] leading-relaxed mb-4">
              Browse student profiles, verify enrolled student details, and review classroom rosters.
            </p>
            <Link
              href="/students"
              className="inline-flex items-center justify-center rounded-md border border-[#E5E5E5] bg-white px-4 py-2 text-xs font-medium text-[#171717] hover:border-[#171717] transition-colors"
            >
              View Students
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
