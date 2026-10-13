import Link from 'next/link';
import { UserPlus, CalendarCheck, ShieldCheck, LucideIcon } from 'lucide-react';

interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const quickActions: QuickAction[] = [
  {
    label: 'Enroll Student',
    description: 'Add a new student to the system',
    href: '/students/enroll',
    icon: UserPlus,
  },
  {
    label: 'Record Attendance',
    description: 'Mark attendance for today',
    href: '/attendance/record',
    icon: CalendarCheck,
  },
  {
    label: 'Verify Documents',
    description: 'Review pending document submissions',
    href: '/documents/verify',
    icon: ShieldCheck,
  },
];

export default function QuickActions() {
  return (
    <section aria-labelledby="quick-actions-heading">
      <h2
        id="quick-actions-heading"
        className="mb-3 text-sm font-semibold text-[#171717]"
      >
        Quick Actions
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {quickActions.map(({ label, description, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-3 rounded-lg border border-[#E5E5E5] bg-white p-4 transition-colors hover:border-[#D4D4D4] hover:bg-[#FAFAFA]"
          >
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#F7F7F7] text-[#171717] group-hover:bg-[#EFEFEF] transition-colors">
              <Icon size={15} strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-medium text-[#171717]">{label}</p>
              <p className="mt-0.5 text-xs text-[#737373]">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
