// OWNER: Agent C — Ticket C7: Integration Seed.
import type { Prisma, PrismaClient, LocationType } from '@prisma/client';
import { DateTime } from '@sgm/integrations';
import type { CoreSeedResult } from './core.seed';

interface SeedLocationInput {
  name: string;
  type: LocationType;
  address: string;
  lat: number;
  lng: number;
  openingHours: string;
  osmId: string;
  rooms: Array<{
    name: string;
    capacity: number;
    equipment: string[];
    provider?: 'MOCK' | 'LIBCAL' | 'MS_GRAPH';
  }>;
}

export const BUDAPEST_LOCATIONS: SeedLocationInput[] = [
  {
    name: 'BME Central Library (OMIKK)',
    type: 'LIBRARY',
    address: '1111 Budapest, Műegyetem rkp. 3.',
    lat: 47.4812,
    lng: 19.0558,
    openingHours: 'Mo-Fr 08:00-20:00',
    osmId: 'osm-bme-omikk-1',
    rooms: [
      { name: 'Nagyolvasó Study Pod 1', capacity: 4, equipment: ['whiteboard', 'power_outlets'] },
      { name: 'Kutatói Különszoba', capacity: 6, equipment: ['whiteboard', 'projector'] },
    ],
  },
  {
    name: 'ELTE University Library and Archives',
    type: 'LIBRARY',
    address: '1053 Budapest, Ferenciek tere 5.',
    lat: 47.4929,
    lng: 19.0552,
    openingHours: 'Mo-Fr 09:00-20:00',
    osmId: 'osm-elte-konyvtar-2',
    rooms: [
      { name: 'Díszterem Mezzanine', capacity: 4, equipment: ['quiet_study'] },
      { name: 'Gyakorló Szoba', capacity: 6, equipment: ['whiteboard'] },
    ],
  },
  {
    name: 'FSZEK Central Library (Wenckheim Palace)',
    type: 'LIBRARY',
    address: '1088 Budapest, Szabó Ervin tér 1.',
    lat: 47.4893,
    lng: 19.0644,
    openingHours: 'Mo-Fr 10:00-20:00, Sa 10:00-16:00',
    osmId: 'osm-fszek-kozponti-3',
    rooms: [
      { name: 'Bölcseleti Műhely', capacity: 6, equipment: ['whiteboard', 'power_outlets'] },
      { name: 'Kis Csoportszoba', capacity: 4, equipment: ['quiet_study'] },
    ],
  },
  {
    name: 'Corvinus Central Library',
    type: 'LIBRARY',
    address: '1093 Budapest, Közraktár u. 4-6.',
    lat: 47.4856,
    lng: 19.0589,
    openingHours: 'Mo-Fr 08:30-20:00',
    osmId: 'osm-corvinus-lib-4',
    rooms: [
      { name: 'C-302 Csoportszoba', capacity: 8, equipment: ['monitor', 'whiteboard'] },
      { name: 'C-304 Tárgyaló', capacity: 4, equipment: ['whiteboard'] },
    ],
  },
  {
    name: 'BME Building I (Informatics)',
    type: 'CAMPUS_ROOM',
    address: '1117 Budapest, Magyar tudósok krt. 2.',
    lat: 47.4735,
    lng: 19.0599,
    openingHours: 'Mo-Fr 07:00-21:00',
    osmId: 'osm-bme-building-i-5',
    rooms: [
      { name: 'IB 025 Szemináriumi terem', capacity: 10, equipment: ['projector', 'whiteboard'] },
      { name: 'IB 110 Hackerspace', capacity: 6, equipment: ['power_strips', 'monitor'] },
    ],
  },
  {
    name: 'BME Building Q',
    type: 'CAMPUS_ROOM',
    address: '1117 Budapest, Magyar tudósok krt. 2. Q épület',
    lat: 47.4746,
    lng: 19.0588,
    openingHours: 'Mo-Fr 07:00-21:00',
    osmId: 'osm-bme-building-q-6',
    rooms: [
      { name: 'Q-BF10 Csoportos tanuló', capacity: 6, equipment: ['whiteboard', 'power_strips'] },
      { name: 'Q-104 Konzultációs szoba', capacity: 8, equipment: ['monitor', 'whiteboard'] },
    ],
  },
  {
    name: 'ELTE Lágymányosi Campus North Block',
    type: 'CAMPUS_ROOM',
    address: '1117 Budapest, Pázmány Péter sétány 1/A',
    lat: 47.4744,
    lng: 19.0622,
    openingHours: 'Mo-Fr 07:30-20:30',
    osmId: 'osm-elte-lagymanyos-north-7',
    rooms: [
      { name: 'Északi 0.83 Matek Terem', capacity: 8, equipment: ['whiteboard'] },
      { name: 'Északi 1.71 Tanulóbox', capacity: 4, equipment: ['power_outlets'] },
    ],
  },
  {
    name: 'ELTE Lágymányosi Campus South Block',
    type: 'CAMPUS_ROOM',
    address: '1117 Budapest, Pázmány Péter sétány 1/C',
    lat: 47.4722,
    lng: 19.0617,
    openingHours: 'Mo-Fr 07:30-20:30',
    osmId: 'osm-elte-lagymanyos-south-8',
    rooms: [
      { name: 'Déli 0-823 Infó Labor', capacity: 10, equipment: ['projector', 'workstations'] },
      { name: 'Déli 2-401 Csoportszoba', capacity: 6, equipment: ['whiteboard', 'monitor'] },
    ],
  },
  {
    name: 'National Széchényi Library (OSZK)',
    type: 'LIBRARY',
    address: '1014 Budapest, Szent György tér 2. (Buda Castle)',
    lat: 47.4962,
    lng: 19.0398,
    openingHours: 'Tu-Sa 09:00-19:00',
    osmId: 'osm-oszk-buda-castle-9',
    rooms: [
      { name: 'Kutatóterem Csendes Sarok', capacity: 4, equipment: ['quiet_study'] },
    ],
  },
  {
    name: 'CEU Library Budapest',
    type: 'LIBRARY',
    address: '1051 Budapest, Nádor u. 15.',
    lat: 47.5011,
    lng: 19.0494,
    openingHours: 'Mo-Fr 09:00-19:00',
    osmId: 'osm-ceu-library-10',
    rooms: [
      { name: 'Group Study Room 301', capacity: 6, equipment: ['monitor', 'whiteboard'] },
      { name: 'Collaboration Lab', capacity: 8, equipment: ['projector', 'whiteboard'] },
    ],
  },
  {
    name: 'Semmelweis Central Library',
    type: 'LIBRARY',
    address: '1088 Budapest, Mikszáth Kálmán tér 5.',
    lat: 47.4898,
    lng: 19.0662,
    openingHours: 'Mo-Fr 08:00-20:00',
    osmId: 'osm-semmelweis-lib-11',
    rooms: [
      { name: 'Anatómia Műhely', capacity: 6, equipment: ['whiteboard'] },
    ],
  },
  {
    name: 'BME Building K (Main Campus)',
    type: 'CAMPUS_ROOM',
    address: '1111 Budapest, Műegyetem rkp. 3. K épület',
    lat: 47.4815,
    lng: 19.0551,
    openingHours: 'Mo-Fr 07:00-20:00',
    osmId: 'osm-bme-building-k-12',
    rooms: [
      { name: 'K.I.50 Aula Tanulótér', capacity: 8, equipment: ['whiteboard', 'power_strips'] },
    ],
  },
  {
    name: 'Magvető Café',
    type: 'CAFE',
    address: '1074 Budapest, Dohány u. 13.',
    lat: 47.4965,
    lng: 19.0618,
    openingHours: 'Mo-Sa 09:00-21:00',
    osmId: 'osm-magveto-cafe-13',
    rooms: [
      { name: 'Irodalmi Galéria Asztal', capacity: 4, equipment: ['power_strips'] },
    ],
  },
  {
    name: 'Mon Chéri Coffee Shop',
    type: 'CAFE',
    address: '1052 Budapest, Károly krt. 12.',
    lat: 47.4947,
    lng: 19.0589,
    openingHours: 'Mo-Su 07:00-23:00',
    osmId: 'osm-mon-cheri-14',
    rooms: [
      { name: 'Study Mezzanine Table 1', capacity: 4, equipment: ['power_strips'] },
      { name: 'Study Mezzanine Table 2', capacity: 4, equipment: ['power_strips'] },
    ],
  },
  {
    name: 'Madal Cafe Ferenciek tere',
    type: 'CAFE',
    address: '1053 Budapest, Ferenciek tere 3.',
    lat: 47.4927,
    lng: 19.0549,
    openingHours: 'Mo-Fr 07:30-19:00, Sa-Su 08:30-19:00',
    osmId: 'osm-madal-ferenciek-15',
    rooms: [
      { name: 'Közösségi Asztal', capacity: 6, equipment: ['power_strips'] },
    ],
  },
  {
    name: 'Madal Cafe Hollán Ernő',
    type: 'CAFE',
    address: '1136 Budapest, Hollán Ernő u. 3.',
    lat: 47.5144,
    lng: 19.0505,
    openingHours: 'Mo-Fr 07:30-19:00, Sa-Su 08:30-19:00',
    osmId: 'osm-madal-hollan-16',
    rooms: [
      { name: 'Galéria Tanulósarok', capacity: 4, equipment: ['power_strips'] },
    ],
  },
  {
    name: 'Espresso Embassy',
    type: 'CAFE',
    address: '1051 Budapest, Arany János u. 15.',
    lat: 47.5015,
    lng: 19.0507,
    openingHours: 'Mo-Fr 07:30-18:00, Sa 09:00-17:00',
    osmId: 'osm-espresso-embassy-17',
    rooms: [
      { name: 'Boltozatos Kisterem', capacity: 4, equipment: ['power_outlets'] },
    ],
  },
  {
    name: 'Kelet Kávézó és Galéria',
    type: 'CAFE',
    address: '1114 Budapest, Bartók Béla út 29.',
    lat: 47.4789,
    lng: 19.0487,
    openingHours: 'Mo-Fr 07:30-22:00, Sa-Su 09:00-22:00',
    osmId: 'osm-kelet-kavezo-18',
    rooms: [
      { name: 'Könyves Különszoba', capacity: 4, equipment: ['power_outlets'] },
    ],
  },
  {
    name: 'Kaptár Coworking',
    type: 'COWORKING',
    address: '1065 Budapest, Révay köz 4.',
    lat: 47.5009,
    lng: 19.0567,
    openingHours: 'Mo-Fr 08:00-20:00',
    osmId: 'osm-kaptar-coworking-19',
    rooms: [
      { name: 'Hive Meeting Room', capacity: 6, equipment: ['projector', 'whiteboard', 'video_conf'] },
      { name: 'Focus Box', capacity: 2, equipment: ['quiet_study', 'monitor'] },
    ],
  },
  {
    name: 'Impact Hub Budapest',
    type: 'COWORKING',
    address: '1053 Budapest, Ferenciek tere 2.',
    lat: 47.4931,
    lng: 19.0558,
    openingHours: 'Mo-Fr 09:00-18:00',
    osmId: 'osm-impact-hub-20',
    rooms: [
      { name: 'Innovation Pod', capacity: 6, equipment: ['whiteboard', 'monitor'] },
      { name: 'Workshop Room', capacity: 12, equipment: ['projector', 'whiteboard'] },
    ],
  },
  {
    name: 'Urban Lobby Coworking',
    type: 'COWORKING',
    address: '1061 Budapest, Paulay Ede u. 3.',
    lat: 47.4988,
    lng: 19.0573,
    openingHours: 'Mo-Su 00:00-24:00',
    osmId: 'osm-urban-lobby-21',
    rooms: [
      { name: 'Sprint Pod A', capacity: 4, equipment: ['monitor', 'whiteboard'] },
      { name: 'Sprint Pod B', capacity: 4, equipment: ['monitor', 'whiteboard'] },
    ],
  },
  {
    name: 'Kubik Coworking',
    type: 'COWORKING',
    address: '1137 Budapest, Jászai Mari tér 5-6.',
    lat: 47.5140,
    lng: 19.0478,
    openingHours: 'Mo-Fr 08:30-18:30',
    osmId: 'osm-kubik-coworking-22',
    rooms: [
      { name: 'Duna Tárgyaló', capacity: 8, equipment: ['projector', 'whiteboard'] },
      { name: 'Margit Csoportszoba', capacity: 4, equipment: ['whiteboard'] },
    ],
  },
  {
    name: 'Massolit Books & Café',
    type: 'CAFE',
    address: '1072 Budapest, Nagy Diófa u. 30.',
    lat: 47.4972,
    lng: 19.0664,
    openingHours: 'Mo-Fr 08:30-19:00, Sa-Su 10:00-19:00',
    osmId: 'osm-massolit-cafe-23',
    rooms: [
      { name: 'Kerthelyiség Tanulósarok', capacity: 4, equipment: ['power_strips'] },
    ],
  },
  {
    name: 'Flow Specialty Coffee Bar and Bistro',
    type: 'CAFE',
    address: '1062 Budapest, Andrássy út 66.',
    lat: 47.5074,
    lng: 19.0652,
    openingHours: 'Mo-Fr 07:30-17:30, Sa-Su 08:30-17:00',
    osmId: 'osm-flow-coffee-24',
    rooms: [
      { name: 'Belső Galéria', capacity: 6, equipment: ['power_outlets'] },
    ],
  },
  {
    name: 'Lumen Kávézó',
    type: 'CAFE',
    address: '1085 Budapest, Horánszky u. 5.',
    lat: 47.4912,
    lng: 19.0673,
    openingHours: 'Mo-Su 08:00-23:00',
    osmId: 'osm-lumen-kavezo-25',
    rooms: [
      { name: 'Palotanegyed Különterem', capacity: 8, equipment: ['whiteboard'] },
    ],
  },
];

