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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

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

  // 2. Authenticated user: inspect role in public.profiles
  if (user) {
    const adminClient = createAdminClient();
    const dbClient = adminClient || supabase;

    let { data: profile } = await dbClient
      .from('profiles')
      .select('id, role')
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

        profile = { id: user.id, role: 'student' };
      }
    }

    const role = profile?.role;
    const validRoles = ['admin', 'teacher', 'student'];

    // If account has no valid role: deny, revoke, and redirect to /login
    if (!role || !validRoles.includes(role)) {
      await supabase.auth.signOut();

      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
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
      const redirectUrl = request.nextUrl.clone();
      if (role === 'student') redirectUrl.pathname = '/student/dashboard';
      else if (role === 'teacher') redirectUrl.pathname = '/teacher/dashboard';
      else redirectUrl.pathname = '/';
      return NextResponse.redirect(redirectUrl);
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
        return NextResponse.redirect(redirectUrl);
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
        return NextResponse.redirect(redirectUrl);
      }
    }

    // C. Administrators retain full access across all routes
  }

  return supabaseResponse;
}
