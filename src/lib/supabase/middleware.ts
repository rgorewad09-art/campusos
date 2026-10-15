/**
 * src/lib/supabase/middleware.ts
 *
 * Handles session validation and cookie synchronization in Next.js middleware.
 * Enforces Role-Based Access Control (RBAC) across Administrator, Teacher, and Student roles:
 *  - Public paths: /login, /auth/confirm, /activate/*
 *  - Students: restricted to /student/* and /activate/*
 *  - Teachers: restricted to /teacher/*, /attendance, /students
 *  - Administrators: full access across all application routes
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/src/lib/supabase/admin';
import {
  SESSION_IDLE_TIMEOUT_MS,
  ACTIVITY_REFRESH_THROTTLE_MS,
  CAMPUSOS_ACTIVITY_COOKIE,
  CAMPUSOS_REMEMBER_COOKIE,
  isSessionExpired,
  parseActivityTimestamp,
} from '@/src/lib/session';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function redirectWithCookies(url: URL, sourceResponse: NextResponse): NextResponse {
  const redirectResponse = NextResponse.redirect(url);
  sourceResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  if (!supabaseUrl || !supabasePublishableKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: auth.getUser() verifies the token against the Supabase Auth server
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isStudentLogin = pathname === '/student/login';
  const isTeacherLogin = pathname === '/teacher/login';
  const isGenericLogin = pathname === '/login';
  const isLoginPage = isGenericLogin || isStudentLogin || isTeacherLogin;
  const isAuthConfirm = pathname.startsWith('/auth/confirm');
  const isActivationPage = pathname.startsWith('/activate');

  // Allow public access to auth confirmation
  if (isAuthConfirm) {
    return supabaseResponse;
  }

  // 1. Unauthenticated visitors attempting to access protected routes
  if (!user) {
    if (isLoginPage || isActivationPage) {
      return supabaseResponse;
    }

    const redirectUrl = request.nextUrl.clone();
    if (pathname.startsWith('/student')) {
      redirectUrl.pathname = '/student/login';
    } else if (pathname.startsWith('/teacher')) {
      redirectUrl.pathname = '/teacher/login';
    } else {
      redirectUrl.pathname = '/login';
    }

    if (pathname !== '/' && pathname !== '/student/dashboard' && pathname !== '/teacher/dashboard') {
      redirectUrl.searchParams.set('redirectTo', pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Authenticated user: enforce 15-minute idle session timeout and RBAC
  if (user) {
    const now = Date.now();
    const activityCookie = request.cookies.get(CAMPUSOS_ACTIVITY_COOKIE)?.value;
    const lastActivityTime = parseActivityTimestamp(activityCookie);

    // Enforce 15-minute idle session timeout
    if (isSessionExpired(lastActivityTime, now)) {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // Ignore background sign-out network error
      }

      const redirectUrl = request.nextUrl.clone();
      if (pathname.startsWith('/student')) {
        redirectUrl.pathname = '/student/login';
      } else if (pathname.startsWith('/teacher')) {
        redirectUrl.pathname = '/teacher/login';
      } else {
        redirectUrl.pathname = '/login';
      }
      redirectUrl.searchParams.set('error', 'session_expired');
      if (pathname !== '/' && !pathname.includes('/dashboard')) {
        redirectUrl.searchParams.set('redirectTo', pathname);
      }

      const response = NextResponse.redirect(redirectUrl);
      request.cookies.getAll().forEach((c) => {
        if (c.name.startsWith('sb-') || c.name.startsWith('campusos_')) {
          response.cookies.delete(c.name);
        }
      });
      return response;
    }

    // Refresh activity timestamp only on meaningful user activity (HTML navigation or mutation)
    const isPrefetch =
      request.headers.get('purpose') === 'prefetch' ||
      request.headers.get('next-router-prefetch') === '1';
    const isHtmlNav =
      request.method === 'GET' &&
      request.headers.get('accept')?.includes('text/html');
    const isMutation =
      request.method === 'POST' ||
      request.method === 'PUT' ||
      request.method === 'DELETE' ||
      request.headers.has('next-action');

    const shouldRefreshActivity =
      !isPrefetch &&
      (isHtmlNav || isMutation) &&
      (!lastActivityTime || now - lastActivityTime >= ACTIVITY_REFRESH_THROTTLE_MS);

    if (shouldRefreshActivity) {
      const isRemembered = request.cookies.get(CAMPUSOS_REMEMBER_COOKIE)?.value === '1';
      const cookieOptions = {
        path: '/',
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
        ...(isRemembered ? { maxAge: 30 * 24 * 60 * 60 } : {}),
      };
      supabaseResponse.cookies.set(CAMPUSOS_ACTIVITY_COOKIE, String(now), cookieOptions);
    }

    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;

    let { data: profile } = await dbClient
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    // Self-heal: If profile row is missing or lacks role, check students then teachers
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

        profile = { id: user.id, role: 'student' };
      } else {
        const { data: enrolledTeacher } = await adminClient
          .from('teachers')
          .select('id, user_id, first_name, last_name, status')
          .ilike('email', cleanEmail)
          .neq('status', 'suspended')
          .maybeSingle();

        if (enrolledTeacher) {
          if (!enrolledTeacher.user_id) {
            await adminClient
              .from('teachers')
              .update({ user_id: user.id })
              .eq('id', enrolledTeacher.id);
          }

          const displayName =
            [enrolledTeacher.first_name, enrolledTeacher.last_name]
              .filter(Boolean)
              .join(' ') || 'Teacher';

          await adminClient.from('profiles').upsert({
            id: user.id,
            display_name: displayName,
            role: 'teacher',
          });

          profile = { id: user.id, role: 'teacher' };
        } else if (user.user_metadata?.role === 'teacher' || user.user_metadata?.role === 'student') {
          const metaRole = user.user_metadata.role;
          await adminClient.from('profiles').upsert({
            id: user.id,
            display_name: user.user_metadata?.full_name || (metaRole === 'teacher' ? 'Teacher' : 'Student'),
            role: metaRole,
          });
          profile = { id: user.id, role: metaRole };
        }
      }
    }

    const role = profile?.role;
    const validRoles = ['admin', 'teacher', 'student'];

    // If account has no valid role: deny, revoke, and redirect to portal login
    if (!role || !validRoles.includes(role)) {
      await supabase.auth.signOut({ scope: 'local' });

      const redirectUrl = request.nextUrl.clone();
      if (pathname.startsWith('/student')) {
        redirectUrl.pathname = '/student/login';
      } else if (pathname.startsWith('/teacher')) {
        redirectUrl.pathname = '/teacher/login';
      } else {
        redirectUrl.pathname = '/login';
      }
      redirectUrl.searchParams.set('error', 'unauthorized');
      const response = NextResponse.redirect(redirectUrl);

      // Clean up Supabase auth cookies
      request.cookies.getAll().forEach((cookie) => {
        if (cookie.name.startsWith('sb-')) {
          response.cookies.delete(cookie.name);
        }
      });

      return response;
    }

    // Role-based destination for login page visits
    if (isLoginPage) {
      if (request.nextUrl.searchParams.has('error')) {
        return supabaseResponse;
      }

      // Automatically redirect users who visit their own portal's login page
      const isVisitingOwnLogin =
        (isStudentLogin && role === 'student') ||
        (isTeacherLogin && role === 'teacher') ||
        (isGenericLogin && role === 'admin');

      if (isVisitingOwnLogin) {
        const redirectUrl = request.nextUrl.clone();
        if (role === 'student') redirectUrl.pathname = '/student/dashboard';
        else if (role === 'teacher') redirectUrl.pathname = '/teacher/dashboard';
        else redirectUrl.pathname = '/';
        return redirectWithCookies(redirectUrl, supabaseResponse);
      }

      // Allow authenticated users to intentionally visit a different portal's login page to switch accounts
      return supabaseResponse;
    }

    // Role-specific route boundaries:
    // A. Students cannot access admin/faculty management areas (/students, /attendance, /settings, /)
    if (role === 'student') {
      const isStudentAllowed =
        pathname === '/student' ||
        pathname.startsWith('/student/') ||
        pathname.startsWith('/activate');

      if (!isStudentAllowed) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = '/student/dashboard';
        return redirectWithCookies(redirectUrl, supabaseResponse);
      }
    }

    // B. Teachers cannot access admin-only settings, student enrollment, or student portal views
    if (role === 'teacher') {
      const isTeacherBlocked =
        pathname === '/' ||
        pathname.startsWith('/settings') ||
        pathname === '/students/enroll' ||
        pathname === '/student' ||
        pathname.startsWith('/student/');

      if (isTeacherBlocked) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = '/teacher/dashboard';
        return redirectWithCookies(redirectUrl, supabaseResponse);
      }
    }

    // C. Administrators retain full access across all routes
  }

  return supabaseResponse;
}
