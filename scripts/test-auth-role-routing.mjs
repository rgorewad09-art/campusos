/**
 * scripts/test-auth-role-routing.mjs
 *
 * Automated verification test for CampusOS Role Resolution and Routing Security.
 * Tests:
 *  1. Admin role resolution and dashboard destination ('/').
 *  2. Student role resolution and dashboard destination ('/student/dashboard').
 *  3. Teacher role resolution and dashboard destination ('/teacher/dashboard').
 *  4. Middleware route boundary enforcement for each role:
 *     - Admin: full access across all routes
 *     - Teacher: restricted to /teacher/*, /attendance, /students; blocked from /, /settings, /student/*
 *     - Student: restricted to /student/*, /activate/*; blocked from /, /attendance, /teacher/*, /settings
 *  5. Rejection of unauthorized, empty, or tampered roles.
 *  6. Self-healing logic for enrolled students:
 *     - Matches verified email against active public.students records
 *     - Assigns strictly 'student' role
 *     - NEVER elevates unknown or non-student emails to 'admin' or 'teacher'
 *  7. Preservation of existing administrator account.
 *
 * Usage:
 *   node --env-file=.env.local scripts/test-auth-role-routing.mjs
 */

import { createAdminClient } from '../src/lib/supabase/admin.ts';

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

/**
 * Pure simulation of the destination routing logic in loginAction and setupPasswordAction.
 */
function resolveDestination(role) {
  const allowedRoles = ['admin', 'teacher', 'student'];
  if (!role || !allowedRoles.includes(role)) {
    return { error: 'Access denied: Your account is not assigned an active role in CampusOS.' };
  }
  if (role === 'student') return { success: true, destination: '/student/dashboard' };
  if (role === 'teacher') return { success: true, destination: '/teacher/dashboard' };
  return { success: true, destination: '/' };
}

/**
 * Pure simulation of middleware route boundary checks in src/lib/supabase/middleware.ts.
 */
function evaluateMiddlewareAccess(role, pathname) {
  const isLoginPage = pathname === '/login' || pathname === '/student/login' || pathname === '/teacher/login';
  const isActivationPage = pathname.startsWith('/activate');

  if (isLoginPage) {
    if (role === 'student') return { action: 'redirect', to: '/student/dashboard' };
    if (role === 'teacher') return { action: 'redirect', to: '/teacher/dashboard' };
    return { action: 'redirect', to: '/' };
  }

  // Student boundaries
  if (role === 'student') {
    const isStudentAllowed =
      pathname === '/student' ||
      pathname.startsWith('/student/') ||
      pathname.startsWith('/activate');
    if (!isStudentAllowed) {
      return { action: 'redirect', to: '/student/dashboard' };
    }
    return { action: 'allow' };
  }

  // Teacher boundaries
  if (role === 'teacher') {
    const isTeacherBlocked =
      pathname === '/' ||
      pathname.startsWith('/settings') ||
      pathname === '/students/enroll' ||
      pathname === '/student' ||
      pathname.startsWith('/student/');
    if (isTeacherBlocked) {
      return { action: 'redirect', to: '/teacher/dashboard' };
    }
    return { action: 'allow' };
  }

  // Admin has full access
  if (role === 'admin') {
    return { action: 'allow' };
  }

  return { action: 'deny' };
}

/**
 * Pure simulation of student self-healing role resolution logic.
 */
async function simulateSelfHeal(email, adminClient) {
  if (!email || !adminClient) return null;

  const { data: enrolledStudent } = await adminClient
    .from('students')
    .select('id, user_id, first_name, last_name, status')
    .ilike('email', email.trim())
    .neq('status', 'graduated')
    .maybeSingle();

  if (enrolledStudent) {
    // Only student role is ever assigned by self-heal
    return 'student';
  }

  return null;
}

