/**
 * src/lib/recovery.ts
 *
 * Cryptographic server-side password recovery and OTP management engine for CampusOS.
 * Enforces:
 *  - Cryptographically secure 6-digit numeric OTP generation
 *  - Salted SHA-256 hash storage (never stores plaintext OTPs)
 *  - 5-minute strict expiration for OTP codes
 *  - Single-use enforcement (code invalidated on first use)
 *  - Anti-enumeration generic responses
 *  - Rate-limiting for both request dispatch and code verification attempts
 *  - Brute force lockout (max 5 failed verification attempts)
 *  - Tamper-proof signed reset tickets ensuring a session cannot change another user's password
 *  - Timing-safe cryptographic comparison
 */

import crypto from 'crypto';

const RECOVERY_PEPPER = 'campusos-auth-password-recovery-pepper-2026';
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const TICKET_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_VERIFY_ATTEMPTS = 5;
const REQUEST_COOLDOWN_MS = 60 * 1000; // 1 minute per request
const MAX_REQUESTS_PER_WINDOW = 3;
const REQUEST_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface StoredRecoveryOtp {
  hashedOtp: string;
  email: string;
  userId: string;
  expiresAt: number;
  attempts: number;
  lockedUntil?: number;
}

interface RequestRateEntry {
  count: number;
  firstRequestAt: number;
  lastRequestAt: number;
}

// In-memory server-side security cache (survives across requests within node process)
const recoveryStore = new Map<string, StoredRecoveryOtp>();
const requestRateStore = new Map<string, RequestRateEntry>();
const usedTicketsStore = new Set<string>();

/**
 * Periodically purge expired OTP entries and rate limit records
 */
function cleanupExpired() {
  const now = Date.now();
  for (const [key, entry] of recoveryStore.entries()) {
    if (entry.expiresAt < now) {
      recoveryStore.delete(key);
    }
  }
  for (const [key, entry] of requestRateStore.entries()) {
    if (now - entry.firstRequestAt > REQUEST_WINDOW_MS) {
      requestRateStore.delete(key);
    }
  }
}

/**
 * Derives a secure signing key for reset tickets from environment or secure constant
 */
function getSigningKey(): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'campusos-recovery-hmac-key-2026';
  return crypto.createHash('sha256').update(`${secret}:${RECOVERY_PEPPER}`).digest();
}

/**
 * Hashes an OTP with the user's email and pepper using SHA-256
 */
export function hashRecoveryOtp(otp: string, email: string): string {
  const cleanEmail = email.trim().toLowerCase();
  return crypto
    .createHash('sha256')
    .update(`${otp}:${cleanEmail}:${RECOVERY_PEPPER}`)
    .digest('hex');
}

/**
 * Generates a cryptographically secure 6-digit numeric OTP string
 */
export function generateRecoveryOtp(): string {
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}

/**
 * Checks whether an email has exceeded request rate limits
 */
export function checkRequestRateLimit(email: string): { allowed: boolean; retryAfterSeconds?: number } {
  cleanupExpired();
  const cleanEmail = email.trim().toLowerCase();
  const now = Date.now();
  const entry = requestRateStore.get(cleanEmail);

  if (!entry) {
    requestRateStore.set(cleanEmail, {
      count: 1,
      firstRequestAt: now,
      lastRequestAt: now,
    });
    return { allowed: true };
  }

  // Reset window if expired
  if (now - entry.firstRequestAt > REQUEST_WINDOW_MS) {
    requestRateStore.set(cleanEmail, {
      count: 1,
      firstRequestAt: now,
      lastRequestAt: now,
    });
    return { allowed: true };
  }

  // Check cooldown between successive requests
  if (now - entry.lastRequestAt < REQUEST_COOLDOWN_MS) {
    const retryAfter = Math.ceil((REQUEST_COOLDOWN_MS - (now - entry.lastRequestAt)) / 1000);
    return { allowed: false, retryAfterSeconds: retryAfter };
  }

  // Check total requests in window
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((REQUEST_WINDOW_MS - (now - entry.firstRequestAt)) / 1000);
    return { allowed: false, retryAfterSeconds: retryAfter };
  }

  entry.count += 1;
  entry.lastRequestAt = now;
  return { allowed: true };
}

/**
 * Stores a hashed OTP verifier for an account. Plaintext OTP is NEVER stored.
 */
export function storeRecoveryOtp(email: string, userId: string, rawOtp: string): void {
  const cleanEmail = email.trim().toLowerCase();
  const hashedOtp = hashRecoveryOtp(rawOtp, cleanEmail);

  recoveryStore.set(cleanEmail, {
    hashedOtp,
    email: cleanEmail,
    userId,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
  });
}

/**
 * Verifies a submitted OTP code timing-safely.
 * Returns a secure reset ticket on success, or an error status on failure.
 */
