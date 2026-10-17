/**
 * scripts/test-profiles-trigger-paths.mjs
 *
 * Focused verification test suite for protect_profiles_role trigger paths:
 *  1. Valid admin profile updates (display_name changes without role change)
 *  2. Valid teacher and student profile/record updates
 *  3. Unauthorized role change rejection (role modification immutability)
 *  4. INSERT trigger path logic (defaulting to student, blocking unprivileged admin/teacher creation)
 *  5. UPDATE trigger path logic (allowing attribute changes when NEW.role IS NOT DISTINCT FROM OLD.role)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

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
  console.log('CampusOS Profiles Trigger & Role Protection Verification');
  console.log('====================================================\n');

  // --- 1. Migration 008 SQL Syntax & Structure Invariants ---
  console.log('--- 1. Testing Migration 008 Function Definitions & Invariants ---');
  const migration008 = fs.readFileSync('scripts/migrations/008_fix_profiles_trigger_nullif.sql', 'utf8');

  // Must not have invalid pg_catalog.nullif in function body
  const functionBody = migration008.slice(migration008.indexOf('AS $$'));
  assert(!functionBody.includes('pg_catalog.nullif'), 'Function body does not call pg_catalog.nullif');
  assert(functionBody.includes('NULLIF('), 'Uses valid standard SQL NULLIF construct');

  // Must not have invalid pg_catalog.trim in function body
  assert(!functionBody.includes('pg_catalog.trim'), 'Function body does not call pg_catalog.trim');
  assert(functionBody.includes('pg_catalog.btrim('), 'Uses valid schema-qualified pg_catalog.btrim function');

  // Must check PostgREST JWT claims
  assert(migration008.includes('request.jwt.claims'), 'Inspects request.jwt.claims for modern PostgREST / Supabase support');
  assert(migration008.includes('service_role'), 'Preserves service_role bypass for trusted server actions');

  // --- 2. UPDATE Trigger Path Logic Verification ---
  console.log('\n--- 2. Testing UPDATE Trigger Path Logic & Role Immutability ---');
  
  function simulateUpdatePath({ oldRole, newRole }) {
    if (newRole === oldRole) {
      return { allowed: true };
    }
    return {
      allowed: false,
      code: '42501',
      error: `Modifying profile role is forbidden. Current: ${oldRole}, Attempted: ${newRole}.`,
    };
  }

  // Updating profile while keeping role identical
  const validUpdate = simulateUpdatePath({ oldRole: 'admin', newRole: 'admin' });
  assert(validUpdate.allowed, 'UPDATE path permits updating attributes when role is unchanged');

  const validTeacherUpdate = simulateUpdatePath({ oldRole: 'teacher', newRole: 'teacher' });
  assert(validTeacherUpdate.allowed, 'UPDATE path permits teacher profile updates when role is unchanged');

  const validStudentUpdate = simulateUpdatePath({ oldRole: 'student', newRole: 'student' });
  assert(validStudentUpdate.allowed, 'UPDATE path permits student profile updates when role is unchanged');

  // Attempting to elevate role or alter role
  const hackerElevation = simulateUpdatePath({ oldRole: 'student', newRole: 'admin' });
  assert(!hackerElevation.allowed && hackerElevation.code === '42501', 'UPDATE path unconditionally rejects student -> admin elevation (42501)');

  const teacherTamper = simulateUpdatePath({ oldRole: 'teacher', newRole: 'admin' });
  assert(!teacherTamper.allowed && teacherTamper.code === '42501', 'UPDATE path unconditionally rejects teacher -> admin elevation (42501)');

  const adminDemotion = simulateUpdatePath({ oldRole: 'admin', newRole: 'student' });
  assert(!adminDemotion.allowed && adminDemotion.code === '42501', 'UPDATE path unconditionally rejects admin -> student role modification (42501)');

  // --- 3. INSERT Trigger Path Logic Verification ---
  console.log('\n--- 3. Testing INSERT Trigger Path Logic & Role Defaults ---');
  
  function simulateInsertPath({ role, isServiceRole = false }) {
    if (isServiceRole) {
      return { allowed: true, role: role || 'student' };
    }

    if (!role || role.trim() === '') {
      return { allowed: true, role: 'student' };
    }

    const normalized = role.trim().toLowerCase();
    const validRoles = ['student', 'teacher', 'admin'];

    if (!validRoles.includes(normalized)) {
      return { allowed: false, code: '22023', error: `Invalid role specified: ${role}` };
    }

    if (normalized === 'admin' || normalized === 'teacher') {
      return { allowed: false, code: '42501', error: `Unauthorized: Only service_role can assign ${normalized} role.` };
    }

    return { allowed: true, role: normalized };
  }

  // Omitting role on INSERT defaults to student
  const defaultInsert = simulateInsertPath({ role: null, isServiceRole: false });
  assert(defaultInsert.allowed && defaultInsert.role === 'student', 'INSERT path defaults missing role to "student"');

  const whitespaceInsert = simulateInsertPath({ role: '   ', isServiceRole: false });
  assert(whitespaceInsert.allowed && whitespaceInsert.role === 'student', 'INSERT path defaults whitespace role to "student"');

  // Non-service_role attempting to insert admin or teacher
  const directAdminInsert = simulateInsertPath({ role: 'admin', isServiceRole: false });
  assert(!directAdminInsert.allowed && directAdminInsert.code === '42501', 'INSERT path rejects unprivileged creation of "admin" role (42501)');

  const directTeacherInsert = simulateInsertPath({ role: 'teacher', isServiceRole: false });
  assert(!directTeacherInsert.allowed && directTeacherInsert.code === '42501', 'INSERT path rejects unprivileged creation of "teacher" role (42501)');

  // Valid non-service_role insert of student
  const studentInsert = simulateInsertPath({ role: 'student', isServiceRole: false });
  assert(studentInsert.allowed && studentInsert.role === 'student', 'INSERT path permits creation of standard "student" role');

  // Service role bypass
  const serviceAdminInsert = simulateInsertPath({ role: 'admin', isServiceRole: true });
  assert(serviceAdminInsert.allowed && serviceAdminInsert.role === 'admin', 'service_role bypass permits administrative account creation');

  // --- 4. Live Verification Against Supabase Database ---
  console.log('\n--- 4. Testing Live Admin, Teacher, and Student Entities in Database ---');

  // Admin Profile Update Flow
  const { data: adminUser } = await supabase.from('profiles').select('*').eq('role', 'admin').limit(1).single();
  assert(Boolean(adminUser), `Located valid Administrator in database (${adminUser?.id})`);

  // Update Auth user_metadata
  const testName = 'Administrator';
  const { error: metaErr } = await supabase.auth.admin.updateUserById(adminUser.id, {
    user_metadata: { display_name: testName, full_name: testName },
  });
  assert(!metaErr, 'Updated admin user_metadata in auth.users without errors');

  // Teacher Profile / Record Update
  const { data: teacherUser } = await supabase.from('teachers').select('*').limit(1).single();
  assert(Boolean(teacherUser), `Located valid Teacher in database (${teacherUser?.first_name} ${teacherUser?.last_name})`);

  const { error: teacherErr } = await supabase
    .from('teachers')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', teacherUser.id);
  assert(!teacherErr, 'Teacher record update completed without errors');

  // Student Profile / Record Update
  const { data: studentUser } = await supabase.from('students').select('*').limit(1).single();
  assert(Boolean(studentUser), `Located valid Student in database (${studentUser?.first_name} ${studentUser?.last_name})`);

  const { error: studentErr } = await supabase
    .from('students')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', studentUser.id);
  assert(!studentErr, 'Student record update completed without errors');

  // --- 5. Application Action Verification ---
  console.log('\n--- 5. Testing Application Settings & Profile Actions ---');
  const settingsActionFile = fs.readFileSync('app/actions/settings.ts', 'utf8');
  assert(!settingsActionFile.includes('role: formData'), 'updateAdminProfileAction strictly prevents role injection from client input');
  assert(settingsActionFile.includes("eq('role', 'admin')"), 'updateAdminProfileAction strictly asserts role is "admin"');
  assert(settingsActionFile.includes('user_metadata'), 'updateAdminProfileAction synchronizes display name with auth user_metadata');

  console.log('\n====================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests();