const PERIODS = [
  { startHour: 8, startMin: 15, endHour: 10, endMin: 0 },
  { startHour: 10, startMin: 15, endHour: 12, endMin: 0 },
  { startHour: 12, startMin: 15, endHour: 14, endMin: 0 },
  { startHour: 14, startMin: 15, endHour: 16, endMin: 0 },
  { startHour: 16, startMin: 15, endHour: 18, endMin: 0 },
];

const CAMPUS_ROOMS = ['IB 028', 'IB 025', 'Q-BF10', 'Q-II', 'Északi 0.83', 'Déli 0-823', 'K.I.50', 'I.E.224'];

/*
 * Test-account schedules are similar but never identical: everyone taking a subject shares its lectures but
 * sits in one of several practice groups, people keep different study hours, and some have a job or a hobby.
 * All slots below are distinct, so any combination of groups is clash-free.
 */
type Slot = { weekday: number; period: number };
const COURSES: Record<string, { name: string; room: string; lectures: Slot[]; practices: Slot[] }> = {
  'BME-CALC1': {
    name: 'Calculus 1',
    room: 'K.I.50',
    lectures: [{ weekday: 1, period: 0 }, { weekday: 3, period: 1 }],
    practices: [{ weekday: 2, period: 2 }, { weekday: 4, period: 0 }, { weekday: 5, period: 1 }, { weekday: 2, period: 4 }],
  },
  'BME-ITC1': {
    name: 'Introduction to Theory of Computing',
    room: 'I.E.224',
    lectures: [{ weekday: 2, period: 0 }],
    practices: [{ weekday: 3, period: 2 }, { weekday: 4, period: 3 }, { weekday: 1, period: 3 }],
  },
  'BME-DIGIT1': {
    name: 'Digital Design',
    room: 'IB 025',
    lectures: [{ weekday: 4, period: 1 }],
    practices: [{ weekday: 1, period: 2 }, { weekday: 3, period: 3 }, { weekday: 5, period: 0 }],
  },
  'BME-EE1': {
    name: 'Basics of Electrical Engineering',
    room: 'Déli 0-823',
    lectures: [{ weekday: 3, period: 0 }],
    practices: [{ weekday: 4, period: 2 }, { weekday: 1, period: 4 }, { weekday: 5, period: 2 }],
  },
  'BME-PROG1': {
    name: 'Basics of Programming',
    room: 'IB 028',
    lectures: [{ weekday: 1, period: 1 }],
    practices: [{ weekday: 2, period: 3 }, { weekday: 3, period: 4 }, { weekday: 5, period: 3 }, { weekday: 4, period: 4 }],
  },
  'BME-PHYS1': {
    name: 'Basics of Physics',
    room: 'K.I.50',
    lectures: [{ weekday: 4, period: 2 }],
    practices: [{ weekday: 4, period: 3 }, { weekday: 2, period: 1 }, { weekday: 5, period: 1 }],
  },
  'BME-SEM1': {
    name: 'Study Group Seminar 1',
    room: 'IB 110',
    lectures: [],
    practices: [{ weekday: 2, period: 2 }, { weekday: 3, period: 3 }, { weekday: 5, period: 2 }],
  },
  'BME-HUN1': {
    name: 'Hungarian Language and Culture 1',
    room: 'Északi 0.83',
    lectures: [],
    practices: [{ weekday: 2, period: 3 }, { weekday: 4, period: 3 }],
  },
};

