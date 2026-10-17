'use client';

import { Suspense, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Loader2, BookOpen } from 'lucide-react';
import { loginAction } from '@/app/actions/auth';
import { getSafeRedirectUrl } from '@/src/lib/security';
import ThemeToggle from '@/app/components/ThemeToggle';

function TeacherLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  const rawRedirectTo = getSafeRedirectUrl(searchParams.get('redirectTo'));
  // Ensure faculty cannot be bounced to student or administrative areas via redirect param
  const redirectTo =
    rawRedirectTo.startsWith('/student') ||
    rawRedirectTo.startsWith('/settings') ||
    rawRedirectTo === '/'
      ? '/teacher/dashboard'
      : rawRedirectTo;

  const [errorMessage, setErrorMessage] = useState<string | null>(
    urlError === 'unauthorized'
      ? 'Access denied: Please sign in with an authorized faculty account.'
      : urlError === 'session_expired'
      ? 'Your session has expired due to 15 minutes of inactivity. Please sign in again.'
      : urlError === 'logged_out'
      ? 'You have been safely signed out.'
      : null
  );
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await loginAction(null, formData);

      if (result?.error) {
        setErrorMessage(result.error);
      } else if (result?.success) {
        const targetUrl =
          redirectTo !== '/' ? redirectTo : result.destination || '/teacher/dashboard';
        router.push(targetUrl);
        router.refresh();
      }
    });
  }

  return (
    <div className="w-full max-w-sm">
      {/* Login Card */}
      <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#141414] p-6 sm:p-7 shadow-xs">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <span className="text-xl font-semibold tracking-tight text-[#171717] dark:text-[#EDEDED] select-none">
              Campus<span className="text-[#737373] dark:text-[#8C8C8C]">OS</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] dark:border-[#333333] bg-[#F7F7F7] dark:bg-[#1E1E1E] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#171717] dark:text-[#EDEDED]">
              <BookOpen size={12} className="text-[#171717] dark:text-[#EDEDED]" />
              Faculty Portal
            </span>
          </div>
          <h1 className="mt-5 text-base sm:text-lg font-semibold text-[#171717] dark:text-[#EDEDED]">
            Faculty Sign In
          </h1>
          <p className="mt-1 text-xs text-[#737373] dark:text-[#8C8C8C] leading-relaxed">
            Enter your faculty credentials to manage student attendance, rosters, and coursework.
          </p>
        </div>

        {/* Error State Banner */}
        {errorMessage && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-4 flex items-start gap-2.5 rounded-lg border border-[#171717] dark:border-[#EDEDED] bg-[#F7F7F7] dark:bg-[#1E1E1E] p-3 text-xs text-[#171717] dark:text-[#EDEDED]"
          >
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#171717] dark:text-[#EDEDED]" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Hidden Portal Indicator for Authoritative Verification */}
          <input type="hidden" name="portal" value="teacher" />

          <div>
            <label
              htmlFor="identifier"
              className="block text-xs font-medium text-[#171717] dark:text-[#EDEDED] mb-1"
            >
              Faculty Email or Teacher ID
            </label>
            <input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              required
              placeholder="faculty@campusos.com or TCH-2026-0001"
              disabled={isPending}
              className="w-full rounded-md border border-[#E5E5E5] dark:border-[#333333] bg-white dark:bg-[#171717] px-3 py-2 text-sm text-[#171717] dark:text-[#EDEDED] placeholder:text-[#A3A3A3] dark:placeholder:text-[#666666] focus:border-[#171717] dark:focus:border-[#EDEDED] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-[#171717] dark:text-[#EDEDED] mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              disabled={isPending}
              className="w-full rounded-md border border-[#E5E5E5] dark:border-[#333333] bg-white dark:bg-[#171717] px-3 py-2 text-sm text-[#171717] dark:text-[#EDEDED] placeholder:text-[#A3A3A3] dark:placeholder:text-[#666666] focus:border-[#171717] dark:focus:border-[#EDEDED] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex items-center text-xs pt-0.5">
            <label
              htmlFor="remember_me"
              className="flex items-center gap-2 cursor-pointer select-none text-[#737373] dark:text-[#8C8C8C] hover:text-[#171717] dark:hover:text-[#EDEDED]"
            >
              <input
                id="remember_me"
                name="remember_me"
                type="checkbox"
                defaultChecked={false}
                disabled={isPending}
                className="h-3.5 w-3.5 rounded border-[#E5E5E5] dark:border-[#333333] text-[#171717] focus:ring-0 focus:outline-none accent-[#171717] dark:accent-[#EDEDED]"
              />
              <span>Remember me on this device</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-md bg-[#111111] dark:bg-[#EDEDED] px-4 py-2.5 text-sm font-medium text-white dark:text-[#111111] transition-colors hover:bg-[#262626] dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign in to Faculty Portal</span>
            )}
          </button>
        </form>

        {/* Footer info & links */}
        <div className="mt-6 border-t border-[#E5E5E5] dark:border-[#262626] pt-4 space-y-2 text-center">
          <p className="text-[11px] text-[#737373] dark:text-[#8C8C8C]">
            Access restricted to verified teaching faculty and academic staff.
          </p>
          <div className="pt-1 text-[11px] text-[#737373] dark:text-[#8C8C8C]">
            Student?{' '}
            <Link
              href="/student/login"
              className="font-medium text-[#171717] dark:text-[#EDEDED] hover:underline"
            >
              Student Portal
            </Link>
            {' '}&bull;{' '}
            <Link
              href="/login"
              className="font-medium text-[#171717] dark:text-[#EDEDED] hover:underline"
            >
              Administrator Portal
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-5 text-center text-[11px] text-[#A3A3A3] dark:text-[#666666]">
        CampusOS &bull; Unified College Management System
      </p>
    </div>
  );
}

export default function TeacherLoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F7F7] dark:bg-[#0A0A0A] px-4 py-8 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Suspense
        fallback={
          <div className="w-full max-w-sm rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#141414] p-8 text-center text-xs text-[#737373] dark:text-[#8C8C8C]">
            Loading Faculty Portal...
          </div>
        }
      >
        <TeacherLoginForm />
      </Suspense>
    </div>
  );
}
