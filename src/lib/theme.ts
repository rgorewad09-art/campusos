'use client';

export type Theme = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'campusos_theme';

/**
 * Reads the stored theme preference from localStorage, falling back to 'system'.
 */
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // Ignore localStorage access restrictions
  }
  return 'system';
}

/**
 * Resolves whether dark mode should be active based on preference and OS color scheme.
 */
export function resolveIsDark(theme: Theme): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  if (typeof window === 'undefined') return false;
  return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

/**
 * Applies the dark class to document.documentElement and persists the choice.
 */
export function applyTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore localStorage access restrictions
  }

  const isDark = resolveIsDark(theme);
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
