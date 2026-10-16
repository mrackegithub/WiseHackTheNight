import dns from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Normalises a calendar import URL (e.g. webcal:// to https://).
 * Validates protocol is http: or https:.
 */
export function normalizeCalendarUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  let normalized = trimmed;
  if (normalized.startsWith('webcal://')) {
    normalized = 'https://' + normalized.slice('webcal://'.length);
  } else if (normalized.startsWith('webcals://')) {
    normalized = 'https://' + normalized.slice('webcals://'.length);
  }

  const parsed = new URL(normalized);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported calendar URL protocol: ${parsed.protocol}`);
  }

  return parsed.toString();
}

/**
 * Checks whether an IPv4 or IPv6 address belongs to private, loopback,
 * link-local, multicast, or reserved ranges (SSRF protection).
 */
export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 0) return true; // Invalid IP is treated as unsafe

  if (version === 4) {
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true;
    }

    const [b0, b1] = parts;

    // 0.0.0.0/8 (Current network)
    if (b0 === 0) return true;
    // 10.0.0.0/8 (Private network)
    if (b0 === 10) return true;
    // 100.64.0.0/10 (Shared address / CGNAT)
    if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;
    // 127.0.0.0/8 (Loopback)
    if (b0 === 127) return true;
    // 169.254.0.0/16 (Link-local, AWS/GCP/Azure instance metadata 169.254.169.254)
    if (b0 === 169 && b1 === 254) return true;
    // 172.16.0.0/12 (Private network)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (b0 === 192 && b1 === 0 && parts[2] === 0) return true;
    // 192.0.2.0/24 (Documentation / TEST-NET-1)
    if (b0 === 192 && b1 === 0 && parts[2] === 2) return true;
    // 192.168.0.0/16 (Private network)
    if (b0 === 192 && b1 === 168) return true;
    // 198.18.0.0/15 (Benchmark testing)
    if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;
    // 198.51.100.0/24 (Documentation / TEST-NET-2)
    if (b0 === 198 && b1 === 51 && parts[2] === 100) return true;
    // 203.0.113.0/24 (Documentation / TEST-NET-3)
    if (b0 === 203 && b1 === 0 && parts[2] === 113) return true;
    // 224.0.0.0/4 (Multicast)
    if (b0 >= 224 && b0 <= 239) return true;
    // 240.0.0.0/4 (Reserved)
    if (b0 >= 240) return true;

    return false;
  }

  if (version === 6) {
    const lower = ip.toLowerCase();

    // :: / ::1 (unspecified and loopback)
    if (lower === '::' || lower === '::1' || lower === '0:0:0:0:0:0:0:0' || lower === '0:0:0:0:0:0:0:1') {
      return true;
    }

    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
    if (lower.startsWith('::ffff:')) {
      const v4Part = lower.slice('::ffff:'.length);
      if (isIP(v4Part) === 4) {
        return isPrivateIp(v4Part);
      }
      return true;
    }

    // Unique Local Addresses (fc00::/7) -> fc... or fd...
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;

    // Link-Local Addresses (fe80::/10) -> fe8..., fe9..., fea..., feb...
    if (
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb')
    ) {
      return true;
    }

    // Multicast (ff00::/8)
    if (lower.startsWith('ff')) return true;

    return false;
  }

  return true;
}

/**
 * Validates that a URL is safe to fetch and does not resolve to private/internal IPs.
 */
export async function validateSafeUrl(rawUrl: string): Promise<URL> {
  const normalized = normalizeCalendarUrl(rawUrl);
  const parsed = new URL(normalized);

  const hostname = parsed.hostname;

  // Block localhost and standard loopback hostnames
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error(`SSRF blocked: Hostname ${hostname} is disallowed`);
  }

  // If hostname is IP literal, test directly
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error(`SSRF blocked: IP ${hostname} is private or reserved`);
    }
    return parsed;
  }

  // Resolve hostname via DNS
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      throw new Error(`DNS resolution failed for hostname ${hostname}`);
    }

    for (const record of addresses) {
      if (isPrivateIp(record.address)) {
        throw new Error(
          `SSRF blocked: Hostname ${hostname} resolved to private IP ${record.address}`,
        );
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('SSRF blocked')) {
      throw err;
    }
    throw new Error(`DNS resolution failed for ${hostname}: ${err instanceof Error ? err.message : String(err)}`);
  }

  return parsed;
}

export interface FetchIcsOptions {
  timeoutMs?: number;
  maxBytes?: number;
  fetcher?: typeof fetch;
  skipDnsCheck?: boolean; // Useful for mock server / unit tests
}

/**
 * Fetches iCal content safely from a URL with SSRF protection,
 * 10 s timeout, and 2 MB cap.
 */
export async function fetchIcs(rawUrl: string, options: FetchIcsOptions = {}): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024; // 2 MB
  const customFetch = options.fetcher ?? fetch;

  let currentUrl = normalizeCalendarUrl(rawUrl);
  let redirects = 0;
  const maxRedirects = 3;

  while (redirects <= maxRedirects) {
    if (!options.skipDnsCheck) {
      await validateSafeUrl(currentUrl);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await customFetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'StudyGroupMatcher/1.0 (+https://github.com/mrackegithub/WiseHackTheNight)',
          Accept: 'text/calendar, text/plain, */*',
        },
      });

      // Handle redirect
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          throw new Error(`Redirect with status ${response.status} missing Location header`);
        }
        currentUrl = new URL(location, currentUrl).toString();
        redirects++;
        continue;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch iCal: HTTP ${response.status} ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > maxBytes) {
        throw new Error(`iCal content exceeds max size limit of ${maxBytes} bytes`);
      }

      // Stream / read text with size check
      const text = await response.text();
      if (Buffer.byteLength(text, 'utf8') > maxBytes) {
        throw new Error(`iCal content exceeds max size limit of ${maxBytes} bytes`);
      }

      return text;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`iCal fetch timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`Too many redirects (max ${maxRedirects}) fetching iCal URL`);
}
