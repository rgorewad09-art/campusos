'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { redirect } from 'next/navigation';

export interface AuthActionState {
  error?: string;
  success?: boolean;
  role?: string;
  destination?: string;
}

/**
 * Authenticates a user (Administrator, Teacher, or Student) with email or College ID and password.
 * Resolves College ID to the student's email address securely on the server.
 * Resolves role from public.profiles and determines destination dashboard.
 */
export async function loginAction(
  _prevState: AuthActionState | null,
  formData: FormData
): Promise<AuthActionState> {
  const rawIdentifier = (
    formData.get('identifier') ||
    formData.get('email')
  )?.toString().trim();
  const password = formData.get('password')?.toString();

  if (!rawIdentifier || !password) {
    return { error: 'Please enter your email or College ID and password.' };
  }

  let emailToAuthenticate: string;

  if (rawIdentifier.includes('@')) {
    // 1. Direct Email login
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(rawIdentifier)) {
      return { error: 'Invalid credentials or identifier.' };
    }
    emailToAuthenticate = rawIdentifier.toLowerCase();
  } else {
    // 2. College ID login (e.g. STU-2026-0001, student_code)
    // Server-side resolution via adminClient to keep service_role key secure
    const adminClient = createAdminClient();
    if (!adminClient) {
      console.error('[CampusOS Auth] Admin client unavailable for College ID lookup');
      return { error: 'Invalid credentials or identifier.' };
    }

    // Strip any wildcards to prevent SQL LIKE wildcard exploitation
    const cleanCode = rawIdentifier.replace(/[%_]/g, '').trim();
    if (cleanCode.length === 0) {
      return { error: 'Invalid credentials or identifier.' };
    }

    const { data: student, error: studentError } = await adminClient
      .from('students')
      .select('email, status')
      .ilike('student_code', cleanCode)
      .maybeSingle();

    if (studentError || !student || !student.email || student.status === 'graduated') {
      return { error: 'Invalid credentials or identifier.' };
    }

    emailToAuthenticate = student.email.toLowerCase();
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailToAuthenticate,
    password,
  });

  if (error || !data.user) {
    return { error: 'Invalid credentials or identifier.' };
  }

  // Retrieve user role from public.profiles using server admin client to avoid RLS lookup failure
  const adminClient = createAdminClient();
  const dbClient = adminClient || supabase;

  let { data: profile, error: profileError } = await dbClient
    .from('profiles')
    .select('id, role')
    .eq('id', data.user.id)
    .maybeSingle();

  // Self-heal: If profile row is missing, check if this verified auth account is an enrolled student
  if ((!profile || !profile.role) && data.user.email && adminClient) {
    const { data: enrolledStudent } = await adminClient
      .from('students')
      .select('id, user_id, first_name, last_name, status')
      .ilike('email', data.user.email.trim())
      .neq('status', 'graduated')
      .maybeSingle();

    if (enrolledStudent) {
      if (!enrolledStudent.user_id) {
        await adminClient
          .from('students')
          .update({ user_id: data.user.id })
          .eq('id', enrolledStudent.id);
      }

      const displayName =
        [enrolledStudent.first_name, enrolledStudent.last_name]
          .filter(Boolean)
          .join(' ') || 'Student';

      await adminClient.from('profiles').upsert({
        id: data.user.id,
        display_name: displayName,
        role: 'student',
      });

      profile = { id: data.user.id, role: 'student' };
      profileError = null;
    }
  }

  const allowedRoles = ['admin', 'teacher', 'student'];
  const userRole = profile?.role;

  if (profileError || !userRole || !allowedRoles.includes(userRole)) {
    await supabase.auth.signOut();
    return {
      error: 'Access denied: Your account is not assigned an active role in CampusOS.',
    };
  }

  let destination = '/';
  if (userRole === 'student') {
    destination = '/student/dashboard';
  } else if (userRole === 'teacher') {
    destination = '/teacher/dashboard';
  }

  return { success: true, role: userRole, destination };
}

/**
 * Sets a new password for an activating student or user.
 */
export async function setupPasswordAction(
  _prevState: AuthActionState | null,
  formData: FormData
): Promise<AuthActionState> {
  const password = formData.get('password')?.toString();
  const confirmPassword = formData.get('confirmPassword')?.toString();

  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters long.' };
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match. Please re-enter.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: 'Activation session expired. Please open the activation link in your email again.',
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password,
  });

  if (updateError) {
    return { error: updateError.message || 'Failed to set password. Please try again.' };
  }

  // Determine user role and corresponding dashboard securely on the server
  const adminClient = createAdminClient();
  const dbClient = adminClient || supabase;

  let { data: profile } = await dbClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  // Self-heal: If profile row is missing, check if this verified auth account is an enrolled student
  if ((!profile || !profile.role) && user.email && adminClient) {
    const { data: enrolledStudent } = await adminClient
      .from('students')
      .select('id, user_id, first_name, last_name, status')
      .ilike('email', user.email.trim())
      .neq('status', 'graduated')
      .maybeSingle();

    if (enrolledStudent) {
      if (!enrolledStudent.user_id) {
        await adminClient
          .from('students')
          .update({ user_id: user.id })
          .eq('id', enrolledStudent.id);
      }

      const displayName =
        [enrolledStudent.first_name, enrolledStudent.last_name]
          .filter(Boolean)
          .join(' ') || 'Student';

      await adminClient.from('profiles').upsert({
        id: user.id,
        display_name: displayName,
        role: 'student',
      });

      profile = { role: 'student' };
    }
  }

  const role = profile?.role;
  const validRoles = ['admin', 'teacher', 'student'];

  if (!role || !validRoles.includes(role)) {
    return {
      error: 'Account activated, but no active role was found. Please contact your administrator.',
    };
  }

  const destination =
    role === 'student'
      ? '/student/dashboard'
      : role === 'teacher'
      ? '/teacher/dashboard'
      : '/';

  return { success: true, role, destination };
}

/**
 * Signs out the authenticated user, revokes session cookies,
 * and redirects to /login.
 */
export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
