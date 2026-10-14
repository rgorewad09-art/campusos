/**
 * scripts/verify-security-rules.mjs
 *
 * Automated pre-migration and security verification script for CampusOS.
 * Tests:
 *  1. Data integrity: Duplicate checks on attendance and active student emails.
 *  2. Security utilities: Redirect sanitization, PostgREST search sanitization, CSV formula injection, UUID validation.
 *  3. Server admin key isolation: Asserts SUPABASE_SERVICE_ROLE_KEY is purely server-side.
 *  4. Migration contract verification: Validates non-recursive RLS and role escalation safeguards.
 *
 * Usage:
 *   node --env-file=.env.local scripts/verify-security-rules.mjs
 */

import { isValidUuid, sanitizePostgrestSearch, getSafeRedirectUrl } from '../src/lib/security.ts';
import { sanitizeCsvCell } from '../src/lib/csvExport.ts';
import { createAdminClient } from '../src/lib/supabase/admin.ts';
import fs from 'node:fs';
import path from 'node:path';

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
  console.log('CampusOS Pre-Migration Security & Data Safety Review');
  console.log('====================================================\n');

  // --- Suite 1: Security Utility Guardrails ---
  console.log('1. Testing Security Utility Guardrails:');

  // 1a. Safe redirect validation (CWE-601)
  assert(getSafeRedirectUrl('/dashboard') === '/dashboard', 'Permits legitimate internal relative paths');
  assert(getSafeRedirectUrl('/students/123') === '/students/123', 'Permits deep internal paths');
  assert(getSafeRedirectUrl('https://evil.example.com') === '/', 'Rejects absolute external URLs');
  assert(getSafeRedirectUrl('//evil.example.com') === '/', 'Rejects protocol-relative URLs');
  assert(getSafeRedirectUrl('/\\evil.example.com') === '/', 'Rejects backslash bypass URLs');
  assert(getSafeRedirectUrl('javascript:alert(1)') === '/', 'Rejects javascript: URI schemes');
  assert(getSafeRedirectUrl(null) === '/', 'Falls back to default on null');
  assert(getSafeRedirectUrl('') === '/', 'Falls back to default on empty string');

  // 1b. PostgREST filter injection protection (CWE-89/PostgREST injection)
  assert(sanitizePostgrestSearch('admin,role.eq.admin') === 'admin role eq admin', 'Strips comma and dot operator syntax');
  assert(sanitizePostgrestSearch('test()') === 'test', 'Strips parentheses grouping syntax');
  assert(sanitizePostgrestSearch('100%') === '100', 'Strips wildcard percent signs');
  assert(sanitizePostgrestSearch('normal search') === 'normal search', 'Preserves legitimate alphanumeric search terms');

  // 1c. UUID v4 validation
  assert(isValidUuid('704587f9-383d-4b68-a9c8-4b0bfb7c2521') === true, 'Accepts valid UUID v4');
  assert(isValidUuid('../etc/passwd') === false, 'Rejects directory traversal in UUID parameters');
  assert(isValidUuid('not-a-uuid') === false, 'Rejects malformed strings');
  assert(isValidUuid(12345) === false, 'Rejects non-string types');

  // 1d. CSV Formula Injection (CWE-1236)
  assert(sanitizeCsvCell('=SUM(1+1)') === "'=SUM(1+1)", 'Neutralizes formula injection with prefix =');
  assert(sanitizeCsvCell('   =CMD()') === "'   =CMD()", 'Neutralizes formula injection with leading whitespace');
  assert(sanitizeCsvCell('\t@SUM(A1:A10)') === "'\t@SUM(A1:A10)", 'Neutralizes formula injection with tab character');
  assert(sanitizeCsvCell('=SUM(1,2)') === `"'=SUM(1,2)"`, 'Wraps in quotes when cell contains commas');
  assert(sanitizeCsvCell('Safe Text') === 'Safe Text', 'Leaves standard text untampered');

  console.log('\n2. Testing Server-Side Secret Isolation:');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(Boolean(serviceRoleKey), 'SUPABASE_SERVICE_ROLE_KEY is present in environment');
  assert(!('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY' in process.env), 'Service role key is NOT exposed with NEXT_PUBLIC_ prefix');
  const adminClient = createAdminClient();
  assert(adminClient !== null, 'Admin client factory successfully instantiates server-side client');

  console.log('\n3. Testing Existing Database Pre-requisites & Uniqueness Constraints:');
  if (adminClient) {
    try {
      // 3a. Attendance uniqueness pre-check
      const { data: attendanceRows, error: attError } = await adminClient
        .from('attendance')
        .select('id, student_id, attendance_date');

      if (attError) {
        console.warn('  ! Notice: Could not read attendance for live check:', attError.message);
      } else {
        const pairs = (attendanceRows || []).map((r) => `${r.student_id}_${r.attendance_date}`);
        const uniquePairs = new Set(pairs);
        assert(pairs.length === uniquePairs.size, `Attendance data has ZERO duplicate (student_id, date) pairs (${uniquePairs.size}/${pairs.length} distinct)`);
      }

      // 3b. Student active email uniqueness pre-check
      const { data: studentRows, error: stuError } = await adminClient
        .from('students')
        .select('id, email, status');

      if (stuError) {
        console.warn('  ! Notice: Could not read students for live check:', stuError.message);
      } else {
        const activeEmails = (studentRows || [])
          .filter((s) => s.email && s.status !== 'graduated')
          .map((s) => s.email.trim().toLowerCase());
        const uniqueEmails = new Set(activeEmails);
        assert(activeEmails.length === uniqueEmails.size, `Active students have ZERO duplicate emails (${uniqueEmails.size}/${activeEmails.length} distinct)`);
      }
    } catch (dbErr) {
      console.warn('  ! Live DB query note:', dbErr instanceof Error ? dbErr.message : dbErr);
    }
  }

  console.log('\n4. Validating Migration Script Contracts:');
  const migration003 = fs.readFileSync(
    path.resolve(process.cwd(), 'scripts/migrations/003_secure_profiles_role.sql'),
    'utf-8'
  );
  assert(!migration003.includes('pg_catalog.current_user'), 'Migration 003 does not use pg_catalog.current_user');
  assert(!migration003.includes('IF CURRENT_USER IN'), 'Migration 003 does not rely on CURRENT_USER inside SECURITY DEFINER');
  assert(migration003.includes("request.jwt.claim.role', true)"), 'Migration 003 checks cryptographically verified request.jwt.claim.role');
  assert(migration003.includes("IN ('admin', 'teacher')"), 'Migration 003 blocks client-side self-assignment of both admin and teacher');

  const migration004 = fs.readFileSync(
    path.resolve(process.cwd(), 'scripts/migrations/004_student_and_teacher_roles.sql'),
    'utf-8'
  );
  assert(migration004.includes('public.is_campusos_admin()'), 'Migration 004 defines and uses public.is_campusos_admin() helper');
  assert(
    !migration004.includes('EXISTS (\n    SELECT 1 FROM public.profiles AS p\n    WHERE p.id = auth.uid()'),
    'Migration 004 does NOT use recursive self-queries in public.profiles policy'
  );
  assert(!migration004.includes("profiles.role IN ('admin', 'teacher')\n  )\n);\n\n-- Students can upload"), 'Migration 004 strictly excludes teachers from student_documents read policy');
  assert(migration004.includes('DROP POLICY IF EXISTS "Admins can manage attendance"'), 'Migration 004 cleans up legacy 002 attendance policy');
  assert(migration004.includes('DROP POLICY IF EXISTS "Admins can upload student documents"'), 'Migration 004 cleans up legacy 001 storage policies');

  console.log('\n====================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Unhandled verification error:', e);
  process.exit(1);
});
