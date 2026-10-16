import { describe, expect, it, vi } from 'vitest';
import { NominatimGeocoder } from '../src/geo/geocoding';

describe('NominatimGeocoder', () => {
  it('returns empty array when query length < 3', async () => {
    const geocoder = new NominatimGeocoder();
    const result = await geocoder.geocode('ab');
    expect(result).toEqual([]);
  });

  it('fetches and parses Nominatim response with proper headers', async () => {
    const fakeResponse = [
      {
        lat: '47.497912',
        lon: '19.040235',
        display_name: 'Budapest, Hungary',
      },
    ];

    const fakeFetch: typeof fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(fakeResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const geocoder = new NominatimGeocoder();
    const result = await geocoder.geocode('Budapest', {
      fetcher: fakeFetch,
      baseUrl: 'https://nominatim.example.com',
      userAgent: 'test-agent/1.0',
    });

    expect(result).toHaveLength(1);
    expect(result[0].lat).toBeCloseTo(47.4979, 4);
    expect(result[0].lng).toBeCloseTo(19.0402, 4);
    expect(result[0].label).toBe('Budapest, Hungary');

    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('serves subsequent queries from 24h cache without calling fetcher again', async () => {
    const fakeResponse = [
      {
        lat: '47.4733',
        lon: '19.0598',
        display_name: 'BME Q building',
      },
    ];

    const fakeFetch: typeof fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(fakeResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const geocoder = new NominatimGeocoder();
    const res1 = await geocoder.geocode('BME Q', { fetcher: fakeFetch });
    const res2 = await geocoder.geocode('bme q', { fetcher: fakeFetch }); // Case-insensitive cache hit

    expect(res1).toEqual(res2);
    expect(fakeFetch).toHaveBeenCalledTimes(1); // Cached!
  });
});
