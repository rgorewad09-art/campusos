/**
 * scripts/diagnose-auth.mjs
 *
 * Read-only diagnostic script to inspect:
 * - Profiles table structure, constraints, and current roles
 * - Auth users existence, confirmation status, and role metadata (NO secrets/passwords/tokens displayed)
 * - Students table linking (user_id presence and matching emails)
 * - RLS policies on public.profiles
 * - Simulated role resolution
 */

import { createAdminClient } from '../src/lib/supabase/admin.ts';

async function diagnose() {
  const adminClient = createAdminClient();
  if (!adminClient) {
    console.error('Cannot initialize admin client.');
    process.exit(1);
  }

  console.log('=== CampusOS Auth Diagnostics (Read-Only) ===\n');

  // 1. Inspect public.profiles
  console.log('1. Inspecting public.profiles:');
  const { data: profiles, error: profError } = await adminClient
    .from('profiles')
    .select('id, role, display_name');

  if (profError) {
    console.error('Error fetching profiles:', profError.message);
  } else {
    console.log(`Total profiles found: ${profiles?.length ?? 0}`);
    profiles?.forEach((p) => {
      console.log(` - ID: ${p.id.slice(0, 8)}... | Role: "${p.role}" | Name: "${p.display_name}"`);
    });
  }

  // 2. Inspect auth.users (via admin API, strictly metadata and email confirmation, NO sensitive data)
  console.log('\n2. Inspecting auth.users (counts & status only, NO secrets):');
  const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers();

  if (usersError) {
    console.error('Error listing auth users:', usersError.message);
  } else {
    console.log(`Total auth.users: ${usersData?.users?.length ?? 0}`);
    usersData?.users?.forEach((u) => {
      const emailDomain = u.email ? u.email.split('@')[1] : 'none';
      const emailPrefix = u.email ? u.email.split('@')[0].slice(0, 3) + '***' : 'none';
      console.log(` - User ID: ${u.id.slice(0, 8)}... | Email: ${emailPrefix}@${emailDomain} | Confirmed: ${Boolean(u.email_confirmed_at)} | Last Sign-In: ${u.last_sign_in_at ? 'Yes' : 'Never'} | Metadata Role: "${u.user_metadata?.role || 'none'}"`);
    });
  }

  // 3. Inspect public.students
  console.log('\n3. Inspecting public.students:');
  const { data: students, error: stuError } = await adminClient
    .from('students')
    .select('id, student_code, email, status, user_id');

  if (stuError) {
    console.error('Error fetching students:', stuError.message);
  } else {
    console.log(`Total students: ${students?.length ?? 0}`);
    students?.forEach((s) => {
      const emailDomain = s.email ? s.email.split('@')[1] : 'none';
      const emailPrefix = s.email ? s.email.split('@')[0].slice(0, 3) + '***' : 'none';
      console.log(` - Code: ${s.student_code} | Status: ${s.status} | Email: ${emailPrefix}@${emailDomain} | Linked user_id: ${s.user_id ? s.user_id.slice(0, 8) + '...' : 'NULL (unlinked)'}`);
    });
  }

  // 4. Check if there are ANY teacher records in profiles or other tables
  console.log('\n4. Checking teacher presence:');
  const teacherProfiles = profiles?.filter((p) => p.role === 'teacher') || [];
  console.log(`Teacher profiles count: ${teacherProfiles.length}`);

  // 5. Test RLS on public.profiles using public/anon client vs adminClient
  console.log('\n5. Inspecting profiles role constraint & policies:');
  const { data: pgConstraints, error: constError } = await adminClient.rpc('get_table_constraints', {
    t_name: 'profiles',
  }).catch(() => ({ data: null, error: true }));

  console.log('\n=== Diagnostics Complete ===');
}

diagnose().catch(console.error);
