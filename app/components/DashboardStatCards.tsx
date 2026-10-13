'use client';

import { Users, UserCheck, ShieldAlert, CalendarCheck, Clock, FileCheck } from 'lucide-react';
import type { DashboardStats } from '@/src/types/analytics';
import Link from 'next/link';
import StatCardSkeleton from '@/src/components/skeletons/StatCardSkeleton';
import Skeleton from '@/src/components/skeletons/Skeleton';

interface DashboardStatCardsProps {
  stats: DashboardStats | null;
  isLoading: boolean;
}

export default function DashboardStatCards({
  stats,
  isLoading,
}: DashboardStatCardsProps) {
  if (isLoading || !stats) {
    return (
      <div aria-busy="true" aria-label="Loading dashboard statistics" className="space-y-4">
        <span className="sr-only">Loading dashboard statistics...</span>

        {/* 4 Primary Metric Skeletons */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        {/* Secondary Operational Strips Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-2 space-y-1.5">
                  <Skeleton className="h-2.5 w-12 mx-auto" />
                  <Skeleton className="h-5 w-8 mx-auto" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-2 space-y-1.5">
                  <Skeleton className="h-2.5 w-12 mx-auto" />
                  <Skeleton className="h-5 w-8 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activePercent =
    stats.totalStudents > 0
      ? Math.round((stats.activeStudents / stats.totalStudents) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Students */}
        <Link
          href="/students"
          className="rounded-xl border border-[#E5E5E5] bg-white p-5 hover:border-[#171717] transition-all group"
        >
          <div className="flex items-center justify-between text-[#737373]">
            <span className="text-xs font-medium text-[#737373]">Total Enrolled</span>
            <Users size={16} className="text-[#171717]" />
          </div>
          <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-[#171717]">
            {stats.totalStudents}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[#737373]">
            <span>{stats.activeStudents} active</span>
            <span>•</span>
            <span>{stats.inactiveStudents} inactive</span>
            <span>•</span>
            <span>{stats.graduatedStudents} graduated</span>
          </div>
        </Link>

        {/* Active Students */}
        <Link
          href="/students"
          className="rounded-xl border border-[#E5E5E5] bg-white p-5 hover:border-[#171717] transition-all group"
        >
          <div className="flex items-center justify-between text-[#737373]">
            <span className="text-xs font-medium text-[#737373]">Active Students</span>
            <UserCheck size={16} className="text-[#171717]" />
          </div>
          <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-[#171717]">
            {stats.activeStudents}
          </p>
          <p className="mt-2 text-[11px] text-[#737373]">
            {activePercent}% of total student enrollment
          </p>
        </Link>

        {/* Today's Attendance */}
        <Link
          href="/attendance"
          className="rounded-xl border border-[#E5E5E5] bg-white p-5 hover:border-[#171717] transition-all group"
        >
          <div className="flex items-center justify-between text-[#737373]">
            <span className="text-xs font-medium text-[#737373]">Today&rsquo;s Attendance</span>
            <CalendarCheck size={16} className="text-[#171717]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="font-mono text-3xl font-bold tracking-tight text-[#171717]">
              {stats.todayPercentage !== null ? `${stats.todayPercentage}%` : '—'}
            </p>
            {stats.todayPercentage !== null && (
              <span className="text-xs text-[#737373]">rate</span>
            )}
          </div>
          <p className="mt-2 text-[11px] text-[#737373] truncate" title="Present • Absent • Late • Unmarked">
            {stats.todayPercentage !== null
              ? `${stats.todayPresent} present • ${stats.todayAbsent} absent • ${stats.todayLate} late`
              : `${stats.todayUnmarked} students unmarked today`}
          </p>
        </Link>

        {/* Pending Verifications */}
        <Link
          href="/students"
          className="rounded-xl border border-[#E5E5E5] bg-white p-5 hover:border-[#171717] transition-all group"
        >
          <div className="flex items-center justify-between text-[#737373]">
            <span className="text-xs font-medium text-[#737373]">Pending Documents</span>
            <ShieldAlert size={16} className="text-[#171717]" />
          </div>
          <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-[#171717]">
            {stats.pendingDocuments}
          </p>
          <p className="mt-2 text-[11px] text-[#737373]">
            out of {stats.totalDocuments} total documents uploaded
          </p>
        </Link>
      </div>

      {/* Secondary Metrics Strip: Today's Attendance & Document Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's Attendance Operational Status */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2 mb-3">
            <span className="text-xs font-semibold text-[#171717] flex items-center gap-1.5">
              <Clock size={13} />
              <span>Today&rsquo;s Session Status ({stats.todayDate})</span>
            </span>
            <Link
              href="/attendance"
              className="text-[11px] font-medium text-[#737373] hover:text-[#171717] hover:underline"
            >
              Open Sheet →
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-2">
              <span className="text-[10px] text-[#737373] block uppercase font-medium">Present</span>
              <span className="font-mono font-bold text-sm text-[#171717]">
                {stats.todayPresent}
              </span>
            </div>
            <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-2">
              <span className="text-[10px] text-[#737373] block uppercase font-medium">Absent</span>
              <span className="font-mono font-bold text-sm text-[#171717]">
                {stats.todayAbsent}
              </span>
            </div>
            <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-2">
              <span className="text-[10px] text-[#737373] block uppercase font-medium">Late</span>
              <span className="font-mono font-bold text-sm text-[#171717]">
                {stats.todayLate}
              </span>
            </div>
            <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-2">
              <span className="text-[10px] text-[#737373] block uppercase font-medium">Unmarked</span>
              <span className="font-mono font-bold text-sm text-[#171717]">
                {stats.todayUnmarked}
              </span>
            </div>
          </div>
        </div>

        {/* Document Verification Health */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2 mb-3">
            <span className="text-xs font-semibold text-[#171717] flex items-center gap-1.5">
              <FileCheck size={13} />
              <span>Document Verification Pipeline</span>
            </span>
            <Link
              href="/reports"
              className="text-[11px] font-medium text-[#737373] hover:text-[#171717] hover:underline"
            >
              View Report →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-2">
              <span className="text-[10px] text-[#737373] block uppercase font-medium">Pending</span>
              <span className="font-mono font-bold text-sm text-[#171717]">
                {stats.pendingDocuments}
              </span>
            </div>
            <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-2">
              <span className="text-[10px] text-[#737373] block uppercase font-medium">Verified</span>
              <span className="font-mono font-bold text-sm text-[#171717]">
                {stats.verifiedDocuments}
              </span>
            </div>
            <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-2">
              <span className="text-[10px] text-[#737373] block uppercase font-medium">Rejected</span>
              <span className="font-mono font-bold text-sm text-[#171717]">
                {stats.rejectedDocuments}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
