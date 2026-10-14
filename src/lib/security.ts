/**
 * src/lib/security.ts
 *
 * Security utilities for CampusOS:
 * - Safe redirect URL validation (CWE-601 Open Redirect mitigation)
 * - PostgREST query filter sanitization (Filter Injection mitigation)
 * - Strict UUID v4 format validation
 * - Safe error message shielding (CWE-209 Information Disclosure mitigation)
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates whether an input is a valid RFC 4122 UUID string.
 */
export function isValidUuid(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

/**
 * Sanitizes user input before interpolation into PostgREST filter expressions (.or(), .ilike()).
 * PostgREST uses commas (',') for OR condition separation, parentheses ('()') for grouping,
 * colons and dots for operator syntax, and percent signs ('%') for wildcards.
 * Strips these control characters to prevent filter injection and query syntax corruption.
 */
export function sanitizePostgrestSearch(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';
  // Strip PostgREST filter operators, wildcards, delimiters, and control characters
  return input
    .replace(/[,()%"'\\:.]/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validates and sanitizes a target redirect URL to prevent Open Redirect attacks (CWE-601).
 * Restricts redirection strictly to internal relative pathnames starting with a single '/'
 * and explicitly rejects scheme-relative URLs ('//evil.com') or backslash tricks ('/\evil.com').
 */
export function getSafeRedirectUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '/';
  const trimmed = url.trim();

  // Must begin with a single slash, disallow protocol-relative URLs (//) or backslash evasions (/\)
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return '/';
  }

  // Reject control characters or whitespace injection
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return '/';
  }

  try {
    const parsed = new URL(trimmed, 'http://localhost');
    // Ensure origin remains strictly local
    if (parsed.origin !== 'http://localhost') {
      return '/';
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
  } catch {
    return '/';
  }
}

/**
 * Determines if an error is an intended authentication/authorization error.
 * Used to preserve user feedback for 401/403 states while masking internal database errors.
 */
export function isAuthError(err: unknown): boolean {
  if (err instanceof Error) {
    return (
      err.message.startsWith('Unauthorized') ||
      err.message.startsWith('Forbidden') ||
      err.message.includes('Access denied')
    );
  }
  return false;
}

/**
 * Inspects binary magic bytes from the file header to determine genuine MIME type.
 * Protects against disguised or malicious file extensions.
 * Supports genuine PDF, PNG, JPEG, and WebP files.
 */
export function detectMimeTypeFromBuffer(buffer: Uint8Array): string | null {
  if (buffer.length < 4) return null;

  // PDF: %PDF- (0x25 0x50 0x44 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'application/pdf';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // WEBP: RIFF....WEBP (0x52 0x49 0x46 0x46 ... 0x57 0x45 0x42 0x50)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Normalizes a URL string by ensuring a valid protocol and removing trailing slashes.
 */
export function normalizeOrigin(url: string): string {
  let cleaned = url.trim();
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned.replace(/\/+$/, '');
}

/**
 * Resolves the public application base URL for generating activation links and redirects.
 *
 * Precedence:
 * 1. NEXT_PUBLIC_APP_URL (explicitly configured production/custom domain)
 * 2. NEXT_PUBLIC_SITE_URL (backward-compatible alias)
 * 3. VERCEL_PROJECT_PRODUCTION_URL or VERCEL_URL (automatically provided by Vercel)
 * 4. Incoming request headers (x-forwarded-host / host with x-forwarded-proto)
 * 5. Fallback:
 *    - In development (NODE_ENV !== 'production'): http://localhost:3000
 *    - In production (NODE_ENV === 'production'): never localhost; uses deployment host or fail-safe URL.
 */
export function getPublicAppUrl(
  requestHeaders?: { get(name: string): string | null } | null
): string {
  // 1. Prefer NEXT_PUBLIC_APP_URL when explicitly configured
  const envAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envAppUrl) {
    return normalizeOrigin(envAppUrl);
  }

  // 1b. Support NEXT_PUBLIC_SITE_URL for backward compatibility
  const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envSiteUrl) {
    return normalizeOrigin(envSiteUrl);
  }

  // 2. Otherwise, use the Vercel deployment URL from VERCEL_URL when available (adding https://)
  const vercelProdUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProdUrl) {
    return normalizeOrigin(`https://${vercelProdUrl}`);
  }

  const vercelUrl =
    process.env.VERCEL_URL?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_URL?.trim();
  if (vercelUrl) {
    return normalizeOrigin(`https://${vercelUrl}`);
  }

  // 3. Fallback to incoming request headers (x-forwarded-host / host with x-forwarded-proto)
  if (requestHeaders) {
    const host =
      requestHeaders.get('x-forwarded-host') ||
      requestHeaders.get('host');

    if (host) {
      const isLocalHost = host.includes('localhost') || host.includes('127.0.0.1');

      if (!isLocalHost || process.env.NODE_ENV !== 'production') {
        const proto =
          requestHeaders.get('x-forwarded-proto') ||
          (isLocalHost ? 'http' : 'https');
        return normalizeOrigin(`${proto}://${host}`);
      }
    }
  }

  // 4. In development, fallback to localhost:3000
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000';
  }

  // 5. In production, never fall back to localhost
  if (requestHeaders) {
    const rawHost = requestHeaders.get('host');
    if (rawHost && !rawHost.includes('localhost')) {
      return normalizeOrigin(`https://${rawHost}`);
    }
  }

  return 'https://campusos.vercel.app';
}

/**
 * Formats a direct application activation link pointing to /auth/confirm.
 * Preserves the verification token hash, type, and callback parameter.
 */
export function buildActivationLink(
  origin: string,
  properties?: {
    hashed_token?: string;
    action_link?: string;
    verification_type?: string;
  } | null
): string | undefined {
  if (!properties) return undefined;
  const base = normalizeOrigin(origin);

  // 1. Direct App URL: Preferred because it navigates directly to the application's
  // /auth/confirm endpoint without relying on Supabase Dashboard Site URL or redirect allowlist configuration
  if (properties.hashed_token) {
    const type = properties.verification_type || 'invite';
    const params = new URLSearchParams({
      token_hash: properties.hashed_token,
      type,
      next: '/activate/password',
    });
    return `${base}/auth/confirm?${params.toString()}`;
  }

  // 2. Action link fallback: Sanitize redirect_to if it points to localhost in production
  if (properties.action_link) {
    try {
      const parsed = new URL(properties.action_link);
      parsed.searchParams.set('redirect_to', `${base}/auth/confirm?next=/activate/password`);
      return parsed.toString();
    } catch {
      return properties.action_link;
    }
  }

  return undefined;
}

