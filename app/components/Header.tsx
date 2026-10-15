'use client';

import { useState, useEffect, useTransition } from 'react';
import { Menu, Search, Bell, LogOut, Loader2 } from 'lucide-react';
import { supabase } from '@/src/lib/supabase/client';
import { logoutAction } from '@/app/actions/auth';

interface HeaderProps {
  title: string;
  onMenuOpen: () => void;
}

export default function Header({ title, onMenuOpen }: HeaderProps) {
  const [adminEmail, setAdminEmail] = useState<string>('admin@campusos.com');
  const [initials, setInitials] = useState<string>('AD');
  const [isLoggingOut, startLogoutTransition] = useTransition();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setAdminEmail(user.email);
        const namePart = user.email.split('@')[0];
        setInitials(namePart.slice(0, 2).toUpperCase());
      }
    });
  }, []);

  function handleLogout() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('campusos_session_sync');
        channel.postMessage({ type: 'LOGOUT', timestamp: Date.now() });
        channel.close();
      }
      localStorage.setItem('campusos_tab_logout', String(Date.now()));
    } catch {
      // Fallback
    }
    startLogoutTransition(async () => {
      await logoutAction('/login?error=logged_out');
    });
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#E5E5E5] bg-[#F7F7F7] px-6 py-4">
      {/* Left: mobile menu + page title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuOpen}
          className="lg:hidden rounded-md p-1.5 text-[#737373] hover:bg-[#E5E5E5] hover:text-[#171717] transition-colors"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base font-semibold text-[#171717]">{title}</h1>
      </div>

      {/* Right: search + notifications + administrator profile + logout */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden sm:flex items-center gap-2 rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#737373] w-56 focus-within:border-[#171717] focus-within:text-[#171717] transition-colors">
          <Search size={14} className="shrink-0" />
          <input
            type="search"
            placeholder="Search..."
            className="w-full bg-transparent text-sm text-[#171717] placeholder:text-[#737373] outline-none"
            aria-label="Search"
          />
        </div>

        {/* Notification bell */}
        <button
          className="relative rounded-md p-2 text-[#737373] hover:bg-[#E5E5E5] hover:text-[#171717] transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
        </button>

        {/* Divider */}
        <div className="hidden sm:block h-6 w-px bg-[#E5E5E5]" />

        {/* Administrator profile */}
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#171717] text-xs font-semibold text-white select-none"
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold text-[#171717] leading-tight">
              Administrator
            </p>
            <p className="text-[11px] text-[#737373] leading-tight truncate max-w-[150px]">
              {adminEmail}
            </p>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-xs font-medium text-[#737373] hover:border-[#171717] hover:text-[#171717] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Sign out"
          title="Sign out of CampusOS"
        >
          {isLoggingOut ? (
            <Loader2 size={14} className="animate-spin text-[#171717]" />
          ) : (
            <LogOut size={14} />
          )}
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
