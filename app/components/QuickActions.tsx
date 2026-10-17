import Link from 'next/link';
import { UserPlus, CalendarCheck, ShieldCheck, ChevronRight, LucideIcon } from 'lucide-react';

interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const quickActions: QuickAction[] = [
  {
    label: 'Enroll Student',
    description: 'Add a new student profile and initiate enrollment',
    href: '/students/enroll',
    icon: UserPlus,
  },
  {
    label: 'Record Attendance',
    description: 'Mark attendance registers and verify sessions for today',
    href: '/attendance/record',
    icon: CalendarCheck,
  },
  {
    label: 'Verify Documents',
    description: 'Review and approve pending student document submissions',
    href: '/documents/verify',
    icon: ShieldCheck,
  },
];

export default function QuickActions() {
  return (
    <section aria-labelledby="quick-actions-heading" className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h2
          id="quick-actions-heading"
          className="text-sm font-semibold text-[#171717] dark:text-[#EDEDED]"
        >
          Quick Actions
        </h2>
        <span className="text-[11px] text-[#737373] dark:text-[#8C8C8C]">
          Common operational shortcuts
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 w-full">
        {quickActions.map(({ label, description, href, icon: Icon }, index) => (
          <Link
            key={href}
            href={href}
            className={`group flex min-w-0 items-start gap-3.5 rounded-lg border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#141414] p-4 transition-all hover:border-[#171717] dark:hover:border-[#EDEDED] hover:bg-[#FAFAFA] dark:hover:bg-[#1C1C1C] shadow-xs ${
              index === 2 ? 'sm:col-span-2 lg:col-span-1' : ''
            }`}
          >
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#F7F7F7] dark:bg-[#1E1E1E] text-[#171717] dark:text-[#EDEDED] transition-colors group-hover:bg-[#171717] dark:group-hover:bg-[#EDEDED] group-hover:text-white dark:group-hover:text-[#111111]">
              <Icon size={16} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug break-words text-[#171717] dark:text-[#EDEDED] group-hover:text-[#171717] dark:group-hover:text-white transition-colors">
                  {label}
                </p>
                <ChevronRight
                  size={14}
                  className="mt-0.5 shrink-0 text-[#A3A3A3] dark:text-[#525252] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                />
              </div>
              <p className="mt-1 text-xs text-[#737373] dark:text-[#8C8C8C] leading-relaxed break-words">
                {description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
