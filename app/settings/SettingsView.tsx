'use client';

import { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  Monitor,
  Laptop,
  Save,
  Check,
} from 'lucide-react';
import {
  getAdminProfileAction,
  updateAdminProfileAction,
  type AdminProfileData,
} from '@/app/actions/settings';
import { getStoredTheme, applyTheme, type Theme } from '@/src/lib/theme';

export default function SettingsView() {
  const [profile, setProfile] = useState<AdminProfileData | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Theme preference state
  const [currentTheme, setCurrentTheme] = useState<Theme>('system');

  useEffect(() => {
    // Initialize theme
    const stored = getStoredTheme();
    setCurrentTheme(stored);

    // Fetch profile
    async function loadProfile() {
      setIsLoading(true);
      try {
        const res = await getAdminProfileAction();
        if (res.success && res.profile) {
          setProfile(res.profile);
          setDisplayName(res.profile.displayName);
        } else {
          setFeedback({ type: 'error', message: res.error || 'Failed to load profile.' });
        }
      } catch (err: unknown) {
        setFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : 'Error loading settings.',
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, []);

  function handleThemeChange(newTheme: Theme) {
    setCurrentTheme(newTheme);
    applyTheme(newTheme);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      setFeedback({ type: 'error', message: 'Display name cannot be empty.' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await updateAdminProfileAction({ displayName: displayName.trim() });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Profile saved successfully.' });
        if (profile) {
          setProfile({ ...profile, displayName: displayName.trim() });
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('campusos_profile_updated', {
              detail: { displayName: displayName.trim() },
            })
          );
        }
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to save changes.' });
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'An error occurred while saving.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-[#171717]" />
          <p className="text-xs text-[#737373]">Loading system settings...</p>
        </div>
      </div>
    );
  }

  const initials = profile?.displayName
    ? profile.displayName
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'AD';

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-lg font-bold tracking-tight text-[#171717]">
          Account & System Settings
        </h2>
        <p className="text-xs text-[#737373] mt-1">
          Manage your administrator profile, theme preferences, and system security parameters.
        </p>
      </div>

      {/* Status Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-4 text-xs ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-red-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Section 1: Administrator Profile */}
      <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#141414] p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] dark:border-[#262626] pb-4">
          <div className="flex items-center gap-2">
            <User size={18} className="text-[#171717]" />
            <h3 className="text-sm font-semibold text-[#171717]">Administrator Profile</h3>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
            <Shield size={11} />
            <span>Authorized Administrator</span>
          </span>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#171717] text-lg font-bold text-white shadow-xs select-none">
              {initials}
            </div>
            <div>
              <p className="text-xs font-semibold text-[#171717]">Profile Avatar</p>
              <p className="text-[11px] text-[#737373] mt-0.5">
                Automatically generated from your official administrator name.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Display Name *
              </label>
              <input
                type="text"
                required
                maxLength={60}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Administrator"
                className="w-full rounded-md border border-[#E5E5E5] px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none"
              />
              <p className="text-[10px] text-[#737373] mt-1">
                Shown in the top navigation bar and dashboard greeting.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  disabled
                  value={profile?.email || 'admin@campusos.com'}
                  className="w-full rounded-md border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2 text-xs text-[#737373] cursor-not-allowed select-none"
                />
                <span className="absolute right-2.5 top-2.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-semibold px-1.5 py-0.5 uppercase">
                  Verified
                </span>
              </div>
              <p className="text-[10px] text-[#737373] mt-1">
                Bound to Supabase Auth credentials. Protected against unauthorized tampering.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#111111] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span>Save Profile Changes</span>
            </button>
          </div>
        </form>
      </div>

      {/* Section 2: Appearance & Theme Preferences */}
      <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#141414] p-6 shadow-xs space-y-5">
        <div className="border-b border-[#E5E5E5] dark:border-[#262626] pb-4">
          <h3 className="text-sm font-semibold text-[#171717] dark:text-[#EDEDED]">Appearance & Theme</h3>
          <p className="text-[11px] text-[#737373] dark:text-[#8C8C8C] mt-0.5">
            Choose your preferred color theme across administrator, faculty, and student portals.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Light Theme */}
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
              currentTheme === 'light'
                ? 'border-[#171717] bg-[#FAFAFA] ring-1 ring-[#171717]'
                : 'border-[#E5E5E5] bg-white hover:border-[#171717]'
            }`}
          >
            <div className="flex w-full items-center justify-between mb-3">
              <Sun size={20} className="text-amber-500" />
              {currentTheme === 'light' && <Check size={14} className="text-[#171717]" />}
            </div>
            <p className="text-xs font-bold text-[#171717]">Light Mode</p>
            <p className="text-[11px] text-[#737373] mt-0.5">
              Crisp white and subtle off-white backgrounds with high contrast text.
            </p>
          </button>

          {/* Dark Theme */}
          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
              currentTheme === 'dark'
                ? 'border-[#171717] bg-[#FAFAFA] ring-1 ring-[#171717]'
                : 'border-[#E5E5E5] bg-white hover:border-[#171717]'
            }`}
          >
            <div className="flex w-full items-center justify-between mb-3">
              <Moon size={20} className="text-amber-400" />
              {currentTheme === 'dark' && <Check size={14} className="text-[#171717]" />}
            </div>
            <p className="text-xs font-bold text-[#171717]">Dark Mode</p>
            <p className="text-[11px] text-[#737373] mt-0.5">
              Premium monochromatic deep charcoal and obsidian interface.
            </p>
          </button>

          {/* System Default */}
          <button
            type="button"
            onClick={() => handleThemeChange('system')}
            className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
              currentTheme === 'system'
                ? 'border-[#171717] bg-[#FAFAFA] ring-1 ring-[#171717]'
                : 'border-[#E5E5E5] bg-white hover:border-[#171717]'
            }`}
          >
            <div className="flex w-full items-center justify-between mb-3">
              <Laptop size={20} className="text-[#737373]" />
              {currentTheme === 'system' && <Check size={14} className="text-[#171717]" />}
            </div>
            <p className="text-xs font-bold text-[#171717]">System Sync</p>
            <p className="text-[11px] text-[#737373] mt-0.5">
              Matches your operating system’s dark/light schedule automatically.
            </p>
          </button>
        </div>
      </div>

      {/* Section 3: System Security & Session Parameters */}
      <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#141414] p-6 shadow-xs space-y-4">
        <div className="border-b border-[#E5E5E5] dark:border-[#262626] pb-4">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-[#171717] dark:text-[#EDEDED]" />
            <h3 className="text-sm font-semibold text-[#171717] dark:text-[#EDEDED]">System Security & Session Parameters</h3>
          </div>
          <p className="text-[11px] text-[#737373] dark:text-[#8C8C8C] mt-0.5">
            Active safeguards enforcing session security, role boundaries, and audit logging.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="rounded-lg border border-[#E5E5E5] p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#171717]">Idle Session Timeout</span>
              <span className="rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold uppercase">
                Enforced (15 Min)
              </span>
            </div>
            <p className="text-[11px] text-[#737373]">
              Automatically logs out inactive sessions to protect confidential student data.
            </p>
          </div>

          <div className="rounded-lg border border-[#E5E5E5] p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#171717]">Cross-Tab Synchronization</span>
              <span className="rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold uppercase">
                Active
              </span>
            </div>
            <p className="text-[11px] text-[#737373]">
              BroadcastChannel automatically synchronizes sign-outs across all active browser windows.
            </p>
          </div>

          <div className="rounded-lg border border-[#E5E5E5] p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#171717]">Row Level Security (RLS)</span>
              <span className="rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold uppercase">
                Protected
              </span>
            </div>
            <p className="text-[11px] text-[#737373]">
              PostgreSQL policies enforce strict role boundaries between Administrator, Faculty, and Students.
            </p>
          </div>

          <div className="rounded-lg border border-[#E5E5E5] p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#171717]">Security Audit Log</span>
              <span className="rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold uppercase">
                Enabled
              </span>
            </div>
            <p className="text-[11px] text-[#737373]">
              All security-sensitive administrative updates are recorded in PostgreSQL audit logs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