type Window = { weekday: number; startTime: string; endTime: string };
const days = (weekdays: number[], startTime: string, endTime: string): Window[] => weekdays.map((weekday) => ({ weekday, startTime, endTime }));
const STUDY_HOURS: Window[][] = [
  days([1, 2, 3, 4, 5], '08:00', '20:00'), // the app default
  days([1, 2, 3, 4, 5], '07:30', '17:00'), // early bird
  [...days([1, 2, 3, 4, 5], '12:00', '21:00'), ...days([6], '10:00', '14:00')], // late riser
  [...days([1, 2, 3, 4], '15:00', '20:00'), ...days([6, 7], '10:00', '18:00')], // mostly weekends
  days([1, 2, 4], '09:00', '18:00'), // three long days
  [...days([1, 2, 3, 4, 5], '16:00', '21:00'), ...days([7], '12:00', '18:00')], // evenings
];

const COMMITMENTS: { title: string; category: 'WORK' | 'OTHER'; slots: [weekday: number, start: string, end: string][] }[] = [
  { title: 'Part-time job', category: 'WORK', slots: [[2, '16:00', '20:00'], [4, '16:00', '20:00']] },
  { title: 'Weekend shift at the café', category: 'WORK', slots: [[6, '09:00', '15:00']] },
  { title: 'Tutoring', category: 'WORK', slots: [[3, '14:00', '16:00']] },
  { title: 'Football training', category: 'OTHER', slots: [[1, '18:00', '19:30'], [3, '18:00', '19:30']] },
  { title: 'Gym', category: 'OTHER', slots: [[5, '17:00', '18:30']] },
  { title: 'Choir rehearsal', category: 'OTHER', slots: [[2, '19:00', '21:00']] },
];

