/**
 * src/lib/supabase/client.ts
 *
 * Browser Supabase client for CampusOS.
 * Uses @supabase/ssr createBrowserClient to persist auth state
 * in browser cookies, enabling server-side session synchronization.
 */

import { createBrowserClient } from '@supabase/ssr';
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

/**
 * Returns a browser Supabase client instance.
 */
export function createClient(): SupabaseClient {
  return createBrowserClient(supabaseUrl!, supabasePublishableKey!);
}

/**
 * Singleton browser Supabase client for client-side components.
 */
export const supabase: SupabaseClient = createBrowserClient(
  supabaseUrl,
  supabasePublishableKey
);
