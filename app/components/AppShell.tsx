'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import SessionTimeoutWarning from './SessionTimeoutWarning';

interface AppShellProps {
  children: React.ReactNode;
  pageTitle: string;
}

/**
 * AppShell – root layout wrapper shared across all authenticated pages.
 * Provides the sidebar + header + main content structure.
 */
export default function AppShell({ children, pageTitle }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#F7F7F7]">
      {/* Session timeout idle warning */}
      <SessionTimeoutWarning />

      {/* Sidebar */}
      <Sidebar
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      {/* Main content column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-x-hidden w-full max-w-full">
        <Header
          title={pageTitle}
          onMenuOpen={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 px-4 sm:px-6 py-6 w-full max-w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
