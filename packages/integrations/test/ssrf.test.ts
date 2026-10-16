import { describe, expect, it } from 'vitest';
import {
  fetchIcs,
  isPrivateIp,
  normalizeCalendarUrl,
  validateSafeUrl,
} from '../src/neptun/ssrf';

describe('normalizeCalendarUrl', () => {
  it('converts webcal:// to https://', () => {
    expect(normalizeCalendarUrl('webcal://neptun.bme.hu/cal/abc.ics')).toBe(
      'https://neptun.bme.hu/cal/abc.ics',
    );
  });

  it('converts webcals:// to https://', () => {
    expect(normalizeCalendarUrl('webcals://neptun.bme.hu/cal/abc.ics')).toBe(
      'https://neptun.bme.hu/cal/abc.ics',
    );
  });

  it('preserves https:// and http://', () => {
    expect(normalizeCalendarUrl('https://example.com/calendar.ics')).toBe(
      'https://example.com/calendar.ics',
    );
    expect(normalizeCalendarUrl('http://example.com/calendar.ics')).toBe(
      'http://example.com/calendar.ics',
    );
  });

  it('rejects unsupported protocols', () => {
    expect(() => normalizeCalendarUrl('ftp://example.com/calendar.ics')).toThrow(
      /unsupported.*protocol/i,
    );
    expect(() => normalizeCalendarUrl('file:///etc/passwd')).toThrow(
      /unsupported.*protocol/i,
    );
    expect(() => normalizeCalendarUrl('javascript:alert(1)')).toThrow();
  });
});

describe('isPrivateIp', () => {
  it('identifies loopback IPv4 addresses as private', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('127.1.2.3')).toBe(true);
  });

  it('identifies RFC 1918 private IPv4 ranges', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('10.255.255.254')).toBe(true);
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
    expect(isPrivateIp('192.168.0.254')).toBe(true);
  });

  it('identifies link-local, cloud metadata, and CGNAT IPv4', () => {
    expect(isPrivateIp('169.254.169.254')).toBe(true); // AWS/GCP metadata
    expect(isPrivateIp('169.254.1.1')).toBe(true);
    expect(isPrivateIp('100.64.0.1')).toBe(true);
    expect(isPrivateIp('0.0.0.0')).toBe(true);
    expect(isPrivateIp('255.255.255.255')).toBe(true);
  });

  it('allows public IPv4 addresses', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
    expect(isPrivateIp('152.66.115.1')).toBe(false); // BME IP range
  });

  it('identifies private and loopback IPv6 addresses', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('::')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true); // Link-local
    expect(isPrivateIp('fc00::1')).toBe(true); // Unique local
    expect(isPrivateIp('fd12:3456:789a::1')).toBe(true);
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true); // IPv4-mapped
    expect(isPrivateIp('::ffff:192.168.1.1')).toBe(true);
  });

  it('allows public IPv6 addresses', () => {
    expect(isPrivateIp('2001:4860:4860::8888')).toBe(false); // Google DNS
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false); // Cloudflare DNS
  });
});

describe('validateSafeUrl', () => {
  it('blocks localhost hostnames', async () => {
    await expect(validateSafeUrl('http://localhost/cal.ics')).rejects.toThrow(/SSRF blocked/i);
    await expect(validateSafeUrl('https://app.localhost:8080/cal.ics')).rejects.toThrow(/SSRF blocked/i);
    await expect(validateSafeUrl('https://myhost.local/cal.ics')).rejects.toThrow(/SSRF blocked/i);
    await expect(validateSafeUrl('https://myhost.internal/cal.ics')).rejects.toThrow(/SSRF blocked/i);
  });

  it('blocks private IP literals', async () => {
    await expect(validateSafeUrl('http://127.0.0.1:4000/cal.ics')).rejects.toThrow(/SSRF blocked/i);
    await expect(validateSafeUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow(/SSRF blocked/i);
    await expect(validateSafeUrl('http://192.168.1.50/cal.ics')).rejects.toThrow(/SSRF blocked/i);
    await expect(validateSafeUrl('http://[::1]/cal.ics')).rejects.toThrow(/SSRF blocked/i);
  });
});

describe('fetchIcs', () => {
  it('fetches calendar data with custom fetcher without network calls', async () => {
    const fakeIcs = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';
    const fakeFetch: typeof fetch = async () => {
      return new Response(fakeIcs, {
        status: 200,
        headers: { 'Content-Type': 'text/calendar' },
      });
    };

    const result = await fetchIcs('https://example.com/cal.ics', {
      fetcher: fakeFetch,
      skipDnsCheck: true,
    });
    expect(result).toBe(fakeIcs);
  });

  it('enforces 2 MB size limit via Content-Length header', async () => {
    const fakeFetch: typeof fetch = async () => {
      return new Response('big data', {
        status: 200,
        headers: {
          'Content-Length': (3 * 1024 * 1024).toString(), // 3 MB
        },
      });
    };

    await expect(
      fetchIcs('https://example.com/large.ics', {
        fetcher: fakeFetch,
        skipDnsCheck: true,
      }),
    ).rejects.toThrow(/exceeds max size limit/i);
  });

  it('enforces 2 MB size limit via payload byte length', async () => {
    const hugePayload = 'A'.repeat(2 * 1024 * 1024 + 10);
    const fakeFetch: typeof fetch = async () => {
      return new Response(hugePayload, { status: 200 });
    };

    await expect(
      fetchIcs('https://example.com/large-body.ics', {
        fetcher: fakeFetch,
        skipDnsCheck: true,
      }),
    ).rejects.toThrow(/exceeds max size limit/i);
  });

  it('enforces timeout with AbortController', async () => {
    const fakeFetch: typeof fetch = async (_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    };

    await expect(
      fetchIcs('https://example.com/slow.ics', {
        fetcher: fakeFetch,
        timeoutMs: 50,
        skipDnsCheck: true,
      }),
    ).rejects.toThrow(/timed out after 50ms/i);
  });

  it('safely follows redirects and validates redirect location', async () => {
    let callCount = 0;
    const fakeFetch: typeof fetch = async (url) => {
      callCount++;
      if (url === 'https://example.com/start.ics') {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://cdn.example.com/final.ics' },
        });
      }
      return new Response('BEGIN:VCALENDAR\nEND:VCALENDAR', { status: 200 });
    };

    const result = await fetchIcs('https://example.com/start.ics', {
      fetcher: fakeFetch,
      skipDnsCheck: true,
    });
    expect(result).toContain('VCALENDAR');
    expect(callCount).toBe(2);
  });
});