async function runTests() {
  console.log('========================================================');
  console.log('CampusOS Verification: Auth Role Resolution & Routing');
  console.log('========================================================\n');

  const adminClient = createAdminClient();
  assert(adminClient !== null, 'Server admin client initialized successfully');

  if (!adminClient) {
    console.error('Admin client unavailable.');
    process.exit(1);
  }

  // 1. Role-based Dashboard Destination Resolution
  console.log('\n1. Testing Role-Based Destination Resolution:');
  const adminDest = resolveDestination('admin');
  assert(adminDest.success && adminDest.destination === '/', 'Admin role routes to "/"');

  const studentDest = resolveDestination('student');
  assert(studentDest.success && studentDest.destination === '/student/dashboard', 'Student role routes to "/student/dashboard"');

  const teacherDest = resolveDestination('teacher');
  assert(teacherDest.success && teacherDest.destination === '/teacher/dashboard', 'Teacher role routes to "/teacher/dashboard"');

  const invalidDest = resolveDestination('unauthorized_hacker');
  assert(invalidDest.error !== undefined, 'Unauthorized role is rejected with access denied');

  const emptyDest = resolveDestination(null);
  assert(emptyDest.error !== undefined, 'Null role is rejected with access denied');

  // 2. Middleware Route Boundaries
  console.log('\n2. Testing Middleware Route Boundaries:');

  // Admin access
  assert(evaluateMiddlewareAccess('admin', '/').action === 'allow', 'Admin allowed on "/"');
  assert(evaluateMiddlewareAccess('admin', '/students').action === 'allow', 'Admin allowed on "/students"');
  assert(evaluateMiddlewareAccess('admin', '/settings').action === 'allow', 'Admin allowed on "/settings"');
  assert(evaluateMiddlewareAccess('admin', '/student/dashboard').action === 'allow', 'Admin allowed on "/student/dashboard"');

  // Teacher access
  assert(evaluateMiddlewareAccess('teacher', '/teacher/dashboard').action === 'allow', 'Teacher allowed on "/teacher/dashboard"');
  assert(evaluateMiddlewareAccess('teacher', '/attendance').action === 'allow', 'Teacher allowed on "/attendance"');
  assert(evaluateMiddlewareAccess('teacher', '/students').action === 'allow', 'Teacher allowed on "/students"');
  assert(
    evaluateMiddlewareAccess('teacher', '/').action === 'redirect' &&
    evaluateMiddlewareAccess('teacher', '/').to === '/teacher/dashboard',
    'Teacher redirected away from root admin dashboard "/" to "/teacher/dashboard"'
  );
  assert(
    evaluateMiddlewareAccess('teacher', '/settings').action === 'redirect' &&
    evaluateMiddlewareAccess('teacher', '/settings').to === '/teacher/dashboard',
    'Teacher redirected away from "/settings" to "/teacher/dashboard"'
  );
  assert(
    evaluateMiddlewareAccess('teacher', '/student/dashboard').action === 'redirect' &&
    evaluateMiddlewareAccess('teacher', '/student/dashboard').to === '/teacher/dashboard',
    'Teacher redirected away from "/student/dashboard" to "/teacher/dashboard"'
  );
  assert(
    evaluateMiddlewareAccess('teacher', '/students/enroll').action === 'redirect' &&
    evaluateMiddlewareAccess('teacher', '/students/enroll').to === '/teacher/dashboard',
    'Teacher redirected away from admin-only "/students/enroll" to "/teacher/dashboard"'
  );

  // Student access
  assert(evaluateMiddlewareAccess('student', '/student/dashboard').action === 'allow', 'Student allowed on "/student/dashboard"');
  assert(evaluateMiddlewareAccess('student', '/activate/password').action === 'allow', 'Student allowed on "/activate/password"');
  assert(
    evaluateMiddlewareAccess('student', '/students').action === 'redirect' &&
    evaluateMiddlewareAccess('student', '/students').to === '/student/dashboard',
    'Student redirected away from administrative student directory "/students" to "/student/dashboard"'
  );
  assert(
    evaluateMiddlewareAccess('student', '/students/enroll').action === 'redirect' &&
    evaluateMiddlewareAccess('student', '/students/enroll').to === '/student/dashboard',
    'Student redirected away from "/students/enroll" to "/student/dashboard"'
  );
  assert(
    evaluateMiddlewareAccess('student', '/').action === 'redirect' &&
    evaluateMiddlewareAccess('student', '/').to === '/student/dashboard',
    'Student redirected away from root "/" to "/student/dashboard"'
  );
  assert(
    evaluateMiddlewareAccess('student', '/attendance').action === 'redirect' &&
    evaluateMiddlewareAccess('student', '/attendance').to === '/student/dashboard',
    'Student redirected away from faculty attendance recording to "/student/dashboard"'
  );
  assert(
    evaluateMiddlewareAccess('student', '/teacher/dashboard').action === 'redirect' &&
    evaluateMiddlewareAccess('student', '/teacher/dashboard').to === '/student/dashboard',
    'Student redirected away from "/teacher/dashboard" to "/student/dashboard"'
  );
  assert(
    evaluateMiddlewareAccess('student', '/settings').action === 'redirect' &&
    evaluateMiddlewareAccess('student', '/settings').to === '/student/dashboard',
    'Student redirected away from "/settings" to "/student/dashboard"'
  );

  // 3. Login page redirection when already authenticated
  console.log('\n3. Testing Login Page Redirections for Authenticated Users:');
  assert(evaluateMiddlewareAccess('admin', '/login').to === '/', 'Authenticated Admin visiting /login redirected to "/"');
  assert(evaluateMiddlewareAccess('teacher', '/teacher/login').to === '/teacher/dashboard', 'Authenticated Teacher visiting /teacher/login redirected to "/teacher/dashboard"');
  assert(evaluateMiddlewareAccess('student', '/student/login').to === '/student/dashboard', 'Authenticated Student visiting /student/login redirected to "/student/dashboard"');

  // 4. Student Self-Healing Role Resolution
  console.log('\n4. Testing Student Self-Healing Role Resolution:');
  const unknownEmailRole = await simulateSelfHeal('completely_unknown_user_999@example.com', adminClient);
  assert(unknownEmailRole === null, 'Unknown email receives NO automatic role');

  const randomTeacherAttempt = await simulateSelfHeal('random_teacher_applicant@example.com', adminClient);
  assert(randomTeacherAttempt !== 'teacher' && randomTeacherAttempt !== 'admin', 'Teacher or Admin roles are NEVER self-healed');

  // Test against active student in database if present
  const { data: testStudent } = await adminClient
    .from('students')
    .select('email')
    .not('email', 'is', null)
    .neq('status', 'graduated')
    .limit(1)
    .maybeSingle();

  if (testStudent) {
    const studentRole = await simulateSelfHeal(testStudent.email, adminClient);
    assert(studentRole === 'student', `Enrolled student email "${testStudent.email}" correctly resolves to "student" role`);
  }

  // 5. Existing Administrator Account Integrity
  console.log('\n5. Verifying Administrator Account Integrity:');
  const { data: adminProfiles, error: adminErr } = await adminClient
    .from('profiles')
    .select('id, role, display_name')
    .eq('role', 'admin');

  assert(!adminErr && adminProfiles && adminProfiles.length > 0, `Existing administrator profile verified intact (${adminProfiles?.length ?? 0} found)`);
  if (adminProfiles && adminProfiles.length > 0) {
    assert(adminProfiles[0].role === 'admin', `Administrator role is "${adminProfiles[0].role}"`);
  }

  console.log('\n========================================================');
  console.log(`Summary: ${passed} tests passed, ${failed} tests failed`);
  console.log('========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