/** Deterministic random numbers in [0, 1) per account (mulberry32), so re-seeding gives the same schedules. */
function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickFrom = <T>(random: () => number, items: readonly T[]): T => items[Math.floor(random() * items.length)];

export async function seedIntegrations(
  prisma: PrismaClient,
  core?: CoreSeedResult,
): Promise<void> {
  // 1. Clean previous integration seed data safely
  await prisma.studySession.updateMany({
    data: {
      bookingId: null,
      locationId: null,
    },
  });
  await prisma.booking.deleteMany();
  await prisma.room.deleteMany();
  await prisma.location.deleteMany();
  // test accounts only: real users keep their Neptun calendar, link and study hours across re-seeds
  await prisma.neptunConnection.deleteMany({ where: { user: { isSeed: true } } });

  // 2. Seed 25 Budapest Locations with Rooms
  for (const loc of BUDAPEST_LOCATIONS) {
    await prisma.location.create({
      data: {
        name: loc.name,
        type: loc.type,
        address: loc.address,
        lat: loc.lat,
        lng: loc.lng,
        openingHours: loc.openingHours,
        osmId: loc.osmId,
        rooms: {
          create: loc.rooms.map((r) => ({
            name: r.name,
            capacity: r.capacity,
            equipment: r.equipment,
            provider: r.provider ?? 'MOCK',
          })),
        },
      },
    });
  }

  // 3. Resolve seed users
  let targetUserIds = core?.userIds;
  if (!targetUserIds || targetUserIds.length === 0) {
    // standalone run: test accounts only, never real users
    const users = await prisma.user.findMany({ where: { isSeed: true }, select: { id: true }, orderBy: { createdAt: 'asc' } });
    targetUserIds = users.map((u) => u.id);
  }

  if (targetUserIds.length === 0) {
    return;
  }


  // 4. Connect Neptun for all seed users
  const neptunConnections = targetUserIds.map((userId) => ({
    userId,
    status: 'OK' as const,
    lastSyncedAt: new Date(),
    icsUrlEncrypted: 'seed-encrypted-neptun-url',
  }));

  for (let i = 0; i < neptunConnections.length; i += 500) {
    await prisma.neptunConnection.createMany({
      data: neptunConnections.slice(i, i + 500),
      skipDuplicates: true,
    });
  }

  // 5. Study hours and timetables (classes, jobs, hobbies)
  await seedSchedules(prisma, targetUserIds);
}