export function verifyRecoveryOtp(
  email: string,
  enteredOtp: string
): { success: boolean; error?: string; ticket?: string; userId?: string } {
  cleanupExpired();
  const cleanEmail = email.trim().toLowerCase();
  const entry = recoveryStore.get(cleanEmail);
  const now = Date.now();

  if (!entry) {
    return {
      success: false,
      error: 'Invalid or expired verification code. Please request a new code.',
    };
  }

  // Check lockout
  if (entry.lockedUntil && entry.lockedUntil > now) {
    const remainingMins = Math.ceil((entry.lockedUntil - now) / (60 * 1000));
    return {
      success: false,
      error: `Too many failed attempts. This recovery request is locked for ${remainingMins} minute(s).`,
    };
  }

  // Check expiry
  if (entry.expiresAt < now) {
    recoveryStore.delete(cleanEmail);
    return {
      success: false,
      error: 'Verification code has expired. Please request a new code.',
    };
  }

  // Check max attempts
  if (entry.attempts >= MAX_VERIFY_ATTEMPTS) {
    entry.lockedUntil = now + 15 * 60 * 1000;
    return {
      success: false,
      error: 'Too many failed attempts. This recovery request has been locked.',
    };
  }

  const cleanEnteredOtp = (enteredOtp || '').trim();
  if (cleanEnteredOtp.length !== 6 || !/^\d{6}$/.test(cleanEnteredOtp)) {
    entry.attempts += 1;
    return {
      success: false,
      error: 'Invalid code format. Please enter the 6-digit numeric code.',
    };
  }

  // Timing-safe verification
  const candidateHash = hashRecoveryOtp(cleanEnteredOtp, cleanEmail);
  const candidateBuffer = Buffer.from(candidateHash, 'hex');
  const storedBuffer = Buffer.from(entry.hashedOtp, 'hex');

  const matches =
    candidateBuffer.length === storedBuffer.length &&
    crypto.timingSafeEqual(candidateBuffer, storedBuffer);

  if (!matches) {
    entry.attempts += 1;
    const remainingAttempts = MAX_VERIFY_ATTEMPTS - entry.attempts;
    if (remainingAttempts <= 0) {
      entry.lockedUntil = now + 15 * 60 * 1000;
      return {
        success: false,
        error: 'Too many failed attempts. This recovery request has been locked.',
      };
    }
    return {
      success: false,
      error: `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`,
    };
  }

  // SUCCESS: Invalidate the OTP immediately (single-use)
  const targetUserId = entry.userId;
  recoveryStore.delete(cleanEmail);

  // Generate a tamper-proof, single-use password reset ticket
  const ticket = generateResetTicket(cleanEmail, targetUserId);

  return {
    success: true,
    ticket,
    userId: targetUserId,
  };
}

/**
 * Creates a signed, tamper-proof reset ticket containing userId and email.
 * Format: payloadHex.hmacSignature
 */
export function generateResetTicket(email: string, userId: string): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = JSON.stringify({
    email: email.trim().toLowerCase(),
    userId,
    nonce,
    expiresAt: Date.now() + TICKET_EXPIRY_MS,
  });

  const payloadHex = Buffer.from(payload, 'utf8').toString('hex');
  const hmac = crypto.createHmac('sha256', getSigningKey()).update(payloadHex).digest('hex');

  return `${payloadHex}.${hmac}`;
}

/**
 * Validates and consumes a reset ticket.
 * Ensures the ticket is cryptographically authentic, unexpired, and has not been used previously.
 */
export function validateAndConsumeResetTicket(
  ticket: string
): { valid: boolean; email?: string; userId?: string; error?: string } {
  if (!ticket || !ticket.includes('.')) {
    return { valid: false, error: 'Invalid or missing password recovery ticket.' };
  }

  const [payloadHex, signature] = ticket.split('.');
  if (!payloadHex || !signature) {
    return { valid: false, error: 'Malformed password recovery ticket.' };
  }

  // Verify HMAC signature
  const expectedHmac = crypto.createHmac('sha256', getSigningKey()).update(payloadHex).digest('hex');
  const sigBuffer = Buffer.from(signature, 'hex');
  const expBuffer = Buffer.from(expectedHmac, 'hex');

  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return { valid: false, error: 'Tampered or invalid password recovery ticket.' };
  }

  // Check if ticket was already used
  if (usedTicketsStore.has(ticket)) {
    return { valid: false, error: 'This recovery ticket has already been used. Please request a new code.' };
  }

  try {
    const payloadStr = Buffer.from(payloadHex, 'hex').toString('utf8');
    const parsed = JSON.parse(payloadStr) as {
      email: string;
      userId: string;
      nonce: string;
      expiresAt: number;
    };

    if (Date.now() > parsed.expiresAt) {
      return { valid: false, error: 'This recovery ticket has expired. Please request a new code.' };
    }

    // Mark as consumed immediately
    usedTicketsStore.add(ticket);

    return {
      valid: true,
      email: parsed.email,
      userId: parsed.userId,
    };
  } catch {
    return { valid: false, error: 'Failed to read recovery ticket payload.' };
  }
}
