'use client';

import { Suspense, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Loader2, BookOpen } from 'lucide-react';
import { loginAction } from '@/app/actions/auth';
import { getSafeRedirectUrl } from '@/src/lib/security';

function TeacherLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  const redirectTo = getSafeRedirectUrl(searchParams.get('redirectTo'));

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
      <div className="rounded-xl border border-[#E5E5E5] bg-white p-8 shadow-sm">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <span className="text-xl font-semibold tracking-tight text-[#171717] select-none">
              Campus<span className="text-[#737373]">OS</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-[#E5E5E5] bg-[#F7F7F7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#171717]">
              <BookOpen size={11} />
              Faculty Portal
            </span>
          </div>
          <h1 className="mt-6 text-lg font-semibold text-[#171717]">
            Faculty Sign In
          </h1>
          <p className="mt-1 text-xs text-[#737373] leading-relaxed">
            Enter your faculty credentials to manage student attendance, rosters, and coursework.
          </p>
        </div>

        {/* Error State Banner */}
        {errorMessage && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-5 flex items-start gap-2.5 rounded-md border border-[#171717] bg-[#F7F7F7] p-3 text-xs text-[#171717]"
          >
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#171717]" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="identifier"
              className="block text-xs font-medium text-[#171717] mb-1.5"
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
              className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none transition-colors disabled:bg-[#FAFAFA] disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-[#171717] mb-1.5"
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
              className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none transition-colors disabled:bg-[#FAFAFA] disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex items-center text-xs">
            <label
              htmlFor="remember_me"
              className="flex items-center gap-2 cursor-pointer select-none text-[#737373] hover:text-[#171717]"
            >
              <input
                id="remember_me"
                name="remember_me"
                type="checkbox"
                defaultChecked={false}
                disabled={isPending}
                className="h-3.5 w-3.5 rounded border-[#E5E5E5] text-[#171717] focus:ring-0 focus:outline-none accent-[#171717]"
              />
              <span>Remember me on this device</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-[#111111] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="mt-8 border-t border-[#E5E5E5] pt-4 space-y-2 text-center">
          <p className="text-[11px] text-[#737373]">
            Access restricted to verified teaching faculty and academic staff.
          </p>
          <div className="pt-2 text-[11px] text-[#737373]">
            Student?{' '}
            <Link
              href="/student/login"
              className="font-medium text-[#171717] hover:underline"
            >
              Student Portal
            </Link>
            {' '}&bull;{' '}
            <Link
              href="/login"
              className="font-medium text-[#171717] hover:underline"
            >
              Unified Sign In
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-[11px] text-[#A3A3A3]">
        CampusOS &bull; Unified College Management System
      </p>
    </div>
  );
}

export default function TeacherLoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F7F7] px-4 py-12">
      <Suspense
        fallback={
          <div className="w-full max-w-sm rounded-xl border border-[#E5E5E5] bg-white p-8 text-center text-xs text-[#737373]">
            Loading Faculty Portal...
          </div>
        }
      >
        <TeacherLoginForm />
      </Suspense>
    </div>
  );
}