/**
 * Study hours and calendars (classes, jobs, hobbies) for the given test accounts, replacing what they had.
 * Also runs on its own to refresh schedules without resetting groups, swipes or matches.
 */
export async function seedSchedules(prisma: PrismaClient, targetUserIds: string[]): Promise<void> {
  await prisma.calendarEvent.deleteMany({ where: { source: { in: ['NEPTUN', 'MANUAL'] }, userId: { in: targetUserIds } } });
  await prisma.availabilityWindow.deleteMany({ where: { userId: { in: targetUserIds } } });

  const demoUser = await prisma.user.findUnique({
    where: { email: 'demo@sgm.local' },
    select: { id: true },
  });

  // Study hours: the demo keeps the app default (Mon–Fri 08:00–20:00); everyone else gets one of the
  // patterns, sometimes with a day off
  const windows = targetUserIds.flatMap((userId, userIdx) => {
    if (userId === demoUser?.id) return STUDY_HOURS[0].map((w) => ({ userId, ...w }));
    const random = seededRandom(1000 + userIdx);
    let pattern = pickFrom(random, STUDY_HOURS);
    const weekdays = [...new Set(pattern.map((w) => w.weekday))];
    if (weekdays.length > 3 && random() < 0.3) {
      const dayOff = pickFrom(random, weekdays);
      pattern = pattern.filter((w) => w.weekday !== dayOff);
    }
    return pattern.map((w) => ({ userId, ...w }));
  });

  for (let i = 0; i < windows.length; i += 1000) {
    await prisma.availabilityWindow.createMany({
      data: windows.slice(i, i + 1000),
    });
  }

  // Fetch user subjects to link realistic classes
  const userSubjects = await prisma.userSubject.findMany({
    where: { userId: { in: targetUserIds } },
    include: { subject: true },
  });

  const userSubjectMap = new Map<string, string[]>();
  for (const us of userSubjects) {
    userSubjectMap.set(us.userId, [...(userSubjectMap.get(us.userId) ?? []), us.subject.code]);
  }

  const nowBudapest = DateTime.now().setZone('Europe/Budapest');
  const startOfCurrentWeek = nowBudapest.startOf('week'); // Monday
  const at = (week: number, weekday: number, hour: number, minute: number) =>
    startOfCurrentWeek.plus({ weeks: week, days: weekday - 1 }).set({ hour, minute, second: 0, millisecond: 0 });
  const hm = (time: string) => time.split(':').map(Number) as [number, number];

  const calendarEvents: Prisma.CalendarEventCreateManyInput[] = [];

  // 8 weeks of classes (+ jobs / hobbies) per test account
  for (let userIdx = 0; userIdx < targetUserIds.length; userIdx++) {
    const userId = targetUserIds[userIdx];
    const isDemo = userId === demoUser?.id;
    const random = seededRandom(5000 + userIdx);

    // every subject's lectures + one of its practice groups (the demo is always in the first group)
    const classes = (userSubjectMap.get(userId) ?? [])
      .filter((code) => COURSES[code])
      .flatMap((code) => {
        const course = COURSES[code];
        const practice = isDemo ? course.practices[0] : pickFrom(random, course.practices);
        return [
          ...course.lectures.map((slot) => ({ code, slot, kind: 'Lecture', room: course.room })),
          { code, slot: practice, kind: 'Practice', room: pickFrom(random, CAMPUS_ROOMS) },
        ];
      });
    // jobs and hobbies: about half the accounts have one, some two (none for the demo, to keep it predictable),
    // never on top of their own classes
    const minutes = (h: number, m: number) => h * 60 + m;
    const clashes = ([weekday, from, to]: [number, string, string]) =>
      classes.some(({ slot }) => {
        const p = PERIODS[slot.period];
        return slot.weekday === weekday && minutes(...hm(from)) < minutes(p.endHour, p.endMin) && minutes(p.startHour, p.startMin) < minutes(...hm(to));
      });
    const commitments = isDemo ? [] : COMMITMENTS.filter((c) => random() < 0.12 && !c.slots.some(clashes));

    for (let week = 0; week < 8; week++) {
      for (const cls of classes) {
        const period = PERIODS[cls.slot.period];
        const start = at(week, cls.slot.weekday, period.startHour, period.startMin);
        calendarEvents.push({
          userId,
          title: `${COURSES[cls.code].name} (${cls.code}) - ${cls.kind}`,
          start: start.toJSDate(),
          end: start.set({ hour: period.endHour, minute: period.endMin }).toJSDate(),
          room: cls.room,
          subjectCode: cls.code,
          source: 'NEPTUN',
          externalUid: `neptun-${userId}-${cls.code}-${cls.kind}-w${week}-d${cls.slot.weekday}`,
        });
      }
      for (const c of commitments) {
        for (const [weekday, from, to] of c.slots) {
          calendarEvents.push({
            userId,
            title: c.title,
            start: at(week, weekday, ...hm(from)).toJSDate(),
            end: at(week, weekday, ...hm(to)).toJSDate(),
            source: 'MANUAL',
            category: c.category,
          });
        }
      }
    }
  }

  // Insert calendar events in chunks
  for (let i = 0; i < calendarEvents.length; i += 1000) {
    await prisma.calendarEvent.createMany({
      data: calendarEvents.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
}

// Standalone execution support
if (process.argv[1] && process.argv[1].includes('integrations.seed')) {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  seedIntegrations(prisma)
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
