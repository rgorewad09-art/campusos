'use client';

import { Users, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import type { DailyAttendanceSummary } from '@/src/types/attendance';
import StatCardSkeleton from '@/src/components/skeletons/StatCardSkeleton';

interface AttendanceSummaryCardsProps {
  summary: DailyAttendanceSummary | null;
  isLoading: boolean;
}

export default function AttendanceSummaryCards({
  summary,
  isLoading,
}: AttendanceSummaryCardsProps) {
  if (isLoading || !summary) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading attendance metric counters"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      >
        <span className="sr-only">Loading attendance metrics...</span>
        {Array.from({ length: 5 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'Total Eligible Students',
      value: summary.totalEligible,
      icon: Users,
      description: 'Active enrolled students',
    },
    {
      label: 'Present',
      value: summary.presentCount,
      icon: CheckCircle2,
      description: 'Attended session',
    },
    {
      label: 'Absent',
      value: summary.absentCount,
      icon: XCircle,
      description: 'Unexcused / excused absence',
    },
    {
      label: 'Late',
      value: summary.lateCount,
      icon: Clock,
      description: 'Arrived after call',
    },
    {
      label: 'Unmarked',
      value: summary.unmarkedCount,
      icon: AlertCircle,
      description: 'Pending record',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-xl border border-[#E5E5E5] bg-white p-4 transition-all"
          >
            <div className="flex items-center justify-between text-[#737373]">
              <span className="text-xs font-medium text-[#737373]">{card.label}</span>
              <Icon size={15} className="shrink-0 text-[#171717]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold tracking-tight text-[#171717]">
                {card.value}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[#A3A3A3] truncate">
              {card.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
