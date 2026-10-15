/**
 * src/lib/otp.ts
 *
 * Cryptographic engine for short-lived attendance OTP generation,
 * secure hashing, timing-safe validation, and teacher-only AES-256 recovery.
 */

import crypto from 'crypto';

const HASH_PEPPER = 'campusos-attendance-otp-pepper-2026';

/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 */
export function generateAttendanceOtp(): string {
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}

/**
 * Computes a SHA-256 hash of the OTP combined with a session-specific salt.
 */
export function hashAttendanceOtp(otp: string, sessionId: string): string {
  return crypto
    .createHash('sha256')
    .update(`${otp}:${sessionId}:${HASH_PEPPER}`)
    .digest('hex');
}

/**
 * Timing-safe comparison to verify whether the entered OTP matches the stored hash.
 */
export function verifyAttendanceOtp(
  enteredOtp: string,
  storedHash: string,
  sessionId: string
): boolean {
  if (!enteredOtp || !storedHash || !sessionId) return false;
  const cleanOtp = enteredOtp.trim();
  if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) return false;

  const candidateHash = hashAttendanceOtp(cleanOtp, sessionId);
  const candidateBuffer = Buffer.from(candidateHash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');

  if (candidateBuffer.length !== storedBuffer.length) return false;

  return crypto.timingSafeEqual(candidateBuffer, storedBuffer);
}

/**
 * Generates an encryption key derived from SUPABASE_SERVICE_ROLE_KEY or a secure fallback.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'campusos-default-attendance-key-2026';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts the OTP using AES-256-GCM so the generating teacher can display it on reload.
 * Raw OTPs are never exposed in public queries or client tables.
 */
export function encryptAttendanceOtp(otp: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(otp, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts the AES-256-GCM encrypted OTP for the authenticated teacher.
 */
export function decryptAttendanceOtp(encryptedPayload: string): string | null {
  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) return null;

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}
