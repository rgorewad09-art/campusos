/**
 * scripts/test-connection.mjs
 *
 * Temporary development-only Supabase connection verification script.
 * Performs harmless checks (retrieving session state and pinging the auth health endpoint)
 * without writing any data or exposing tokens/credentials.
 *
 * Usage:
 *   node --env-file=.env.local scripts/test-connection.mjs
 *
 * Safe to delete after verification:
 *   rm scripts/test-connection.mjs
 */

import { supabase } from '../src/lib/supabase/client.ts';

async function testConnection() {
  console.log('--- CampusOS Supabase Verification ---');

  // 1. Check client session retrieval (harmless auth check)
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error('Session check failed:', sessionError.message);
  } else {
    console.log('✓ getSession(): Success (active session:', Boolean(sessionData?.session), ')');
  }

  // 2. Harmless ping to the remote project endpoint
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (url && key) {
    try {
      const response = await fetch(`${url}/auth/v1/health`, {
        headers: { apikey: key },
      });
      console.log(`✓ Remote project health check: HTTP ${response.status} (${response.statusText || 'OK'})`);
      if (response.ok) {
        console.log('✓ Connection verified: Remote Supabase project is online and credentials are valid.');
      }
    } catch (err) {
      console.error('Remote health check error:', err instanceof Error ? err.message : err);
    }
  }

  console.log('--------------------------------------');
}

testConnection();
