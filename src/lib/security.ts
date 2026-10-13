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
