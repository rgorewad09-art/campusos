import { type EmailOtpType, type User, type SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { getSafeRedirectUrl } from '@/src/lib/security';

/**
 * app/auth/confirm/route.ts
 *
 * Handles email verification tokens and invitation links dispatched by Supabase Auth.
 * Supports both:
 *  1. PKCE Code Exchange (`?code=...`) — default for Supabase Auth redirect flow.
 *  2. Token Hash Verification (`?token_hash=...&type=...`) — for direct OTP and email links.
 *
 * When the student clicks their activation email link:
 * 1. This endpoint exchanges the code or verifies the token, setting session cookies.
 * 2. It links the student's `public.students.user_id` to their auth account.
 * 3. Redirects the student to `/activate/password` to create their password.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash') || searchParams.get('token');
  const type = searchParams.get('type') as EmailOtpType | null;
  const rawNext = searchParams.get('next') || '/activate/password';
  const next = getSafeRedirectUrl(rawNext);

  const supabase = await createClient();

  // 1. Handle PKCE Code Exchange (standard Supabase redirect flow)
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      return await linkStudentAndRedirect(data.user, supabase, next, request);
    }

    console.error('[CampusOS Auth] exchangeCodeForSession failed:', error?.message);
  }

  // 2. Handle OTP Token Hash Verification (direct OTP link flow)
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error && data?.user) {
      return await linkStudentAndRedirect(data.user, supabase, next, request);
    }

    console.error('[CampusOS Auth] verifyOtp failed:', error?.message);
  }

  // Fallback: Token or code invalid, expired, or missing
  const errorRedirect = request.nextUrl.clone();
  errorRedirect.pathname = '/login';
  errorRedirect.searchParams.set('error', 'activation_link_invalid');
  return NextResponse.redirect(errorRedirect);
}

/**
 * Links public.students.user_id if not yet associated, and redirects to password setup.
 */
async function linkStudentAndRedirect(
  user: User,
  supabase: SupabaseClient,
  next: string,
  request: NextRequest
) {
  const adminClient = createAdminClient();
  const dbClient = adminClient || supabase;

  const { data: profile } = await dbClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  // If role is student (or indicated in metadata), link student record to auth user
  if (profile?.role === 'student' || user.user_metadata?.role === 'student') {
    const studentEmail = user.email?.toLowerCase();
    if (studentEmail) {
      await dbClient
        .from('students')
        .update({ user_id: user.id })
        .ilike('email', studentEmail)
        .is('user_id', null);
    }

    // Self-heal profile if missing
    if (!profile && adminClient) {
      const studentName =
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        'Student';
      await adminClient.from('profiles').upsert({
        id: user.id,
        display_name: studentName,
        role: 'student',
      });
    }
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = next;
  redirectUrl.search = '';
  return NextResponse.redirect(redirectUrl);
}
