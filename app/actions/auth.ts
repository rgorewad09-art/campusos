'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  CAMPUSOS_ACTIVITY_COOKIE,
  CAMPUSOS_REMEMBER_COOKIE,
  CAMPUSOS_ROLE_COOKIE,
} from '@/src/lib/session';

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

    // 2. College ID or Teacher ID login (e.g. STU-2026-0001 or TCH-2026-0001)
    let resolvedEmail: string | null = null;

    if (cleanCode.toUpperCase().startsWith('TCH')) {
      const { data: teacher } = await adminClient
        .from('teachers')
        .select('email, status')
        .ilike('teacher_code', cleanCode)
        .maybeSingle();

      if (teacher && teacher.email && teacher.status !== 'suspended') {
        resolvedEmail = teacher.email;
      }
    } else {
      const { data: student } = await adminClient
        .from('students')
        .select('email, status')
        .ilike('student_code', cleanCode)
        .maybeSingle();

      if (student && student.email && student.status !== 'graduated') {
        resolvedEmail = student.email;
      } else {
        // Fallback: Check teachers table if code didn't match student
        const { data: teacher } = await adminClient
          .from('teachers')
          .select('email, status')
          .ilike('teacher_code', cleanCode)
          .maybeSingle();

        if (teacher && teacher.email && teacher.status !== 'suspended') {
          resolvedEmail = teacher.email;
        }
      }
    }

    if (!resolvedEmail) {
      return { error: 'Invalid credentials or identifier.' };
    }

    emailToAuthenticate = resolvedEmail.toLowerCase();
  }

  const supabase = await createClient();

  // Safely clear any existing session in this browser before signing in with new credentials.
  // Using scope: 'local' ensures sessions on other devices are not revoked.
  try {
    const { data: existingSessionData } = await supabase.auth.getSession();
    if (existingSessionData?.session) {
      await supabase.auth.signOut({ scope: 'local' });
    }
  } catch {
    // Ignore error if no prior session existed
  }

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

  // Self-heal: If profile row is missing, check if verified auth account is student or teacher
  if ((!profile || !profile.role) && data.user.email && adminClient) {
    const cleanEmail = data.user.email.trim().toLowerCase();
    const { data: enrolledStudent } = await adminClient
      .from('students')
      .select('id, user_id, first_name, last_name, status')
      .ilike('email', cleanEmail)
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
    } else {
      // Check teachers table
      const { data: teacher } = await adminClient
        .from('teachers')
        .select('id, user_id, first_name, last_name, status')
        .ilike('email', cleanEmail)
        .neq('status', 'suspended')
        .maybeSingle();

      if (teacher) {
        if (!teacher.user_id) {
          await adminClient
            .from('teachers')
            .update({ user_id: data.user.id })
            .eq('id', teacher.id);
        }

        const displayName =
          [teacher.first_name, teacher.last_name].filter(Boolean).join(' ') ||
          'Teacher';

        await adminClient.from('profiles').upsert({
          id: data.user.id,
          display_name: displayName,
          role: 'teacher',
        });

        profile = { id: data.user.id, role: 'teacher' };
        profileError = null;
      }
    }
  }

  const allowedRoles = ['admin', 'teacher', 'student'];
  const userRole = profile?.role;

  if (profileError || !userRole || !allowedRoles.includes(userRole)) {
    await supabase.auth.signOut({ scope: 'local' });
    return {
      error: 'Access denied: Your account is not assigned an active role in CampusOS.',
    };
  }

  // Authoritative Portal Validation: ensure authenticated role matches requested portal
  const portal = formData.get('portal')?.toString().toLowerCase().trim();
  if (portal) {
    if (portal === 'student' && userRole !== 'student') {
      await supabase.auth.signOut({ scope: 'local' });
      const cookieStore = await cookies();
      cookieStore.delete(CAMPUSOS_ACTIVITY_COOKIE);
      cookieStore.delete(CAMPUSOS_REMEMBER_COOKIE);
      cookieStore.delete(CAMPUSOS_ROLE_COOKIE);

      const roleName = userRole === 'teacher' ? 'Faculty members' : 'Administrators';
      const targetPortal = userRole === 'teacher' ? 'Faculty Portal' : 'Administrator Portal';
      return {
        error: `Portal mismatch: This login is for students only. ${roleName} must sign in through the ${targetPortal}.`,
      };
    }

    if (portal === 'teacher' && userRole !== 'teacher') {
      await supabase.auth.signOut({ scope: 'local' });
      const cookieStore = await cookies();
      cookieStore.delete(CAMPUSOS_ACTIVITY_COOKIE);
      cookieStore.delete(CAMPUSOS_REMEMBER_COOKIE);
      cookieStore.delete(CAMPUSOS_ROLE_COOKIE);

      const roleName = userRole === 'student' ? 'Students' : 'Administrators';
      const targetPortal = userRole === 'student' ? 'Student Portal' : 'Administrator Portal';
      return {
        error: `Portal mismatch: This login is for faculty members only. ${roleName} must sign in through the ${targetPortal}.`,
      };
    }

    if (portal === 'admin' && userRole !== 'admin') {
      await supabase.auth.signOut({ scope: 'local' });
      const cookieStore = await cookies();
      cookieStore.delete(CAMPUSOS_ACTIVITY_COOKIE);
      cookieStore.delete(CAMPUSOS_REMEMBER_COOKIE);
      cookieStore.delete(CAMPUSOS_ROLE_COOKIE);

      const roleName = userRole === 'student' ? 'Students' : 'Faculty members';
      const targetPortal = userRole === 'student' ? 'Student Portal' : 'Faculty Portal';
      return {
        error: `Portal mismatch: This login is for administrators only. ${roleName} must sign in through the ${targetPortal}.`,
      };
    }
  }

  let destination = '/';
  if (userRole === 'student') {
    destination = '/student/dashboard';
  } else if (userRole === 'teacher') {
    destination = '/teacher/dashboard';
  }

  const rememberMe =
    formData.get('remember_me') === 'on' ||
    formData.get('remember_me') === 'true';

  const cookieStore = await cookies();
  const now = Date.now().toString();
  const baseCookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };

  cookieStore.set(CAMPUSOS_ACTIVITY_COOKIE, now, {
    ...baseCookieOptions,
    ...(rememberMe ? { maxAge: 30 * 24 * 60 * 60 } : {}),
  });

  cookieStore.set(CAMPUSOS_REMEMBER_COOKIE, rememberMe ? '1' : '0', {
    ...baseCookieOptions,
    ...(rememberMe ? { maxAge: 30 * 24 * 60 * 60 } : {}),
  });

  cookieStore.set(CAMPUSOS_ROLE_COOKIE, userRole, {
    ...baseCookieOptions,
    ...(rememberMe ? { maxAge: 30 * 24 * 60 * 60 } : {}),
  });

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

  // Self-heal: If profile row is missing, check if verified auth account is student or teacher
  if ((!profile || !profile.role) && user.email && adminClient) {
    const cleanEmail = user.email.trim().toLowerCase();
    const { data: enrolledStudent } = await adminClient
      .from('students')
      .select('id, user_id, first_name, last_name, status')
      .ilike('email', cleanEmail)
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
    } else {
      // Check teachers table
      const { data: teacher } = await adminClient
        .from('teachers')
        .select('id, user_id, first_name, last_name, status')
        .ilike('email', cleanEmail)
        .neq('status', 'suspended')
        .maybeSingle();

      if (teacher) {
        if (!teacher.user_id) {
          await adminClient
            .from('teachers')
            .update({ user_id: user.id })
            .eq('id', teacher.id);
        }

        const displayName =
          [teacher.first_name, teacher.last_name].filter(Boolean).join(' ') ||
          'Teacher';

        await adminClient.from('profiles').upsert({
          id: user.id,
          display_name: displayName,
          role: 'teacher',
        });

        profile = { role: 'teacher' };
      }
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

  const cookieStore = await cookies();
  cookieStore.set(CAMPUSOS_ACTIVITY_COOKIE, Date.now().toString(), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  cookieStore.set(CAMPUSOS_ROLE_COOKIE, role, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return { success: true, role, destination };
}

/**
 * Signs out the authenticated user locally on this device/browser,
 * invalidates session cookies across all browser tabs, and redirects to login.
 */
export async function logoutAction(customRedirect?: string) {
  const cookieStore = await cookies();
  const supabase = await createClient();

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (err) {
    console.error('[CampusOS Auth] Supabase signOut error:', err);
  }

  // Clear all auth and session cookies
  const allCookies = cookieStore.getAll();
  allCookies.forEach((cookie) => {
    if (cookie.name.startsWith('sb-') || cookie.name.startsWith('campusos_')) {
      cookieStore.delete(cookie.name);
    }
  });

  redirect(customRedirect || '/login?error=logged_out');
}

/**
 * Refreshes the server-side idle session timestamp when the user explicitly extends their session.
 */
export async function refreshSessionAction(): Promise<{ success: boolean; error?: string }> {
  const cookieStore = await cookies();
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { success: false, error: 'Unauthorized: Session not found.' };
  }

  const isRemembered = cookieStore.get(CAMPUSOS_REMEMBER_COOKIE)?.value === '1';
  const now = Date.now().toString();

  cookieStore.set(CAMPUSOS_ACTIVITY_COOKIE, now, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    ...(isRemembered ? { maxAge: 30 * 24 * 60 * 60 } : {}),
  });

  return { success: true };
}
