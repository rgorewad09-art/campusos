'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Library,
  UserCheck,
  CalendarDays,
  CalendarCheck,
  FileText,
  ClipboardList,
  BarChart2,
  Settings,
  X,
  LogOut,
} from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Students', href: '/students', icon: Users },
  { label: 'Faculty', href: '/teachers', icon: GraduationCap },
  { label: 'Courses', href: '/academic/courses', icon: BookOpen },
  { label: 'Subjects', href: '/academic/subjects', icon: Library },
  { label: 'Enrollments', href: '/academic/enrollments', icon: UserCheck },
  { label: 'Timetable', href: '/academic/timetable', icon: CalendarDays },
  { label: 'Attendance', href: '/attendance', icon: CalendarCheck },
  { label: 'Documents', href: '/documents', icon: FileText },
  { label: 'Assignments', href: '/assignments', icon: ClipboardList },
  { label: 'Reports', href: '/reports', icon: BarChart2 },
  { label: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  async function handleLogout() {
    onClose();
    await logoutAction();
  }

  const sidebarContent = (
    <aside
      className="flex h-full w-64 flex-col bg-[#111111] flex-shrink-0"
      aria-label="Main navigation"
    >
      {/* Wordmark */}
      <div className="flex items-center justify-between px-6 py-6">
        <span className="text-white text-xl font-semibold tracking-tight select-none">
          Campus<span className="text-[#737373]">OS</span>
        </span>
        {/* Close button – mobile only */}
        <button
          onClick={onClose}
          className="lg:hidden text-[#737373] hover:text-white transition-colors"
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
      </div>

      {/* Divider */}
      <div className="mx-6 h-px bg-[#262626]" />

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[#525252]">
          Menu
        </p>
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white text-[#111111]'
                  : 'text-[#A3A3A3] hover:bg-[#1F1F1F] hover:text-white'
              }`}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mx-6 h-px bg-[#262626]" />
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-[#525252]">CampusOS v1.0</p>
          <p className="text-[11px] text-[#3A3A3A]">© 2026 All rights reserved</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-[#737373] hover:text-white hover:bg-[#1F1F1F] transition-colors"
          aria-label="Sign out"
          title="Sign out of CampusOS"
        >
          <LogOut size={13} />
          <span>Exit</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-screen sticky top-0">
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="relative z-50 flex h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
