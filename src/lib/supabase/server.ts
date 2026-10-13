/**
 * src/lib/supabase/server.ts
 *
 * Server-side Supabase client for Server Actions and Server Components.
 * Reads and writes secure cookies using Next.js headers/cookies API.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    '[CampusOS] Missing environment variable: NEXT_PUBLIC_SUPABASE_URL\n' +
      'Add it to your .env.local file and restart the dev server.'
  );
}

if (!supabasePublishableKey) {
  throw new Error(
    '[CampusOS] Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\n' +
      'Add it to your .env.local file and restart the dev server.'
  );
}

export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabasePublishableKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if middleware is refreshing user sessions.
        }
      },
    },
  });
}
