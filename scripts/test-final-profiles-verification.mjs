/**
 * scripts/test-final-profiles-verification.mjs
 *
 * Final, focused verification test suite for CampusOS:
 * 1. Verify protect_profiles_role() no longer produces PostgreSQL error 42883.
 * 2. Test admin profile display-name updates (persistence and reset).
 * 3. Confirm teacher and student profile/record updates work.
 * 4. Verify unauthorized role changes remain strictly blocked (42501).
 * 5. Confirm INSERT and UPDATE trigger behavior for elevated roles and defaults.
 *
 * Usage:
 *   node --env-file=.env.local scripts/test-final-profiles-verification.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !serviceKey || !anonKey) {
  console.error('Missing required Supabase environment variables');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceKey);
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

async function runVerification() {
  console.log('=================================================================');
  console.log('CampusOS Final Live Database Verification (Migration 008)');
  console.log('=================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. Verify protect_profiles_role() no longer produces PostgreSQL error 42883
  // ---------------------------------------------------------------------------
  console.log('--- 1. Testing protect_profiles_role() Trigger (No Error 42883) ---');
  const adminId = '9e789075-b61e-48bb-a8c9-32078582be52';

  const { data: initialAdmin, error: fetchErr } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', adminId)
    .single();

  assert(!fetchErr && initialAdmin !== null, 'Fetched existing administrator profile');

  // Trigger UPDATE on profiles table
  const timestamp = new Date().toISOString();
  const { data: testUpdate, error: updateErr } = await adminClient
    .from('profiles')
    .update({ updated_at: timestamp })
    .eq('id', adminId)
    .select()
    .single();

  assert(!updateErr, 'Direct profiles UPDATE executed without error');
  assert(
    !updateErr || updateErr.code !== '42883',
    'PostgreSQL error 42883 (pg_catalog.trim does not exist) is eliminated'
  );

  // ---------------------------------------------------------------------------
  // 2. Test Admin Profile Display-Name Updates
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Testing Admin Profile Display-Name Updates ---');
  const originalName = initialAdmin.display_name || 'Administrator';
  const newName = 'Administrator Verified';

  // Update display_name
  const { data: updatedAdmin, error: nameUpdateErr } = await adminClient
    .from('profiles')
    .update({ display_name: newName, updated_at: new Date().toISOString() })
    .eq('id', adminId)
    .select()
    .single();

  assert(!nameUpdateErr, 'Updated admin display_name in public.profiles successfully');
  assert(updatedAdmin?.display_name === newName, `Display name persisted as "${newName}"`);

  // Verify persistence on fresh read
  const { data: verifyAdmin } = await adminClient
    .from('profiles')
    .select('display_name')
    .eq('id', adminId)
    .single();

  assert(verifyAdmin?.display_name === newName, 'Verified persistence of updated display name');

  // Reset back to original name
  const { data: resetAdmin, error: resetErr } = await adminClient
    .from('profiles')
    .update({ display_name: originalName, updated_at: new Date().toISOString() })
    .eq('id', adminId)
    .select()
    .single();

  assert(!resetErr && resetAdmin?.display_name === originalName, 'Restored admin display_name cleanly');

  // Also verify Auth user metadata sync works
  const { error: metaErr } = await adminClient.auth.admin.updateUserById(adminId, {
    user_metadata: { display_name: originalName, full_name: originalName },
  });
  assert(!metaErr, 'Admin user_metadata synchronized in auth.users');

  // ---------------------------------------------------------------------------
  // 3. Confirm Teacher and Student Profile/Record Updates Work
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Testing Teacher and Student Profile Updates ---');

  // Teacher record update
  const { data: teacherRecord } = await adminClient
    .from('teachers')
    .select('id, user_id, first_name, last_name, department')
    .limit(1)
    .single();

  assert(Boolean(teacherRecord), `Located teacher record: ${teacherRecord?.first_name} ${teacherRecord?.last_name}`);

  const teacherTimestamp = new Date().toISOString();
  const { data: updatedTeacher, error: teacherErr } = await adminClient
    .from('teachers')
    .update({ updated_at: teacherTimestamp })
    .eq('id', teacherRecord.id)
    .select()
    .single();

  assert(!teacherErr && Boolean(updatedTeacher), 'Teacher table record update succeeded without errors');

  // Student record update
  const { data: studentRecord } = await adminClient
    .from('students')
    .select('id, user_id, first_name, last_name, status')
    .limit(1)
    .single();

  assert(Boolean(studentRecord), `Located student record: ${studentRecord?.first_name} ${studentRecord?.last_name}`);

  const studentTimestamp = new Date().toISOString();
  const { data: updatedStudent, error: studentErr } = await adminClient
    .from('students')
    .update({ updated_at: studentTimestamp })
    .eq('id', studentRecord.id)
    .select()
    .single();

  assert(!studentErr && Boolean(updatedStudent), 'Student table record update succeeded without errors');

  // ---------------------------------------------------------------------------
  // 4. Verify Unauthorized Role Changes Remain Blocked (Live JWT Context)
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Testing Live Security & Privilege Escalation Blocks ---');

  // Create an ephemeral authenticated student session to test live trigger behavior
  const tempEmail = `trigger_audit_${Date.now()}@campusos.test`;
  const tempPassword = 'AuditSecurePassword123!';

  const { data: tempAuthUser, error: createAuthErr } = await adminClient.auth.admin.createUser({
    email: tempEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { role: 'student', full_name: 'Test Student' },
  });

  assert(!createAuthErr && Boolean(tempAuthUser?.user), 'Created test student authentication user');
  const tempUserId = tempAuthUser.user.id;

  // Sign in as the student using the public anon client
  const authenticatedStudentClient = createClient(supabaseUrl, anonKey);
  const { data: sessionData, error: signInErr } = await authenticatedStudentClient.auth.signInWithPassword({
    email: tempEmail,
    password: tempPassword,
  });

  assert(!signInErr && Boolean(sessionData?.session), 'Authenticated client successfully established student session');

  // Insert profile row for test user
  await adminClient.from('profiles').upsert({
    id: tempUserId,
    display_name: 'Test Student',
    role: 'student',
  });

  // A. Student legitimately updates their own profile display_name
  const { data: studentOwnUpdate, error: studentOwnUpdateErr } = await authenticatedStudentClient
    .from('profiles')
    .update({ display_name: 'Test Student Valid Update' })
    .eq('id', tempUserId)
    .select();

  assert(!studentOwnUpdateErr, 'Authenticated student can update own display_name when role is untouched');
  assert(
    studentOwnUpdate?.[0]?.display_name === 'Test Student Valid Update',
    'Student display_name updated successfully'
  );

  // B. Student attempts privilege escalation: updating role from 'student' to 'admin'
  const { data: escalationAttempt, error: escalationErr } = await authenticatedStudentClient
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', tempUserId)
    .select();

  assert(
    Boolean(escalationErr) && escalationErr.code === '42501',
    'Student role modification to "admin" blocked with SQLSTATE 42501'
  );
  assert(
    escalationErr?.message?.includes('Modifying profile role is forbidden'),
    `Trigger error message correctly enforces immutability: "${escalationErr?.message}"`
  );

  // C. Student attempts privilege escalation: updating role from 'student' to 'teacher'
  const { data: teacherEscalation, error: teacherEscalationErr } = await authenticatedStudentClient
    .from('profiles')
    .update({ role: 'teacher' })
    .eq('id', tempUserId)
    .select();

  assert(
    Boolean(teacherEscalationErr) && teacherEscalationErr.code === '42501',
    'Student role modification to "teacher" blocked with SQLSTATE 42501'
  );

  // ---------------------------------------------------------------------------
  // 5. Confirm INSERT and UPDATE Trigger Behavior
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Testing INSERT Trigger Path Behavior ---');

  // Unprivileged client attempting to insert an elevated role ('admin')
  const maliciousProfileId = '00000000-0000-0000-0000-999999999999';
  const { data: maliciousInsert, error: maliciousInsertErr } = await authenticatedStudentClient
    .from('profiles')
    .insert({
      id: maliciousProfileId,
      display_name: 'Attacker Admin',
      role: 'admin',
    })
    .select();

  assert(
    Boolean(maliciousInsertErr) && maliciousInsertErr.code === '42501',
    'Unprivileged INSERT with role "admin" blocked with SQLSTATE 42501'
  );
  assert(
    maliciousInsertErr?.message?.includes('Only service_role can assign admin role'),
    `Trigger error message explains privilege requirement: "${maliciousInsertErr?.message}"`
  );

  // Clean up ephemeral test user
  await adminClient.from('profiles').delete().eq('id', tempUserId);
  await adminClient.auth.admin.deleteUser(tempUserId);
  console.log('  ✓ Cleaned up ephemeral audit resources');

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n=================================================================');
  console.log(`Live Verification Results: ${passed} passed, ${failed} failed`);
  console.log('=================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Unhandled error during verification:', err);
  process.exit(1);
});
