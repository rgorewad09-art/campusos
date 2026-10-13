'use server';

import { createClient } from '@/src/lib/supabase/server';
import { redirect } from 'next/navigation';

export interface AuthActionState {
  error?: string;
  success?: boolean;
}

/**
 * Authenticates an administrator with email and password.
 * Validates that the user's UUID corresponds to a public.profiles
 * record with role = 'admin'. If not, the session is revoked immediately.
 */
export async function loginAction(
  _prevState: AuthActionState | null,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get('email')?.toString().trim();
  const password = formData.get('password')?.toString();

  if (!email || !password) {
    return { error: 'Please enter both email and password.' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: 'Please enter a valid email address.' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: error?.message || 'Invalid email or password.' };
  }

  // Enforce server-side role check: public.profiles where role = 'admin'
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== 'admin') {
    // Immediately revoke session if not authorized as administrator
    await supabase.auth.signOut();
    return {
      error: 'Access denied: This account is not authorized as an administrator.',
    };
  }

  return { success: true };
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
