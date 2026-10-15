/**
 * src/lib/session.ts
 *
 * Session security configuration and utilities for CampusOS.
 * Enforces a 15-minute server-enforced idle session timeout across all portals.
 * Supports cross-tab synchronization and pre-expiration warning.
 */

// 15 minutes of inactivity before the session is expired on the server
export const SESSION_IDLE_TIMEOUT_SECONDS = 15 * 60; // 900 seconds
export const SESSION_IDLE_TIMEOUT_MS = SESSION_IDLE_TIMEOUT_SECONDS * 1000;

// Warning shown 2 minutes prior to session expiration
export const SESSION_WARNING_SECONDS = 2 * 60; // 120 seconds
export const SESSION_WARNING_MS = SESSION_WARNING_SECONDS * 1000;

// Minimum time elapsed between writing updated activity timestamps to prevent cookie churn
export const ACTIVITY_REFRESH_THROTTLE_SECONDS = 30; // 30 seconds
export const ACTIVITY_REFRESH_THROTTLE_MS = ACTIVITY_REFRESH_THROTTLE_SECONDS * 1000;

// Cookie identifiers
export const CAMPUSOS_ACTIVITY_COOKIE = 'campusos_last_activity';
export const CAMPUSOS_REMEMBER_COOKIE = 'campusos_remember';

/**
 * Checks whether an activity timestamp represents an expired idle session.
 *
 * @param lastActivityTime - Epoch milliseconds of last recorded activity
 * @param currentTime - Optional current epoch milliseconds (defaults to Date.now())
 */
export function isSessionExpired(
  lastActivityTime: number | null | undefined,
  currentTime?: number
): boolean {
  if (!lastActivityTime || isNaN(lastActivityTime)) {
    return false;
  }

  const now = currentTime ?? Date.now();

  // Sanity check: Reject timestamps claimed to be in the far future (> 60s ahead)
  if (lastActivityTime > now + 60_000) {
    return true;
  }

  return now - lastActivityTime > SESSION_IDLE_TIMEOUT_MS;
}

/**
 * Parses and validates an activity timestamp cookie.
 */
export function parseActivityTimestamp(value: string | undefined | null): number | null {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * Formats seconds into MM:SS display format for warning timers.
 */
export function formatSecondsRemaining(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.floor(Math.max(0, seconds) % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
