import { type EmailOtpType, type User } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { getSafeRedirectUrl } from '@/src/lib/security';
import { CAMPUSOS_ACTIVITY_COOKIE } from '@/src/lib/session';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * app/auth/confirm/route.ts
 *
 * Handles email verification tokens and invitation links dispatched by Supabase Auth.
 * Supports both:
 *  1. PKCE Code Exchange (`?code=...`) — default for Supabase Auth redirect flow.
 *  2. Token Hash Verification (`?token_hash=...&type=...`) — for direct OTP and email links.
 *
 * When the student clicks their activation email link:
 * 1. This endpoint exchanges the code or verifies the token, writing session cookies directly
 *    to the redirect response to ensure mobile browsers and cross-device links preserve the session.
 * 2. It links the student's `public.students.user_id` and prepares `public.profiles`.
 * 3. Redirects the student to `/activate/password` to create their password.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash') || searchParams.get('token');
  const type = searchParams.get('type') as EmailOtpType | null;
  const roleParam = searchParams.get('role');
  const rawNext = searchParams.get('next') || '/activate/password';
  const next = getSafeRedirectUrl(rawNext);

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = next;
  redirectUrl.search = '';

  // Prepare redirect response so session cookies are written directly to Set-Cookie headers
  let response = NextResponse.redirect(redirectUrl);

  if (!supabaseUrl || !supabasePublishableKey) {
    return createErrorRedirect(request, roleParam, rawNext);
  }

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // 1. Handle PKCE Code Exchange (standard Supabase redirect flow)
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      await linkUserAndRepairProfile(data.user, roleParam);
      response.cookies.set(CAMPUSOS_ACTIVITY_COOKIE, Date.now().toString(), {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
      return response;
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
      await linkUserAndRepairProfile(data.user, roleParam);
      response.cookies.set(CAMPUSOS_ACTIVITY_COOKIE, Date.now().toString(), {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
      return response;
    }

    console.error('[CampusOS Auth] verifyOtp failed:', error?.message);
  }

  // Fallback: Token or code invalid, expired, or missing
  return createErrorRedirect(request, roleParam, rawNext);
}

function createErrorRedirect(request: NextRequest, roleParam: string | null, rawNext: string) {
  const errorRedirect = request.nextUrl.clone();
  if (roleParam === 'teacher' || rawNext.includes('/teacher')) {
    errorRedirect.pathname = '/teacher/login';
  } else {
    errorRedirect.pathname = '/student/login';
  }
  errorRedirect.searchParams.set('error', 'activation_link_invalid');
  return NextResponse.redirect(errorRedirect);
}

/**
 * Links student or teacher account to public.students or public.teachers,
 * and ensures public.profiles has the correct role and display name.
 */
async function linkUserAndRepairProfile(user: User, roleHint?: string | null) {
  const adminClient = createAdminClient();
  if (!adminClient || !user.email) return;

  const cleanEmail = user.email.trim().toLowerCase();

  // If roleHint or user metadata explicitly indicates teacher, check teachers first
  const isHintTeacher =
    roleHint === 'teacher' ||
    user.user_metadata?.role === 'teacher';

  if (isHintTeacher) {
    const { data: teacher } = await adminClient
      .from('teachers')
      .select('id, user_id, first_name, last_name')
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

      const teacherName =
        [teacher.first_name, teacher.last_name].filter(Boolean).join(' ') ||
        user.user_metadata?.full_name ||
        'Faculty Member';

      await adminClient.from('profiles').upsert({
        id: user.id,
        display_name: teacherName,
        role: 'teacher',
      });
      return;
    }
  }

  // Check students table
  const { data: student } = await adminClient
    .from('students')
    .select('id, user_id, first_name, last_name')
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

    const studentName =
      [student.first_name, student.last_name].filter(Boolean).join(' ') ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'Student';

    await adminClient.from('profiles').upsert({
      id: user.id,
      display_name: studentName,
      role: 'student',
    });
    return;
  }

  // Check teachers table if not checked above
  if (!isHintTeacher) {
    const { data: teacher } = await adminClient
      .from('teachers')
      .select('id, user_id, first_name, last_name')
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

      const teacherName =
        [teacher.first_name, teacher.last_name].filter(Boolean).join(' ') ||
        user.user_metadata?.full_name ||
        'Faculty Member';

      await adminClient.from('profiles').upsert({
        id: user.id,
        display_name: teacherName,
        role: 'teacher',
      });
      return;
    }
  }

  // Fallback to metadata role if provided
  const metaRole = user.user_metadata?.role || (roleHint === 'teacher' ? 'teacher' : undefined);
  if (metaRole === 'teacher' || metaRole === 'student') {
    const displayName =
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      (metaRole === 'teacher' ? 'Faculty Member' : 'Student');

    await adminClient.from('profiles').upsert({
      id: user.id,
      display_name: displayName,
      role: metaRole,
    });
  }
}
