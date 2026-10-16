import type { Schemas } from '@sgm/contracts';

/** Tiny Budapest gazetteer standing in for Nominatim behind GET /locations/geocode. */
export const places: Schemas['GeoPoint'][] = [
  { lat: 47.4725, lng: 19.0622, label: 'ELTE Lágymányosi Campus, Pázmány Péter sétány, Budapest XI.' },
  { lat: 47.4813, lng: 19.0559, label: 'BME Central Library, Budafoki út 4, Budapest XI.' },
  { lat: 47.4867, lng: 19.0587, label: 'Corvinus University, Fővám tér 8, Budapest IX.' },
  { lat: 47.4897, lng: 19.0614, label: 'Kálvin tér, Budapest VIII.' },
  { lat: 47.4979, lng: 19.0545, label: 'Deák Ferenc tér, Budapest V.' },
  { lat: 47.5052, lng: 19.0632, label: 'Oktogon, Budapest VI.' },
  { lat: 47.5103, lng: 19.0567, label: 'Nyugati pályaudvar, Budapest VI.' },
  { lat: 47.5004, lng: 19.0838, label: 'Keleti pályaudvar, Budapest VIII.' },
  { lat: 47.4771, lng: 19.0478, label: 'Móricz Zsigmond körtér, Budapest XI.' },
  { lat: 47.5076, lng: 19.0254, label: 'Széll Kálmán tér, Budapest II.' },
  { lat: 47.4944, lng: 19.0617, label: 'Astoria, Budapest VII.' },
  { lat: 47.5266, lng: 19.0475, label: 'Újpest-Városkapu, Budapest XIII.' },
  { lat: 47.4612, lng: 19.0207, label: 'Kelenföld, Budapest XI.' },
];

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function geocode(q: string) {
  const needle = fold(q.trim());
  return places.filter((p) => fold(p.label ?? '').includes(needle)).slice(0, 5);
}
