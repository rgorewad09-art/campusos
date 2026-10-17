'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { getStoredTheme, applyTheme, resolveIsDark, type Theme } from '@/src/lib/theme';

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export default function ThemeToggle({ showLabel = false, className = '' }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const initial = getStoredTheme();
    setTheme(initial);
    applyTheme(initial);

    // Listen for OS system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (getStoredTheme() === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  function handleToggle() {
    // Cycle: system -> light -> dark -> system
    let nextTheme: Theme = 'dark';
    if (theme === 'system') {
      nextTheme = resolveIsDark('system') ? 'light' : 'dark';
    } else if (theme === 'light') {
      nextTheme = 'dark';
    } else {
      nextTheme = 'light';
    }

    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  if (!mounted) {
    return (
      <div
        className={`h-8 w-8 rounded-md border border-[#E5E5E5] bg-white opacity-60 ${className}`}
        aria-hidden="true"
      />
    );
  }

  const isDarkActive = resolveIsDark(theme);

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white p-2 text-[#737373] hover:border-[#171717] hover:text-[#171717] transition-colors ${className}`}
      aria-label={`Toggle theme (currently ${theme} mode, displaying ${isDarkActive ? 'dark' : 'light'})`}
      title={`Theme: ${theme.toUpperCase()} (Click to switch)`}
    >
      {isDarkActive ? (
        <Moon size={16} className="text-amber-400" />
      ) : (
        <Sun size={16} className="text-amber-500" />
      )}
      {showLabel && (
        <span className="text-xs font-medium capitalize">
          {theme === 'system' ? 'System' : isDarkActive ? 'Dark' : 'Light'}
        </span>
      )}
    </button>
  );
}
