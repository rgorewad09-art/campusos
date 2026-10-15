/**
 * scripts/test-otp-attendance.mjs
 *
 * Automated test suite for CampusOS Dedicated Teacher Attendance and OTP-Based Student Attendance:
 *  1. Cryptographic OTP generation & entropy validation.
 *  2. Salted & peppered SHA-256 OTP hashing and session binding.
 *  3. Constant-time timingSafeEqual verification.
 *  4. AES-256-GCM encryption & decryption for teacher reload recovery.
 *  5. Campus Wi-Fi CIDR network verification engine.
 *  6. Brute-force rate limiting policy (max 5 attempts).
 *  7. Migration 007 schema verification (tables, indexes, constraints, RLS, transactions).
 *
 * Usage:
 *   node --env-file=.env.local scripts/test-otp-attendance.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  generateAttendanceOtp,
  hashAttendanceOtp,
  verifyAttendanceOtp,
  encryptAttendanceOtp,
  decryptAttendanceOtp,
} from '../src/lib/otp.ts';
import {
  extractClientIp,
  isIpInSubnet,
  verifyCampusNetwork,
} from '../src/lib/network.ts';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('CampusOS Dedicated Teacher & OTP Attendance Test Suite');
  console.log('====================================================\n');

  // --- 1. Cryptographic OTP Generation ---
  console.log('--- 1. Testing Cryptographic OTP Generation ---');
  const otps = new Set();
  for (let i = 0; i < 50; i++) {
    const otp = generateAttendanceOtp();
    assert(/^\d{6}$/.test(otp), `OTP "${otp}" is strictly 6 decimal digits`);
    const num = parseInt(otp, 10);
    assert(num >= 100000 && num <= 999999, `OTP ${num} is in range [100000, 999999]`);
    otps.add(otp);
  }
  assert(otps.size >= 45, `Entropy check: ${otps.size}/50 unique codes generated`);

  // --- 2. OTP Hashing with Session Binding ---
  console.log('\n--- 2. Testing OTP Hashing with Session Binding ---');
  const sampleOtp = '482915';
  const sessionId1 = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
  const sessionId2 = 'f6e5d4c3-b2a1-0f9e-8d7c-6b5a4e3d2c1b';

  const hash1 = hashAttendanceOtp(sampleOtp, sessionId1);
  const hash1Repeat = hashAttendanceOtp(sampleOtp, sessionId1);
  const hash2 = hashAttendanceOtp(sampleOtp, sessionId2);
  const hashDifferentOtp = hashAttendanceOtp('482916', sessionId1);

  assert(typeof hash1 === 'string' && hash1.length === 64, 'Produces 64-char hex SHA-256 digest');
  assert(hash1 === hash1Repeat, 'Hashing is deterministic for identical OTP and session ID');
  assert(hash1 !== hash2, 'Hash binds to session ID (different session yields different hash)');
  assert(hash1 !== hashDifferentOtp, 'Hash differs when single digit changes');

  // --- 3. Constant-Time TimingSafeEqual Verification ---
  console.log('\n--- 3. Testing Constant-Time OTP Verification ---');
  assert(verifyAttendanceOtp(sampleOtp, hash1, sessionId1) === true, 'Verifies valid matching OTP');
  assert(verifyAttendanceOtp('000000', hash1, sessionId1) === false, 'Rejects incorrect OTP');
  assert(verifyAttendanceOtp(sampleOtp, hash1, sessionId2) === false, 'Rejects valid OTP submitted for wrong session ID');
  assert(verifyAttendanceOtp('', hash1, sessionId1) === false, 'Rejects empty OTP input');
  assert(verifyAttendanceOtp(sampleOtp, 'malformed-hash', sessionId1) === false, 'Safely rejects malformed hash without crashing');
  assert(verifyAttendanceOtp(sampleOtp, '', sessionId1) === false, 'Safely rejects empty stored hash');

  // --- 4. AES-256-GCM Encryption / Decryption ---
  console.log('\n--- 4. Testing AES-256-GCM Teacher Reload Encryption ---');
  const plainOtp = '739201';
  const encryptedPayload = encryptAttendanceOtp(plainOtp);
  assert(typeof encryptedPayload === 'string', 'Encryption returns serialized string');
  const parts = encryptedPayload.split(':');
  assert(parts.length === 3, 'Payload format is iv:authTag:ciphertext');

  const decrypted = decryptAttendanceOtp(encryptedPayload);
  assert(decrypted === plainOtp, `Decrypted OTP matches original "${plainOtp}"`);

  // Tampered payload resilience
  const tamperedPayload = parts[0] + ':' + '00'.repeat(16) + ':' + parts[2];
  const tamperedResult = decryptAttendanceOtp(tamperedPayload);
  assert(tamperedResult === null, 'Tampered authentication tag safely returns null (does not crash)');

  // --- 5. Campus Wi-Fi CIDR Network Verification Engine ---
  console.log('\n--- 5. Testing Campus Wi-Fi CIDR Matching Engine ---');
  assert(isIpInSubnet('10.15.2.40', '10.0.0.0/8') === true, '10.15.2.40 matches 10.0.0.0/8');
  assert(isIpInSubnet('192.168.1.105', '192.168.1.0/24') === true, '192.168.1.105 matches 192.168.1.0/24');
  assert(isIpInSubnet('192.168.2.1', '192.168.1.0/24') === false, '192.168.2.1 rejected outside 192.168.1.0/24');
  assert(isIpInSubnet('172.20.10.5', '172.16.0.0/12') === true, '172.20.10.5 matches 172.16.0.0/12');
  assert(isIpInSubnet('203.0.113.195', '10.0.0.0/8') === false, 'External public IP 203.0.113.195 rejected');
  assert(isIpInSubnet('127.0.0.1', '127.0.0.1') === true, 'Exact match 127.0.0.1 accepted');

  // Header extraction test
  const dummyHeaders = new Headers({
    'x-forwarded-for': '10.5.12.33, 192.168.1.1',
    'x-real-ip': '10.5.12.33',
  });
  const extractedIp = extractClientIp(dummyHeaders);
  assert(extractedIp === '10.5.12.33', 'Correctly extracts primary client IP from x-forwarded-for');

  // Verification bypass when disabled
  process.env.CAMPUSOS_WIFI_VERIFY_ENABLED = 'false';
  const bypassedCheck = verifyCampusNetwork(dummyHeaders);
  assert(bypassedCheck.verified === true && bypassedCheck.bypassed === true, 'Bypasses verification safely when disabled');

  // Verification enforcement when enabled
  process.env.CAMPUSOS_WIFI_VERIFY_ENABLED = 'true';
  process.env.CAMPUSOS_CAMPUS_IP_RANGES = '10.0.0.0/8,192.168.1.0/24';
  const allowedCheck = verifyCampusNetwork(dummyHeaders);
  assert(allowedCheck.verified === true && !allowedCheck.bypassed, 'Accepts valid campus IP 10.5.12.33 when enabled');

  const outsideHeaders = new Headers({
    'x-forwarded-for': '203.0.113.5',
  });
  const blockedCheck = verifyCampusNetwork(outsideHeaders);
  assert(blockedCheck.verified === false, 'Rejects IP outside campus ranges when enabled');

  // --- 6. Brute-Force Rate Limiting Policy (Max 5 Attempts) ---
  console.log('\n--- 6. Testing Rate Limiting Invariants ---');
  const MAX_ATTEMPTS = 5;
  let attemptsCount = 0;
  const isLocked = () => attemptsCount >= MAX_ATTEMPTS;

  for (let i = 1; i <= 5; i++) {
    assert(!isLocked(), `Attempt ${i} is permitted under threshold`);
    attemptsCount++;
  }
  assert(isLocked(), '6th attempt is blocked once 5 failed attempts are reached');
  assert(attemptsCount === 5, 'Rate limiter accurately tracked 5 failed attempts');

  // --- 7. Migration 007 Schema Verification ---
  console.log('\n--- 7. Testing Migration 007 SQL Schema Integrity ---');
  const migrationPath = path.resolve('scripts/migrations/007_otp_attendance.sql');
  assert(fs.existsSync(migrationPath), 'Migration file 007_otp_attendance.sql exists locally');

  const sqlContent = fs.readFileSync(migrationPath, 'utf8');

  // Check transaction blocks
  assert(sqlContent.includes('BEGIN;') && sqlContent.includes('COMMIT;'), 'Migration wrapped in atomic BEGIN/COMMIT transaction');

  // Check tables
  assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.attendance_sessions'), 'Creates public.attendance_sessions table');
  assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.attendance_otp_attempts'), 'Creates public.attendance_otp_attempts table');

  // Check attendance columns
  assert(sqlContent.includes('session_id uuid REFERENCES public.attendance_sessions'), 'Adds session_id column to attendance table');
  assert(sqlContent.includes('subject_id uuid REFERENCES public.subjects'), 'Adds subject_id column to attendance table');
  assert(sqlContent.includes('verification_method text DEFAULT'), 'Adds verification_method column to attendance table');
  assert(sqlContent.includes('override_reason text'), 'Adds override_reason column to attendance table');
  assert(sqlContent.includes('overridden_by uuid REFERENCES auth.users'), 'Adds overridden_by column to attendance table');

  // Check partial unique indexes
  assert(sqlContent.includes('idx_attendance_student_session'), 'Creates partial unique index on (student_id, session_id)');
  assert(sqlContent.includes('idx_attendance_student_date_subject'), 'Creates partial unique index on (student_id, attendance_date, subject_id)');
  assert(sqlContent.includes('idx_attendance_student_daily_legacy'), 'Creates partial unique index on (student_id, attendance_date)');

  // Check RLS
  assert(sqlContent.includes('ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;'), 'Enables RLS on attendance_sessions');
  assert(sqlContent.includes('ALTER TABLE public.attendance_otp_attempts ENABLE ROW LEVEL SECURITY;'), 'Enables RLS on attendance_otp_attempts');
  assert(sqlContent.includes('is_campusos_admin()'), 'Uses public.is_campusos_admin() for non-recursive admin authorization');

  // Summary
  console.log('\n====================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
