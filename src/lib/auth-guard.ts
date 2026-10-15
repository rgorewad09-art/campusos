/**
 * src/lib/auth-guard.ts
 *
 * Server-side authorization gate for Server Components and Pages.
 * Enforces:
 *  1. Server-side session verification via Supabase Auth (auth.getUser())
 *  2. Server-enforced 15-minute idle session timeout
 *  3. Strict Role-Based Access Control (RBAC) via public.profiles
 *
 * Prevents relying solely on client-side redirects or hidden UI.
 */

import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';
import {
  isSessionExpired,
  parseActivityTimestamp,
  CAMPUSOS_ACTIVITY_COOKIE,
} from '@/src/lib/session';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

export type UserRole = 'admin' | 'teacher' | 'student';

export interface GuardedUser {
  id: string;
  email?: string;
  role: UserRole;
  displayName: string;
}

/**
 * Enforces server-side authentication, role authorization, and idle session validity.
 * Must be called in protected Server Component pages or layouts.
 */
export async function requireServerAuth(
  allowedRoles: UserRole[],
  options: { redirectTo?: string } = {}
): Promise<GuardedUser> {
  await connection();
  const cookieStore = await cookies();
  const supabase = await createClient();

  // 1. Enforce 15-minute server idle session timeout
  const activityCookieValue = cookieStore.get(CAMPUSOS_ACTIVITY_COOKIE)?.value;
  const lastActivityTime = parseActivityTimestamp(activityCookieValue);

  if (isSessionExpired(lastActivityTime)) {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Ignore background sign-out network errors during expiration
    }

    const loginPath = allowedRoles.includes('student')
      ? '/student/login?error=session_expired'
      : allowedRoles.includes('teacher') && !allowedRoles.includes('admin')
      ? '/teacher/login?error=session_expired'
      : '/login?error=session_expired';

    redirect(loginPath);
  }

  // 2. Cryptographically verify user session with Supabase Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    const defaultLogin = allowedRoles.includes('student')
      ? '/student/login'
      : allowedRoles.includes('teacher') && !allowedRoles.includes('admin')
      ? '/teacher/login'
      : '/login';

    redirect(options.redirectTo || defaultLogin);
  }

  // 3. Resolve role from public.profiles
  const adminClient = createAdminClient();
  const dbClient = adminClient || supabase;

  let { data: profile } = await dbClient
    .from('profiles')
    .select('id, role, display_name')
    .eq('id', user.id)
    .maybeSingle();

  // Self-heal student profile if needed
  if ((!profile || !profile.role) && user.email && adminClient) {
    const cleanEmail = user.email.trim().toLowerCase();
    const { data: student } = await adminClient
      .from('students')
      .select('id, user_id, first_name, last_name, status')
      .ilike('email', cleanEmail)
      .neq('status', 'graduated')
      .maybeSingle();

    if (student) {
      if (!student.user_id) {
        await adminClient
          .from('students')
          .update({ user_id: user.id })
          .eq('id', student.id);
      }

      const displayName =
        [student.first_name, student.last_name].filter(Boolean).join(' ') ||
        'Student';

      await adminClient.from('profiles').upsert({
        id: user.id,
        display_name: displayName,
        role: 'student',
      });

      profile = { id: user.id, role: 'student', display_name: displayName };
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

        profile = { id: user.id, role: 'teacher', display_name: displayName };
      }
    }
  }

  const role = profile?.role as UserRole | undefined;

  // 4. Role Authorization check
  if (!role || !allowedRoles.includes(role)) {
    // Redirect to the user's appropriate portal dashboard instead of unauthorized area
    if (role === 'student') redirect('/student/dashboard');
    if (role === 'teacher') redirect('/teacher/dashboard');
    if (role === 'admin') redirect('/');
    redirect('/login?error=unauthorized');
  }

  return {
    id: user.id,
    email: user.email,
    role,
    displayName: profile?.display_name || user.email?.split('@')[0] || 'User',
  };
}
