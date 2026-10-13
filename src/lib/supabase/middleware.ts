/**
 * src/lib/supabase/middleware.ts
 *
 * Handles session validation and cookie synchronization in middleware.
 * Enforces route protection:
 *  - Unauthenticated users attempting to access dashboard routes are redirected to /login.
 *  - Authenticated non-admin users are denied access, signed out, and redirected to /login.
 *  - Authenticated admin users attempting to access /login are redirected to /.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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

  // IMPORTANT: auth.getUser() verifies the auth token against the Supabase Auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === '/login';

  // 1. Unauthenticated visitors attempting to access protected routes
  if (!user && !isLoginPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    if (request.nextUrl.pathname !== '/') {
      redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Authenticated user: verify that user has 'admin' role in public.profiles
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = profile?.role === 'admin';

    // If authenticated user is NOT an administrator:
    // Deny access, sign out, clear cookies, and redirect to /login
    if (!isAdmin) {
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

    // If an authenticated admin visits the login page, redirect to dashboard
    if (isLoginPage) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/';
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}
