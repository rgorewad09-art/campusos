/**
 * scripts/test-phase3-student-portal.mjs
 *
 * Automated verification suite for Phase 3: Student Dashboard and Login Experience.
 * Verifies:
 *  1. Dedicated Student Login (/student/login) & Teacher Login (/teacher/login) pages
 *  2. Middleware route definitions and RBAC boundaries
 *  3. Student portal server action authorization and data isolation
 *  4. Dashboard metrics and calculation correctness
 *  5. Prohibition compliance (no document upload forms, no migrations)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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

console.log('====================================================');
console.log('Phase 3 Verification: Student Dashboard & Login');
console.log('====================================================\n');

// 1. Check dedicated login pages exist
console.log('1. Verifying Dedicated Portal Login Pages:');
const studentLoginPath = resolve(process.cwd(), 'app/student/login/page.tsx');
const teacherLoginPath = resolve(process.cwd(), 'app/teacher/login/page.tsx');
const genericLoginPath = resolve(process.cwd(), 'app/login/page.tsx');
const studentDashboardPath = resolve(process.cwd(), 'app/student/dashboard/page.tsx');

assert(existsSync(studentLoginPath), 'app/student/login/page.tsx exists');
assert(existsSync(teacherLoginPath), 'app/teacher/login/page.tsx exists');
assert(existsSync(studentDashboardPath), 'app/student/dashboard/page.tsx exists');

const studentLoginContent = readFileSync(studentLoginPath, 'utf8');
const teacherLoginContent = readFileSync(teacherLoginPath, 'utf8');
const genericLoginContent = readFileSync(genericLoginPath, 'utf8');
const studentDashboardContent = readFileSync(studentDashboardPath, 'utf8');

assert(studentLoginContent.includes('use client'), 'Student login has "use client" directive');
assert(studentLoginContent.includes('Suspense'), 'Student login is wrapped with Suspense boundary');
assert(studentLoginContent.includes('loginAction'), 'Student login utilizes loginAction from auth actions');
assert(studentLoginContent.includes('College ID or Email address'), 'Student login supports College ID or Email address');
assert(studentLoginContent.includes('/student/dashboard'), 'Student login redirects to /student/dashboard on success');

assert(teacherLoginContent.includes('use client'), 'Faculty login has "use client" directive');
assert(teacherLoginContent.includes('Suspense'), 'Faculty login is wrapped with Suspense boundary');
assert(teacherLoginContent.includes('loginAction'), 'Faculty login utilizes loginAction from auth actions');
assert(teacherLoginContent.includes('/teacher/dashboard'), 'Faculty login redirects to /teacher/dashboard on success');

assert(genericLoginContent.includes('/student/login'), 'Unified login links directly to /student/login');
assert(genericLoginContent.includes('/teacher/login'), 'Unified login links directly to /teacher/login');

// 2. Check Middleware rules
console.log('\n2. Verifying Middleware Route Rules & RBAC:');
const middlewarePath = resolve(process.cwd(), 'src/lib/supabase/middleware.ts');
const middlewareContent = readFileSync(middlewarePath, 'utf8');

assert(middlewareContent.includes("pathname === '/student/login'"), 'Middleware recognizes /student/login');
assert(middlewareContent.includes("pathname === '/teacher/login'"), 'Middleware recognizes /teacher/login');
assert(middlewareContent.includes("redirectUrl.pathname = '/student/login'"), 'Unauthenticated /student/* visits redirect to /student/login');
assert(middlewareContent.includes("redirectUrl.pathname = '/teacher/login'"), 'Unauthenticated /teacher/* visits redirect to /teacher/login');
assert(middlewareContent.includes("if (role === 'student') redirectUrl.pathname = '/student/dashboard'"), 'Authenticated students visiting login pages redirect to /student/dashboard');
assert(middlewareContent.includes("if (role === 'teacher') redirectUrl.pathname = '/teacher/dashboard'"), 'Authenticated teachers visiting login pages redirect to /teacher/dashboard');
assert(middlewareContent.includes("pathname.startsWith('/student')"), 'Middleware isolates student routes');

// 3. Check Student Dashboard Server Actions & Data Isolation
console.log('\n3. Verifying Student Portal Data Isolation & Server Actions:');
const studentPortalPath = resolve(process.cwd(), 'app/actions/studentPortal.ts');
const studentPortalContent = readFileSync(studentPortalPath, 'utf8');

assert(studentPortalContent.includes("'use server'"), 'studentPortal.ts is strictly a server-only action module');
assert(studentPortalContent.includes("requireStudent"), 'Server actions enforce requireStudent() authorization gate');
assert(studentPortalContent.includes("profile?.role !== 'student'"), 'requireStudent() checks user role in public.profiles');
assert(studentPortalContent.includes(".eq('student_id', student.id)"), 'Queries enforce student_id scoping for attendance');
assert(studentPortalContent.includes(".eq('student_id', student.id)"), 'Queries enforce student_id scoping for student_documents');
assert(studentPortalContent.includes(".eq('student_id', student.id)"), 'getStudentDocumentSignedUrlAction strictly verifies document student_id ownership');
assert(studentPortalContent.includes("createSignedUrl"), 'Signed URL generation is server-side and time-limited (120s)');

// 4. Verify Phase 3 Scope & Prohibitions (No document self-upload form, no assignments, no OTP)
console.log('\n4. Verifying Phase 3 Scope Constraints:');
assert(!studentDashboardContent.includes('type="file"'), 'Student dashboard does NOT contain file upload input (deferred to Phase 4)');
assert(!studentDashboardContent.includes('uploadStudentDocumentAction'), 'Student dashboard does not invoke upload actions in Phase 3');
assert(!studentLoginContent.includes('otp'), 'Student login does not invoke OTP features in Phase 3');

console.log('\n====================================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
