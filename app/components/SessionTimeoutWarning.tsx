'use client';

/**
 * app/components/SessionTimeoutWarning.tsx
 *
 * Client-side idle detection and pre-expiration warning dialog for CampusOS.
 * - Displays a warning modal 2 minutes before the 15-minute server session expiration.
 * - Synchronizes state across all open browser tabs using BroadcastChannel & Storage events.
 * - Extends server session when user explicitly clicks "Stay Logged In".
 * - Safely terminates session and redirects on expiration or explicit sign-out.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle, Clock, LogOut, ShieldCheck, Loader2 } from 'lucide-react';
import { refreshSessionAction, logoutAction } from '@/app/actions/auth';
import {
  SESSION_IDLE_TIMEOUT_SECONDS,
  SESSION_WARNING_SECONDS,
  formatSecondsRemaining,
} from '@/src/lib/session';

const WARNING_THRESHOLD_SECONDS = SESSION_IDLE_TIMEOUT_SECONDS - SESSION_WARNING_SECONDS; // 780s (13m)
const SYNC_CHANNEL_NAME = 'campusos_session_sync';
const STORAGE_ACTIVITY_KEY = 'campusos_tab_last_activity';
const STORAGE_LOGOUT_KEY = 'campusos_tab_logout';

function getPortalLoginUrl(errorType: 'logged_out' | 'session_expired'): string {
  if (typeof window === 'undefined') return `/login?error=${errorType}`;
  const pathname = window.location.pathname;
  if (pathname.startsWith('/student')) {
    return `/student/login?error=${errorType}`;
  }
  if (pathname.startsWith('/teacher')) {
    return `/teacher/login?error=${errorType}`;
  }
  return `/login?error=${errorType}`;
}

export default function SessionTimeoutWarning() {
  const [isMounted, setIsMounted] = useState(false);
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(SESSION_WARNING_SECONDS);
  const [isExtending, setIsExtending] = useState(false);

  // References to keep track of activity without triggering excessive re-renders
  const lastActiveRef = useRef<number>(0);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Notify other tabs of activity or session extension
  const broadcastActivity = useCallback((type: 'ACTIVE' | 'EXTEND' | 'LOGOUT') => {
    try {
      if (channelRef.current) {
        channelRef.current.postMessage({ type, timestamp: Date.now() });
      }
      if (type === 'EXTEND' || type === 'ACTIVE') {
        localStorage.setItem(STORAGE_ACTIVITY_KEY, String(Date.now()));
      } else if (type === 'LOGOUT') {
        localStorage.setItem(STORAGE_LOGOUT_KEY, String(Date.now()));
      }
    } catch {
      // Fallback for restricted storage environments
    }
  }, []);

  // Handle user choosing to stay logged in
  const handleStayLoggedIn = useCallback(async () => {
    setIsExtending(true);
    try {
      const res = await refreshSessionAction();
      if (res?.success) {
        lastActiveRef.current = Date.now();
        setIsWarningOpen(false);
        setSecondsRemaining(SESSION_WARNING_SECONDS);
        broadcastActivity('EXTEND');
      } else {
        // If server indicates session is already invalid, sign out
        await logoutAction(getPortalLoginUrl('session_expired'));
      }
    } catch {
      await logoutAction(getPortalLoginUrl('session_expired'));
    } finally {
      setIsExtending(false);
    }
  }, [broadcastActivity]);

  // Handle explicit sign-out from the modal
  const handleSignOut = useCallback(async () => {
    broadcastActivity('LOGOUT');
    await logoutAction(getPortalLoginUrl('logged_out'));
  }, [broadcastActivity]);

  useEffect(() => {
    setIsMounted(true);
    lastActiveRef.current = Date.now();

    // 1. Initialize BroadcastChannel for cross-tab communication
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channelRef.current = new BroadcastChannel(SYNC_CHANNEL_NAME);
      channelRef.current.onmessage = (event) => {
        const { type } = event.data || {};
        if (type === 'EXTEND' || type === 'ACTIVE') {
          lastActiveRef.current = Date.now();
          setIsWarningOpen(false);
          setSecondsRemaining(SESSION_WARNING_SECONDS);
        } else if (type === 'LOGOUT') {
          window.location.href = getPortalLoginUrl('logged_out');
        }
      };
    }

    // 2. Storage event listener fallback for older browsers or cross-origin tabs
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_ACTIVITY_KEY && event.newValue) {
        lastActiveRef.current = Number(event.newValue) || Date.now();
        setIsWarningOpen(false);
        setSecondsRemaining(SESSION_WARNING_SECONDS);
      } else if (event.key === STORAGE_LOGOUT_KEY) {
        window.location.href = getPortalLoginUrl('logged_out');
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. User activity tracking (throttled to avoid performance overhead)
    let lastThrottledRecord = 0;
    const handleUserInteraction = () => {
      const now = Date.now();
      // Only record if warning dialog is NOT open (if warning is open, user must click Stay Logged In)
      if (!isWarningOpen && now - lastThrottledRecord > 15_000) {
        lastThrottledRecord = now;
        lastActiveRef.current = now;
        broadcastActivity('ACTIVE');
      }
    };

    const interactionEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    interactionEvents.forEach((evt) =>
      window.addEventListener(evt, handleUserInteraction, { passive: true })
    );

    // 4. Timer interval: checks elapsed time every second
    const intervalId = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastActiveRef.current) / 1000);

      if (elapsedSeconds >= SESSION_IDLE_TIMEOUT_SECONDS) {
        // Expiration reached -> invoke logout
        clearInterval(intervalId);
        broadcastActivity('LOGOUT');
        window.location.href = getPortalLoginUrl('session_expired');
      } else if (elapsedSeconds >= WARNING_THRESHOLD_SECONDS) {
        // Within the warning window (last 2 minutes)
        setIsWarningOpen(true);
        const remaining = Math.max(0, SESSION_IDLE_TIMEOUT_SECONDS - elapsedSeconds);
        setSecondsRemaining(remaining);
      } else {
        // Active and outside warning window
        setIsWarningOpen(false);
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
      interactionEvents.forEach((evt) =>
        window.removeEventListener(evt, handleUserInteraction)
      );
      window.removeEventListener('storage', handleStorage);
      if (channelRef.current) {
        channelRef.current.close();
      }
    };
  }, [broadcastActivity, isWarningOpen]);

  if (!isMounted || !isWarningOpen) {
    return null;
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-warning-title"
      aria-describedby="session-warning-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-sm rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl text-[#171717]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F7F7F7] border border-[#E5E5E5] text-[#171717]">
            <Clock size={20} />
          </div>
          <div>
            <h2 id="session-warning-title" className="text-sm font-semibold tracking-tight">
              Session Inactivity Warning
            </h2>
            <p className="text-[11px] text-[#737373]">
              CampusOS Shared Device Protection
            </p>
          </div>
        </div>

        {/* Content */}
        <div id="session-warning-desc" className="space-y-3 mb-6">
          <p className="text-xs text-[#737373] leading-relaxed">
            You have been inactive for nearly 15 minutes. For your security on shared computers and devices, your session will expire in:
          </p>

          <div className="flex items-center justify-center rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] py-3 text-2xl font-bold tracking-tight text-[#171717] font-mono">
            {formatSecondsRemaining(secondsRemaining)}
          </div>

          <p className="text-[11px] text-[#A3A3A3] text-center">
            Click &ldquo;Stay Logged In&rdquo; to continue working without interruption.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleStayLoggedIn}
            disabled={isExtending}
            className="flex-1 flex items-center justify-center gap-2 rounded-md bg-[#111111] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#262626] transition-colors disabled:opacity-50"
          >
            {isExtending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Extending...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={14} />
                <span>Stay Logged In</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isExtending}
            className="flex items-center justify-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-xs font-medium text-[#737373] hover:text-[#171717] hover:border-[#171717] transition-colors disabled:opacity-50"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
