import { type NextRequest } from 'next/server';
import { updateSession } from '@/src/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

// Backward compatibility alias
export { proxy as middleware };

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public asset extensions (.svg, .png, .jpg, .jpeg, .gif, .webp, .woff, .woff2)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)',
  ],
};
