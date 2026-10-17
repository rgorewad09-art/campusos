'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Lock,
  Mail,
  KeyRound,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
  RotateCcw,
  Shield,
  GraduationCap,
  Users,
} from 'lucide-react';
import {
  requestPasswordRecoveryAction,
  verifyPasswordRecoveryOtpAction,
  resetPasswordWithTicketAction,
} from '@/app/actions/recovery';
import ThemeToggle from '@/app/components/ThemeToggle';

export default function ForgotPasswordView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role') || 'student';

  // Step: 'request' | 'verify' | 'reset' | 'completed'
  const [step, setStep] = useState<'request' | 'verify' | 'reset' | 'completed'>('request');

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Countdown timer for 5-minute OTP expiry
  const [secondsRemaining, setSecondsRemaining] = useState(300);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerActive && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => prev - 1);
      }, 1000);
    } else if (secondsRemaining === 0) {
      setIsTimerActive(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerActive, secondsRemaining]);

  // Resend cooldown timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendCooldown]);

  const backToLoginUrl =
    roleParam === 'admin'
      ? '/login'
      : roleParam === 'teacher'
      ? '/teacher/login'
      : '/student/login';

  const roleLabel =
    roleParam === 'admin'
      ? 'Administrator'
      : roleParam === 'teacher'
      ? 'Faculty'
      : 'Student';

  const RoleIcon =
    roleParam === 'admin'
      ? Shield
      : roleParam === 'teacher'
      ? GraduationCap
      : Users;

  // Step 1: Request Code
  function handleRequestCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const formData = new FormData(e.currentTarget);
    const identifier = formData.get('identifier')?.toString() || '';

    startTransition(async () => {
      const res = await requestPasswordRecoveryAction(null, formData);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setEmail(res.email || identifier);
        setInfoMessage(
          res.message ||
            'If an account exists for this identifier, a 6-digit recovery code has been dispatched.'
        );
        setSecondsRemaining(300); // 5 minutes
        setIsTimerActive(true);
        setResendCooldown(60); // 1-minute cooldown
        setStep('verify');
      }
    });
  }

  // Step 2: Verify Code
  function handleVerifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (secondsRemaining <= 0) {
      setErrorMessage('The verification code has expired. Please request a new code.');
      return;
    }

    const formData = new FormData();
    formData.append('email', email);
    formData.append('code', code);

    startTransition(async () => {
      const res = await verifyPasswordRecoveryOtpAction(null, formData);
      if (res.error) {
        setErrorMessage(res.error);
      } else if (res.ticket) {
        setTicket(res.ticket);
        setIsTimerActive(false);
        setInfoMessage('Verification successful. Please choose your new password.');
        setStep('reset');
      }
    });
  }

  // Resend code handler
  function handleResend() {
    if (resendCooldown > 0) return;
    setErrorMessage(null);
    setInfoMessage(null);

    const formData = new FormData();
    formData.append('identifier', email);

    startTransition(async () => {
      const res = await requestPasswordRecoveryAction(null, formData);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setInfoMessage('A new verification code has been dispatched to your email.');
        setSecondsRemaining(300);
        setIsTimerActive(true);
        setResendCooldown(60);
      }
    });
  }

  // Step 3: Reset Password
  function handleResetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters in length.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your password.');
      return;
    }

    const formData = new FormData();
    formData.append('ticket', ticket);
    formData.append('password', password);
    formData.append('confirm_password', confirmPassword);

    startTransition(async () => {
      const res = await resetPasswordWithTicketAction(null, formData);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setStep('completed');
        setTimeout(() => {
          router.push(res.destination || backToLoginUrl);
          router.refresh();
        }, 1500);
      }
    });
  }

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F7F7] dark:bg-[#0A0A0A] px-4 py-12 transition-colors">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        {/* Recovery Card */}
        <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#141414] p-6 sm:p-7 shadow-xs">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <span className="text-xl font-semibold tracking-tight text-[#171717] dark:text-[#EDEDED] select-none">
                Campus<span className="text-[#737373] dark:text-[#8C8C8C]">OS</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] dark:border-[#333333] bg-[#F7F7F7] dark:bg-[#1E1E1E] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#171717] dark:text-[#EDEDED]">
                <RoleIcon size={12} className="text-[#171717] dark:text-[#EDEDED]" />
                {roleLabel} Recovery
              </span>
            </div>

            <h1 className="mt-5 text-base sm:text-lg font-semibold text-[#171717] dark:text-[#EDEDED]">
              {step === 'request' && 'Password Recovery'}
              {step === 'verify' && 'Enter Verification Code'}
              {step === 'reset' && 'Set New Password'}
              {step === 'completed' && 'Password Reset Complete'}
            </h1>
            <p className="mt-1 text-xs text-[#737373] dark:text-[#8C8C8C] leading-relaxed">
              {step === 'request' &&
                'Enter your registered email address or institutional ID to receive a secure 6-digit recovery code.'}
              {step === 'verify' &&
                `We've sent a 6-digit verification code to your registered email. Codes expire after 5 minutes.`}
              {step === 'reset' &&
                'Choose a strong, unique password with at least 8 characters to secure your account.'}
              {step === 'completed' &&
                'Your password has been successfully updated. Redirecting to your sign-in portal...'}
            </p>
          </div>

          {/* Info Banner */}
          {infoMessage && step !== 'completed' && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2.5 rounded-lg border border-[#E5E5E5] dark:border-[#333333] bg-[#F7F7F7] dark:bg-[#1E1E1E] p-3 text-xs text-[#171717] dark:text-[#EDEDED]"
            >
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#171717] dark:text-[#EDEDED]" />
              <div className="flex-1 leading-relaxed">{infoMessage}</div>
            </div>
          )}

          {/* Error Banner */}
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

          {/* STEP 1: Request Code */}
          {step === 'request' && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <label
                  htmlFor="identifier"
                  className="block text-xs font-medium text-[#171717] dark:text-[#EDEDED] mb-1.5"
                >
                  Email address or Institutional ID
                </label>
                <div className="relative">
                  <input
                    id="identifier"
                    name="identifier"
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. user@campusos.com or STU-2026-0001"
                    disabled={isPending}
                    className="w-full rounded-md border border-[#E5E5E5] dark:border-[#333333] bg-white dark:bg-[#171717] pl-9 pr-3 py-2 text-sm text-[#171717] dark:text-[#EDEDED] placeholder:text-[#A3A3A3] dark:placeholder:text-[#666666] focus:border-[#171717] dark:focus:border-[#EDEDED] focus:outline-none transition-colors disabled:opacity-50"
                  />
                  <Mail
                    size={15}
                    className="absolute left-3 top-2.5 text-[#A3A3A3] dark:text-[#666666]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[#111111] dark:bg-[#EDEDED] px-4 py-2.5 text-sm font-medium text-white dark:text-[#111111] transition-colors hover:bg-[#262626] dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Sending code...</span>
                  </>
                ) : (
                  <span>Send Verification Code</span>
                )}
              </button>

              <div className="pt-2 text-center">
                <Link
                  href={backToLoginUrl}
                  className="inline-flex items-center gap-1.5 text-xs text-[#737373] dark:text-[#8C8C8C] hover:text-[#171717] dark:hover:text-[#EDEDED] transition-colors"
                >
                  <ArrowLeft size={13} />
                  <span>Back to {roleLabel} Sign In</span>
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: Verify Code */}
          {step === 'verify' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="code"
                    className="block text-xs font-medium text-[#171717] dark:text-[#EDEDED]"
                  >
                    6-Digit Verification Code
                  </label>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-mono font-medium ${
                      secondsRemaining <= 60
                        ? 'text-red-600 dark:text-red-400 font-bold'
                        : 'text-[#737373] dark:text-[#8C8C8C]'
                    }`}
                    title="Code expiration countdown"
                  >
                    <Clock size={12} />
                    <span>{formatTimer(secondsRemaining)}</span>
                  </span>
                </div>

                <div className="relative">
                  <input
                    id="code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    disabled={isPending || secondsRemaining <= 0}
                    className="w-full text-center tracking-[0.35em] font-mono font-bold text-base rounded-md border border-[#E5E5E5] dark:border-[#333333] bg-white dark:bg-[#171717] px-3 py-2 text-[#171717] dark:text-[#EDEDED] placeholder:text-[#A3A3A3] dark:placeholder:text-[#666666] focus:border-[#171717] dark:focus:border-[#EDEDED] focus:outline-none transition-colors disabled:opacity-50"
                  />
                  <KeyRound
                    size={15}
                    className="absolute left-3 top-2.5 text-[#A3A3A3] dark:text-[#666666]"
                  />
                </div>

                {secondsRemaining <= 0 && (
                  <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                    This verification code has expired. Please request a new code below.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isPending || code.length !== 6 || secondsRemaining <= 0}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[#111111] dark:bg-[#EDEDED] px-4 py-2.5 text-sm font-medium text-white dark:text-[#111111] transition-colors hover:bg-[#262626] dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Verifying code...</span>
                  </>
                ) : (
                  <span>Verify Code</span>
                )}
              </button>

              {/* Resend Action */}
              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isPending || resendCooldown > 0}
                  className="inline-flex items-center gap-1.5 text-[#737373] dark:text-[#8C8C8C] hover:text-[#171717] dark:hover:text-[#EDEDED] transition-colors disabled:opacity-50"
                >
                  <RotateCcw size={12} />
                  <span>
                    {resendCooldown > 0
                      ? `Resend available in ${resendCooldown}s`
                      : 'Resend verification code'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep('request');
                    setCode('');
                    setErrorMessage(null);
                    setInfoMessage(null);
                  }}
                  className="text-[#737373] dark:text-[#8C8C8C] hover:text-[#171717] dark:hover:text-[#EDEDED] transition-colors"
                >
                  Change Email
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Reset Password */}
          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-[#171717] dark:text-[#EDEDED] mb-1.5"
                >
                  New Password <span className="text-[#737373] dark:text-[#8C8C8C] font-normal">(min. 8 characters)</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isPending}
                    className="w-full rounded-md border border-[#E5E5E5] dark:border-[#333333] bg-white dark:bg-[#171717] pl-9 pr-3 py-2 text-sm text-[#171717] dark:text-[#EDEDED] placeholder:text-[#A3A3A3] dark:placeholder:text-[#666666] focus:border-[#171717] dark:focus:border-[#EDEDED] focus:outline-none transition-colors disabled:opacity-50"
                  />
                  <Lock
                    size={15}
                    className="absolute left-3 top-2.5 text-[#A3A3A3] dark:text-[#666666]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm_password"
                  className="block text-xs font-medium text-[#171717] dark:text-[#EDEDED] mb-1.5"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirm_password"
                    name="confirm_password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isPending}
                    className="w-full rounded-md border border-[#E5E5E5] dark:border-[#333333] bg-white dark:bg-[#171717] pl-9 pr-3 py-2 text-sm text-[#171717] dark:text-[#EDEDED] placeholder:text-[#A3A3A3] dark:placeholder:text-[#666666] focus:border-[#171717] dark:focus:border-[#EDEDED] focus:outline-none transition-colors disabled:opacity-50"
                  />
                  <Lock
                    size={15}
                    className="absolute left-3 top-2.5 text-[#A3A3A3] dark:text-[#666666]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending || password.length < 8}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[#111111] dark:bg-[#EDEDED] px-4 py-2.5 text-sm font-medium text-white dark:text-[#111111] transition-colors hover:bg-[#262626] dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Updating password...</span>
                  </>
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </form>
          )}

          {/* STEP 4: Completed State */}
          {step === 'completed' && (
            <div className="text-center py-4 space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F7F7] dark:bg-[#1E1E1E] text-[#171717] dark:text-[#EDEDED]">
                <CheckCircle2 size={24} />
              </div>
              <p className="text-sm font-semibold text-[#171717] dark:text-[#EDEDED]">
                Password Reset Successfully
              </p>
              <p className="text-xs text-[#737373] dark:text-[#8C8C8C]">
                Redirecting to your sign-in portal now...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
