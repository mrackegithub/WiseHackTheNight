import { describe, expect, it } from 'vitest';
import { SimpleGeoService, geoService } from '../src/geo/geo';

describe('GeoService', () => {
  const service = new SimpleGeoService();

  describe('distanceKm', () => {
    it('returns 0 for identical points', () => {
      const p = { lat: 47.4979, lng: 19.0402 };
      expect(service.distanceKm(p, p)).toBe(0);
    });

    it('calculates accurate distance between known Budapest points', () => {
      // BME Q building: 47.4733, 19.0598
      // Deák Ferenc tér: 47.4979, 19.0541
      // Real ground truth is ~2.76 km
      const bme = { lat: 47.4733, lng: 19.0598 };
      const deak = { lat: 47.4979, lng: 19.0541 };
      const dist = service.distanceKm(bme, deak);
      expect(dist).toBeGreaterThan(2.7);
      expect(dist).toBeLessThan(2.9);
      expect(dist).toBe(2.77);
    });

    it('is symmetric: distance(a, b) === distance(b, a)', () => {
      const a = { lat: 47.5, lng: 19.0 };
      const b = { lat: 47.6, lng: 19.1 };
      expect(service.distanceKm(a, b)).toBe(service.distanceKm(b, a));
    });
  });

  describe('centroid', () => {
    it('returns Budapest center default when points array is empty', () => {
      expect(service.centroid([])).toEqual({ lat: 47.4979, lng: 19.0402 });
    });

    it('returns identical coordinate for single point', () => {
      const p = { lat: 47.48, lng: 19.06 };
      expect(service.centroid([p])).toEqual(p);
    });

    it('computes exact arithmetic mean of multiple coordinates', () => {
      const points = [
        { lat: 47.0, lng: 19.0 },
        { lat: 48.0, lng: 20.0 },
      ];
      expect(service.centroid(points)).toEqual({ lat: 47.5, lng: 19.5 });
    });

    it('handles triangular member cluster', () => {
      const points = [
        { lat: 47.47, lng: 19.05 },
        { lat: 47.48, lng: 19.06 },
        { lat: 47.49, lng: 19.07 },
      ];
      const c = service.centroid(points);
      expect(c.lat).toBe(47.48);
      expect(c.lng).toBe(19.06);
    });
  });

  describe('singleton export', () => {
    it('geoService instance is exported and functional', () => {
      expect(geoService).toBeDefined();
      expect(typeof geoService.distanceKm).toBe('function');
      expect(typeof geoService.centroid).toBe('function');
    });
  });
});

