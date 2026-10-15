/**
 * src/lib/supabase/admin.ts
 *
 * SECURE SERVER-ONLY Supabase Admin Client.
 *
 * Uses the Supabase service_role key to perform administrative operations
 * such as user invitation (auth.admin.inviteUserByEmail) and user management.
 *
 * CRITICAL SECURITY RULES:
 * 1. NEVER import this file into client components or client bundles.
 * 2. NEVER prefix SUPABASE_SERVICE_ROLE_KEY with NEXT_PUBLIC_.
 * 3. Never return the service_role key to clients in API responses.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function getAdminCredentials() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { supabaseUrl, serviceRoleKey };
}

/**
 * Returns true if the service_role key is present in environment variables.
 */
export function isServiceRoleConfigured(): boolean {
  const { supabaseUrl, serviceRoleKey } = getAdminCredentials();
  return Boolean(supabaseUrl && serviceRoleKey && serviceRoleKey.trim().length > 0);
}

/**
 * Creates and returns a Supabase client with administrative service_role privileges.
 * Returns null if the service_role key is not configured in the environment.
 */
export function createAdminClient(): SupabaseClient | null {
  const { supabaseUrl, serviceRoleKey } = getAdminCredentials();
  if (!isServiceRoleConfigured()) {
    return null;
  }

  return createClient(supabaseUrl!, serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
