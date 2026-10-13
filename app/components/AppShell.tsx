'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

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
      {/* Sidebar */}
      <Sidebar
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      {/* Main content column */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header
          title={pageTitle}
          onMenuOpen={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
