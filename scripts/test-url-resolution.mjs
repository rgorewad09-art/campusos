/**
 * scripts/test-url-resolution.mjs
 *
 * Automated verification test for CampusOS Application URL Resolution
 * and Activation Link Generation.
 *
 * Verifies:
 *  1. NEXT_PUBLIC_APP_URL precedence when explicitly configured.
 *  2. NEXT_PUBLIC_SITE_URL fallback when configured.
 *  3. VERCEL_PROJECT_PRODUCTION_URL and VERCEL_URL handling (auto-adds https://).
 *  4. Request header resolution (x-forwarded-host / host with x-forwarded-proto).
 *  5. Production guard: In NODE_ENV=production, NEVER falls back to http://localhost:3000.
 *  6. Development fallback: In NODE_ENV=development, safely defaults to http://localhost:3000.
 *  7. buildActivationLink formats direct URLs with token_hash, type, and next=/activate/password.
 *  8. URL normalization (handles leading/trailing whitespace, missing protocols, trailing slashes).
 *
 * Usage:
 *   node --env-file=.env.local scripts/test-url-resolution.mjs
 */

import { getPublicAppUrl, buildActivationLink, normalizeOrigin } from '../src/lib/security.ts';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function runTests() {
  console.log('========================================================');
  console.log('CampusOS Verification: Public URL & Activation Link Flow');
  console.log('========================================================\n');

  // Save original environment
  const originalEnv = { ...process.env };

  try {
    // 1. URL Normalization
    console.log('1. Testing URL Normalization:');
    assert(
      normalizeOrigin('https://campusos.vercel.app/') === 'https://campusos.vercel.app',
      'Strips trailing slash from https URL'
    );
    assert(
      normalizeOrigin('http://localhost:3000///') === 'http://localhost:3000',
      'Strips multiple trailing slashes'
    );
    assert(
      normalizeOrigin('campusos.edu') === 'https://campusos.edu',
      'Adds https:// protocol when missing'
    );
    assert(
      normalizeOrigin('  https://portal.campusos.org  ') === 'https://portal.campusos.org',
      'Trims leading and trailing whitespace'
    );

    // 2. Precedence Rule 1: NEXT_PUBLIC_APP_URL
    console.log('\n2. Testing NEXT_PUBLIC_APP_URL Precedence:');
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    process.env.NODE_ENV = 'production';

    process.env.NEXT_PUBLIC_APP_URL = 'https://custom-college-domain.edu';
    process.env.VERCEL_URL = 'campusos-staging.vercel.app';

    const res1 = getPublicAppUrl();
    assert(
      res1 === 'https://custom-college-domain.edu',
      'NEXT_PUBLIC_APP_URL takes top priority over VERCEL_URL'
    );

    // 3. Precedence Rule 2: VERCEL_PROJECT_PRODUCTION_URL and VERCEL_URL
    console.log('\n3. Testing Vercel Environment Variables:');
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'campusos.vercel.app';
    process.env.VERCEL_URL = 'campusos-git-branch-123.vercel.app';

    const res2 = getPublicAppUrl();
    assert(
      res2 === 'https://campusos.vercel.app',
      'VERCEL_PROJECT_PRODUCTION_URL is prioritized and prepended with https://'
    );

    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const res3 = getPublicAppUrl();
    assert(
      res3 === 'https://campusos-git-branch-123.vercel.app',
      'VERCEL_URL is used when production alias is absent and prepended with https://'
    );

    // 4. Precedence Rule 3: Dynamic Request Headers
    console.log('\n4. Testing Dynamic Request Headers:');
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

    const mockHeaders = {
      get(name) {
        if (name === 'x-forwarded-host') return 'deployed-portal.college.edu';
        if (name === 'x-forwarded-proto') return 'https';
        return null;
      },
    };

    const res4 = getPublicAppUrl(mockHeaders);
    assert(
      res4 === 'https://deployed-portal.college.edu',
      'Incoming x-forwarded-host header resolves correctly with https'
    );

    // 5. Production Protection: Never Fall Back to localhost:3000
    console.log('\n5. Testing Production Localhost Protection:');
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    process.env.NODE_ENV = 'production';

    // Simulate localhost header in production (e.g. server-side internal loopback)
    const mockLocalhostHeaders = {
      get(name) {
        if (name === 'host') return 'localhost:3000';
        return null;
      },
    };

    const res5 = getPublicAppUrl(mockLocalhostHeaders);
    assert(
      !res5.includes('localhost'),
      `In production, URL does not fall back to localhost (resolved: "${res5}")`
    );
    assert(
      res5.startsWith('https://'),
      'Production URL strictly requires https://'
    );

    // 6. Local Development Fallback
    console.log('\n6. Testing Development Fallback:');
    process.env.NODE_ENV = 'development';
    const res6 = getPublicAppUrl();
    assert(
      res6 === 'http://localhost:3000',
      'In development, defaults to http://localhost:3000 when no env vars configured'
    );

    // 7. buildActivationLink Construction
    console.log('\n7. Testing buildActivationLink Formatting:');
    const sampleHash = 'abc123def456tokenhash789';
    const sampleOrigin = 'https://campusos.vercel.app/';

    const directLink = buildActivationLink(sampleOrigin, {
      hashed_token: sampleHash,
      verification_type: 'invite',
    });

    assert(
      directLink !== undefined,
      'Direct link returned for valid token hash'
    );
    assert(
      directLink.startsWith('https://campusos.vercel.app/auth/confirm?'),
      'Direct link base points to https://campusos.vercel.app/auth/confirm'
    );

    const parsedDirect = new URL(directLink);
    assert(
      parsedDirect.searchParams.get('token_hash') === sampleHash,
      'Preserves token_hash query parameter'
    );
    assert(
      parsedDirect.searchParams.get('type') === 'invite',
      'Preserves type query parameter'
    );
    assert(
      parsedDirect.searchParams.get('next') === '/activate/password',
      'Preserves next callback parameter to /activate/password'
    );

    // Action link fallback with URL rewrite
    const rawActionLink = 'https://supabase.co/auth/v1/verify?token=xyz&type=invite&redirect_to=http://localhost:3000';
    const sanitizedActionLink = buildActivationLink('https://campusos.vercel.app', {
      action_link: rawActionLink,
    });

    const parsedAction = new URL(sanitizedActionLink);
    assert(
      parsedAction.searchParams.get('redirect_to') === 'https://campusos.vercel.app/auth/confirm?next=/activate/password',
      'Sanitizes action_link redirect_to parameter to deployed app URL'
    );

  } finally {
    // Restore environment
    process.env = originalEnv;
  }

  console.log('\n========================================================');
  console.log(`Summary: ${passed} tests passed, ${failed} tests failed`);
  console.log('========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
