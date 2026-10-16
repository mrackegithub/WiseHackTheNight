import type { Schemas } from '@sgm/contracts';

type Row = [name: string, type: Schemas['LocationType'], address: string, lat: number, lng: number, bookable: boolean, openingHours: string | null];

/** Budapest study spots around the campuses (stand-in for Agent C's integration seed). */
const rows: Row[] = [
  ['ELTE Déli Tömb Library', 'LIBRARY', 'Pázmány Péter sétány 1/C', 47.4722, 19.0618, true, 'Mo-Fr 08:00-20:00'],
  ['ELTE Északi Tömb study hall', 'CAMPUS_ROOM', 'Pázmány Péter sétány 1/A', 47.4745, 19.0617, true, 'Mo-Fr 07:00-21:00'],
  ['BME Central Library', 'LIBRARY', 'Budafoki út 4', 47.4813, 19.0559, true, 'Mo-Fr 08:00-22:00; Sa 09:00-17:00'],
  ['Corvinus Library', 'LIBRARY', 'Fővám tér 8', 47.4866, 19.0589, true, 'Mo-Fr 09:00-20:00'],
  ['Szabó Ervin Central Library', 'LIBRARY', 'Szabó Ervin tér 1', 47.4895, 19.0632, true, 'Mo-Fr 10:00-20:00; Sa 10:00-16:00'],
  ['Kelet Kávézó', 'CAFE', 'Bartók Béla út 29', 47.4781, 19.0521, false, 'Mo-Su 08:00-23:00'],
  ['Madal Café Allee', 'CAFE', 'Október huszonharmadika u. 8', 47.4752, 19.0484, false, 'Mo-Su 08:00-20:00'],
  ['Hadik Kávéház', 'CAFE', 'Bartók Béla út 36', 47.4776, 19.0505, false, 'Mo-Su 09:00-23:00'],
  ['Infopark Coworking', 'COWORKING', 'Neumann János u. 1', 47.4731, 19.0659, true, 'Mo-Fr 08:00-19:00'],
  ['Budapest Makerspace Hub', 'COWORKING', 'Király u. 26', 47.4991, 19.0599, false, 'Mo-Fr 09:00-21:00'],
  ['Massolit Books & Café', 'CAFE', 'Nagy Diófa u. 30', 47.4978, 19.0628, false, 'Mo-Sa 08:30-20:00'],
  ['BME Q Building group rooms', 'CAMPUS_ROOM', 'Magyar tudósok krt. 2', 47.4733, 19.0598, true, 'Mo-Fr 07:00-20:00'],
  ['Nehru part benches', 'OTHER', 'Nehru part', 47.4848, 19.0633, false, null],
  ['Fővárosi Szabó Ervin Library – Ferencváros', 'LIBRARY', 'Ráday u. 15', 47.4871, 19.0636, false, 'Tu-Fr 12:00-19:00'],
  ['Allee shopping centre food court', 'OTHER', 'Október huszonharmadika u. 8-10', 47.4755, 19.0490, false, 'Mo-Su 10:00-21:00'],
];

export const locations: Schemas['Location'][] = rows.map(([name, type, address, lat, lng, bookable, openingHours], i) => ({
  id: `00000000-0000-4000-8007-${String(i + 1).padStart(12, '0')}`,
  name,
  type,
  address,
  point: { lat, lng },
  bookable,
  openingHours,
  distanceKm: null,
}));

export const locationById = (id: string) => locations.find((l) => l.id === id);
