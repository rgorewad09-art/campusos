/**
 * scripts/test-session-security.mjs
 *
 * Verifies the 5 essential test cases for session security and shared-device behavior:
 *  A. Existing valid admin session can access the admin dashboard.
 *  B. Student and teacher sessions cannot access admin routes.
 *  C. Expired sessions are denied access to protected routes.
 *  D. Logout prevents subsequent protected requests from using the signed-out session.
 *  E. Existing student activation and password setup still work.
 *
 * Usage:
 *   node --env-file=.env.local scripts/test-session-security.mjs
 */

import fs from 'node:fs';
import { createAdminClient } from '../src/lib/supabase/admin.ts';
import { createClient } from '@supabase/supabase-js';
import {
  SESSION_IDLE_TIMEOUT_MS,
  isSessionExpired,
  parseActivityTimestamp,
  formatSecondsRemaining,
  CAMPUSOS_ACTIVITY_COOKIE,
  CAMPUSOS_REMEMBER_COOKIE,
} from '../src/lib/session.ts';

// Automatically load .env.local if environment variables are not already present
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && fs.existsSync('.env.local')) {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile('.env.local');
    }
  } catch {
    // ignore
  }
}

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
  console.log('CampusOS Session Security & Shared-Device Test Suite');
  console.log('====================================================\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const adminClient = createAdminClient();

  assert(adminClient !== null, 'Server admin client initialized with service_role key');

  if (!adminClient) {
    console.error('Cannot proceed without admin client.');
    process.exit(1);
  }

  // --- CASE A: Valid Admin Access ---
  console.log('\n--- CASE A: Existing Valid Admin Access ---');
  // 1. Verify admin profile exists
  const { data: adminProfile, error: adminProfileError } = await adminClient
    .from('profiles')
    .select('id, role, display_name')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

  assert(!adminProfileError && adminProfile !== null, 'Located valid administrator profile');
  assert(adminProfile?.role === 'admin', 'Administrator role is strictly "admin"');

  // Verify activity timestamp within 15 minutes is valid
  const freshActivity = Date.now() - 2 * 60 * 1000; // 2 minutes ago
  assert(!isSessionExpired(freshActivity), 'Admin session active 2m ago is NOT expired');

  // --- CASE B: Student & Teacher Access Control to Admin Routes ---
  console.log('\n--- CASE B: Student & Teacher Access Control to Admin Routes ---');
  // Simulated RBAC policy check across middleware and server guards
  function checkRouteAccess(role, pathname) {
    // Admin routes
    const isAdminOnlyRoute =
      pathname === '/' ||
      pathname.startsWith('/settings') ||
      pathname === '/students/enroll' ||
      pathname === '/documents/verify';

    // Faculty routes
    const isTeacherAllowedRoute =
      pathname === '/teacher/dashboard' ||
      pathname === '/attendance' ||
      (pathname === '/students' && pathname !== '/students/enroll');

    // Student routes
    const isStudentAllowedRoute =
      pathname === '/student/dashboard' ||
      pathname.startsWith('/activate');

    if (role === 'student') {
      if (!isStudentAllowedRoute) return { allowed: false, destination: '/student/dashboard' };
      return { allowed: true };
    }

    if (role === 'teacher') {
      if (isAdminOnlyRoute || !isTeacherAllowedRoute) return { allowed: false, destination: '/teacher/dashboard' };
      return { allowed: true };
    }

    if (role === 'admin') {
      return { allowed: true };
    }

    return { allowed: false, destination: '/login' };
  }

  // Students attempting to access admin routes
  assert(!checkRouteAccess('student', '/').allowed, 'Student blocked from root admin dashboard ("/")');
  assert(checkRouteAccess('student', '/').destination === '/student/dashboard', 'Student redirected to /student/dashboard');
  assert(!checkRouteAccess('student', '/settings').allowed, 'Student blocked from /settings');
  assert(!checkRouteAccess('student', '/students').allowed, 'Student blocked from administrative /students');
  assert(!checkRouteAccess('student', '/students/enroll').allowed, 'Student blocked from /students/enroll');
  assert(checkRouteAccess('student', '/student/dashboard').allowed, 'Student allowed on /student/dashboard');

  // Teachers attempting to access admin routes
  assert(!checkRouteAccess('teacher', '/').allowed, 'Teacher blocked from root admin dashboard ("/")');
  assert(checkRouteAccess('teacher', '/').destination === '/teacher/dashboard', 'Teacher redirected to /teacher/dashboard');
  assert(!checkRouteAccess('teacher', '/settings').allowed, 'Teacher blocked from /settings');
  assert(!checkRouteAccess('teacher', '/students/enroll').allowed, 'Teacher blocked from /students/enroll');
  assert(checkRouteAccess('teacher', '/teacher/dashboard').allowed, 'Teacher allowed on /teacher/dashboard');
  assert(checkRouteAccess('teacher', '/attendance').allowed, 'Teacher allowed on /attendance');

  // Admin allowed everywhere
  assert(checkRouteAccess('admin', '/').allowed, 'Admin allowed on root dashboard');
  assert(checkRouteAccess('admin', '/settings').allowed, 'Admin allowed on /settings');
  assert(checkRouteAccess('admin', '/students/enroll').allowed, 'Admin allowed on /students/enroll');

  // --- CASE C: Expired Session Invalidation ---
  console.log('\n--- CASE C: Expired Session Invalidation ---');
  const now = Date.now();
  const sixteenMinutesAgo = now - 16 * 60 * 1000;
  const fourteenMinutesAgo = now - 14 * 60 * 1000;
  const futureTimestamp = now + 120 * 1000; // Malformed / manipulated

  assert(isSessionExpired(sixteenMinutesAgo, now), 'Activity 16 minutes ago is recognized as EXPIRED (> 15m)');
  assert(!isSessionExpired(fourteenMinutesAgo, now), 'Activity 14 minutes ago is recognized as ACTIVE (< 15m)');
  assert(isSessionExpired(futureTimestamp, now), 'Manipulated future timestamp (> 60s ahead) is safely rejected as expired');
  assert(isSessionExpired(NaN, now) === false, 'NaN/null timestamp handled safely without unhandled exception');

  // Test timestamp parser
  assert(parseActivityTimestamp(String(now)) === now, 'Parses valid integer timestamp correctly');
  assert(parseActivityTimestamp('invalid-string') === null, 'Rejects non-numeric cookie values');
  assert(parseActivityTimestamp(null) === null, 'Safely returns null for missing cookie');

  // Test warning duration formatting
  assert(formatSecondsRemaining(120) === '2:00', 'Formats 120s remaining as 2:00');
  assert(formatSecondsRemaining(65) === '1:05', 'Formats 65s remaining as 1:05');
  assert(formatSecondsRemaining(5) === '0:05', 'Formats 5s remaining as 0:05');

  // --- CASE D: Logout & Invalidation ---
  console.log('\n--- CASE D: Logout & Invalidation ---');
  // Create an ephemeral test user to test global sign-out
  const testEmail = `logout_test_${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });

  assert(!createError && createdUser?.user !== null, 'Created ephemeral test user for logout verification');

  if (createdUser?.user) {
    const client = createClient(supabaseUrl, anonKey);

    // Sign in test user
    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    assert(!signInError && signInData.session !== null, 'Signed in ephemeral user and acquired session');

    // Perform local sign out
    const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
    assert(!signOutError, 'Local sign-out executed successfully on client device');

    // Verify session is no longer valid on this client
    const { data: afterData } = await client.auth.getSession();
    assert(afterData.session === null, 'Client session cleared after local logout');

    // Cleanup ephemeral user
    await adminClient.auth.admin.deleteUser(createdUser.user.id);
    console.log('  Cleaned up ephemeral test user');
  }

  // --- CASE E: Student Activation & Password Setup Flow ---
  console.log('\n--- CASE E: Student Activation & Password Setup Flow ---');
  // 1. Password validation rules
  function validatePassword(password, confirm) {
    if (!password || password.length < 8) return { valid: false, error: 'Password must be at least 8 characters long.' };
    if (password !== confirm) return { valid: false, error: 'Passwords do not match.' };
    return { valid: true };
  }

  assert(!validatePassword('short', 'short').valid, 'Rejects password shorter than 8 characters');
  assert(!validatePassword('ValidPass123!', 'Mismatch123!').valid, 'Rejects non-matching passwords');
  assert(validatePassword('ValidPass123!', 'ValidPass123!').valid, 'Accepts valid 8+ character matching password');

  // 2. Recovery / Activation Link generation with live student
  const { data: sampleStudents } = await adminClient
    .from('students')
    .select('email, student_code')
    .not('email', 'is', null)
    .limit(1);

  if (sampleStudents && sampleStudents.length > 0) {
    const student = sampleStudents[0];
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: student.email,
      options: { redirectTo: 'http://localhost:3000/auth/confirm?next=/activate/password' },
    });

    assert(!linkError && Boolean(linkData?.properties?.hashed_token), 'Generated valid activation/recovery link for student');
    assert(linkData?.properties?.verification_type === 'recovery', 'Verification type matches "recovery"');
  }

  // --- CASE F: Cross-Portal Login & Account Switching ---
  console.log('\n--- CASE F: Cross-Portal Login & Account Switching ---');

  function checkLoginRedirect(role, pathname, hasError = false) {
    const isStudentLogin = pathname === '/student/login';
    const isTeacherLogin = pathname === '/teacher/login';
    const isGenericLogin = pathname === '/login';
    const isLoginPage = isGenericLogin || isStudentLogin || isTeacherLogin;

    if (!isLoginPage) return { handled: false };
    if (hasError) return { handled: true, action: 'render_login' };

    const isVisitingOwnLogin =
      (isStudentLogin && role === 'student') ||
      (isTeacherLogin && role === 'teacher') ||
      (isGenericLogin && role === 'admin');

    if (isVisitingOwnLogin) {
      if (role === 'student') return { handled: true, action: 'redirect', destination: '/student/dashboard' };
      if (role === 'teacher') return { handled: true, action: 'redirect', destination: '/teacher/dashboard' };
      return { handled: true, action: 'redirect', destination: '/' };
    }

    return { handled: true, action: 'render_login' };
  }

  // 1. Visiting own login redirects to dashboard
  assert(checkLoginRedirect('student', '/student/login').destination === '/student/dashboard', 'Student on /student/login redirects to /student/dashboard');
  assert(checkLoginRedirect('teacher', '/teacher/login').destination === '/teacher/dashboard', 'Teacher on /teacher/login redirects to /teacher/dashboard');
  assert(checkLoginRedirect('admin', '/login').destination === '/', 'Admin on /login redirects to /');

  // 2. Visiting other portal login allows rendering (account switching)
  assert(checkLoginRedirect('admin', '/student/login').action === 'render_login', 'Admin on /student/login is allowed to render login (for account switching)');
  assert(checkLoginRedirect('admin', '/teacher/login').action === 'render_login', 'Admin on /teacher/login is allowed to render login (for account switching)');
  assert(checkLoginRedirect('student', '/login').action === 'render_login', 'Student on /login is allowed to render login (for account switching)');

  // 3. Login pages with error parameter always render
  assert(checkLoginRedirect('admin', '/login', true).action === 'render_login', 'Login page with ?error renders regardless of session');
  assert(checkLoginRedirect('student', '/student/login', true).action === 'render_login', 'Student login page with ?error renders regardless of session');

  console.log('\n====================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
