'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { setupPasswordAction } from '@/app/actions/auth';

export default function PasswordSetupPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await setupPasswordAction(null, formData);

      if (result?.error) {
        setErrorMessage(result.error);
      } else if (result?.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push(result.destination || '/student/dashboard');
          router.refresh();
        }, 1200);
      }
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F7F7] px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Activation Card */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <span className="text-xl font-semibold tracking-tight text-[#171717] select-none">
                Campus<span className="text-[#737373]">OS</span>
              </span>
              <span className="rounded border border-[#E5E5E5] bg-[#F7F7F7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
                Activation
              </span>
            </div>
            <h1 className="mt-6 text-lg font-semibold text-[#171717]">
              Create Your Password
            </h1>
            <p className="mt-1 text-xs text-[#737373] leading-relaxed">
              Your email has been verified. Set a secure password to activate your personal portal account.
            </p>
          </div>

          {/* Success Banner */}
          {success && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-md border border-[#171717] bg-[#F7F7F7] p-3 text-xs text-[#171717]"
            >
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#171717]" />
              <div>
                <p className="font-semibold">Password established successfully!</p>
                <p className="text-[11px] text-[#737373] mt-0.5">
                  Redirecting to your dashboard...
                </p>
              </div>
            </div>
          )}

          {/* Error Banner */}
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

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-[#171717] mb-1.5"
                >
                  New Password <span className="text-[#737373] font-normal">(min. 8 characters)</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    placeholder="••••••••"
                    disabled={isPending}
                    className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none transition-colors disabled:bg-[#FAFAFA]"
                  />
                  <Lock
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] pointer-events-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-medium text-[#171717] mb-1.5"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    placeholder="••••••••"
                    disabled={isPending}
                    className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none transition-colors disabled:bg-[#FAFAFA]"
                  />
                  <Lock
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] pointer-events-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-[#111111] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Setting Password...</span>
                  </>
                ) : (
                  <span>Activate & Access Dashboard</span>
                )}
              </button>
            </form>
          )}

          {/* Footer note */}
          <div className="mt-8 border-t border-[#E5E5E5] pt-4 text-center">
            <p className="text-[11px] text-[#737373]">
              Need assistance? Contact your college registrar or administrator.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-[#A3A3A3]">
          CampusOS &bull; Portal Account Activation
        </p>
      </div>
    </div>
  );
}
