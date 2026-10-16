import type { GeoService } from '../ports';

export class SimpleGeoService implements GeoService {
  /**
   * Great-circle distance between two lat/lng coordinates in kilometers using Haversine formula.
   * Result is rounded to 2 decimal places.
   */
  distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371; // Earth radius in km
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h =
      sinDLat * sinDLat +
      Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return Math.round(R * c * 100) / 100;
  }

  /**
   * Geographic centroid (arithmetic mean of lat and lng) rounded to 6 decimal places.
   * Defaults to central Budapest (47.4979, 19.0402) if points list is empty.
   */
  centroid(points: { lat: number; lng: number }[]): { lat: number; lng: number } {
    if (points.length === 0) {
      return { lat: 47.4979, lng: 19.0402 }; // Budapest center fallback
    }
    const sum = points.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 },
    );
    return {
      lat: Math.round((sum.lat / points.length) * 1e6) / 1e6,
      lng: Math.round((sum.lng / points.length) * 1e6) / 1e6,
    };
  }
}

export const geoService: GeoService = new SimpleGeoService();

