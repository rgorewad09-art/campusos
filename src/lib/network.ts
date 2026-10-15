/**
 * src/lib/network.ts
 *
 * Campus Network & Wi-Fi Verification Engine for CampusOS.
 *
 * Requirements & Constraints:
 * 1. Browsers cannot prove Wi-Fi connectivity on their own; client-side
 *    claims and browser network APIs can easily be spoofed.
 * 2. Only trusted server request metadata (x-forwarded-for, x-real-ip) is evaluated.
 * 3. Never hardcodes guessed campus IP ranges.
 * 4. Features a disabled-by-default feature flag: CAMPUSOS_WIFI_VERIFY_ENABLED.
 * 5. Configured via CAMPUSOS_CAMPUS_IP_RANGES (comma-separated IP addresses or CIDR blocks).
 */

export interface NetworkVerificationResult {
  verified: boolean;
  clientIp: string;
  bypassed?: boolean;
  reason?: string;
}

/**
 * Extracts the real client IP address from trusted reverse-proxy headers.
 * Takes the leftmost IP from x-forwarded-for, or falls back to x-real-ip or localhost.
 */
export function extractClientIp(headerList: { get(name: string): string | null }): string {
  const forwardedFor = headerList.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = headerList.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  return '127.0.0.1';
}

/**
 * Parses an IPv4 address string into a 32-bit integer.
 */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Checks whether an IP address falls within a given CIDR block or matches an exact IP.
 * Supports IPv4 exact and subnet matching, and IPv6 exact matching (e.g. ::1).
 */
export function isIpInSubnet(ip: string, subnetOrIp: string): boolean {
  const cleanIp = ip.trim().toLowerCase();
  const cleanSubnet = subnetOrIp.trim().toLowerCase();

  // Exact string match (IPv4 or IPv6)
  if (cleanIp === cleanSubnet) return true;

  // Localhost IPv6 loopback
  if ((cleanIp === '::1' || cleanIp === '::ffff:127.0.0.1') && (cleanSubnet === '127.0.0.1' || cleanSubnet === '::1')) {
    return true;
  }

  // IPv4 CIDR matching
  if (cleanSubnet.includes('/')) {
    const [networkIp, maskStr] = cleanSubnet.split('/');
    const prefixLength = parseInt(maskStr, 10);

    if (isNaN(prefixLength) || prefixLength < 0 || prefixLength > 32) {
      return false;
    }

    const ipInt = ipv4ToInt(cleanIp);
    const networkInt = ipv4ToInt(networkIp);

    if (ipInt === null || networkInt === null) {
      return false;
    }

    if (prefixLength === 0) return true;

    const mask = ((0xffffffff << (32 - prefixLength)) >>> 0);
    return (ipInt & mask) === (networkInt & mask);
  }

  return false;
}

/**
 * Verifies whether the incoming HTTP request originates from an authorized campus network.
 *
 * Configuration:
 * - CAMPUSOS_WIFI_VERIFY_ENABLED: 'true' to enable enforcement (defaults to 'false')
 * - CAMPUSOS_CAMPUS_IP_RANGES: comma-separated list of allowed CIDR blocks or IPs
 *   (e.g., "192.168.1.0/24,10.0.0.0/8,203.0.113.0/24,127.0.0.1")
 */
export function verifyCampusNetwork(headerList: { get(name: string): string | null }): NetworkVerificationResult {
  const isEnabled = process.env.CAMPUSOS_WIFI_VERIFY_ENABLED === 'true';
  const clientIp = extractClientIp(headerList);

  // If verification is disabled by institutional policy or environment configuration
  if (!isEnabled) {
    return {
      verified: true,
      clientIp,
      bypassed: true,
    };
  }

  const allowedRangesStr = process.env.CAMPUSOS_CAMPUS_IP_RANGES || '';
  const allowedRanges = allowedRangesStr
    .split(',')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  if (allowedRanges.length === 0) {
    // If enabled but no ranges configured, log warning and bypass safely
    console.warn('[CampusOS Network] CAMPUSOS_WIFI_VERIFY_ENABLED is true but CAMPUSOS_CAMPUS_IP_RANGES is empty.');
    return {
      verified: true,
      clientIp,
      bypassed: true,
      reason: 'No campus network ranges defined.',
    };
  }

  const matches = allowedRanges.some((range) => isIpInSubnet(clientIp, range));

  if (matches) {
    return {
      verified: true,
      clientIp,
    };
  }

  return {
    verified: false,
    clientIp,
    reason: `Request IP (${clientIp}) is outside the verified campus Wi-Fi network.`,
  };
}
