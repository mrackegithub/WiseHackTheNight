export interface GeoPointResult {
  lat: number;
  lng: number;
  label: string;
}

export interface GeocodeOptions {
  fetcher?: typeof fetch;
  baseUrl?: string;
  userAgent?: string;
  cacheTtlMs?: number;
}

const DEFAULT_USER_AGENT = 'WiseHackTheNight-StudyGroupMatcher/0.1 (+https://github.com/mrackegithub/WiseHackTheNight)';

interface CacheEntry {
  results: GeoPointResult[];
  cachedAt: number;
}

export class NominatimGeocoder {
  private cache = new Map<string, CacheEntry>();
  private lastRequestTime = 0;
  private readonly minIntervalMs = 1000; // 1 request / second rate limit
  private readonly defaultTtlMs = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Geocodes an address or query string into coordinates using Nominatim.
   * Rate-limited to 1 req/sec and cached for 24 hours.
   */
  async geocode(query: string, options: GeocodeOptions = {}): Promise<GeoPointResult[]> {
    const q = query.trim();
    if (q.length < 3) return [];

    const cacheKey = q.toLowerCase();
    const ttl = options.cacheTtlMs ?? this.defaultTtlMs;
    const now = Date.now();

    const cached = this.cache.get(cacheKey);
    if (cached && now - cached.cachedAt < ttl) {
      return cached.results;
    }

    // Rate limiting: wait if less than 1000 ms elapsed since last request
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();

    const baseUrl =
      options.baseUrl ||
      process.env.GEOCODER_URL ||
      'https://nominatim.openstreetmap.org';
    // Nominatim answers 403 to the .env.example placeholder ("your-email@example.com"), so ignore it
    const envUserAgent = process.env.GEOCODER_USER_AGENT;
    const userAgent =
      options.userAgent ||
      (envUserAgent && !envUserAgent.includes('example.com') ? envUserAgent : undefined) ||
      DEFAULT_USER_AGENT;
    const customFetch = options.fetcher ?? fetch;

    const url = new URL('/search', baseUrl);
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '5');
    url.searchParams.set('countrycodes', 'hu'); // the app is Budapest-only
    url.searchParams.set('accept-language', 'en');

    const res = await customFetch(url.toString(), {
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Geocoder HTTP error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    const results: GeoPointResult[] = data.map((item) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      label: item.display_name,
    }));

    this.cache.set(cacheKey, {
      results,
      cachedAt: Date.now(),
    });

    return results;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const geocoder = new NominatimGeocoder();
