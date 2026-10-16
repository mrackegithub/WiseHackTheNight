// OWNER: Agent C — Ticket C7: Integration Seed.
import type { PrismaClient, LocationType } from '@prisma/client';
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
  await prisma.calendarEvent.deleteMany({ where: { source: 'NEPTUN' } });
  await prisma.availabilityWindow.deleteMany();
  await prisma.neptunConnection.deleteMany();

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
    const users = await prisma.user.findMany({ select: { id: true } });
    targetUserIds = users.map((u) => u.id);
  }

  if (targetUserIds.length === 0) {
    return;
  }

  // 4. Default Availability Windows for every seed user (Mon-Fri 08:00 - 20:00)
  const defaultWindows = targetUserIds.flatMap((userId) =>
    [1, 2, 3, 4, 5].map((weekday) => ({
      userId,
      weekday,
      startTime: '08:00',
      endTime: '20:00',
    })),
  );

  for (let i = 0; i < defaultWindows.length; i += 1000) {
    await prisma.availabilityWindow.createMany({
      data: defaultWindows.slice(i, i + 1000),
    });
  }

  // 5. Connect Neptun for all seed users
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

  // 6. Seed Neptun Timetables
  // Fetch user subjects to link realistic classes
  const userSubjects = await prisma.userSubject.findMany({
    where: { userId: { in: targetUserIds } },
    include: { subject: true },
  });

  const userSubjectMap = new Map<string, Array<{ code: string; name: string }>>();
  for (const us of userSubjects) {
    const list = userSubjectMap.get(us.userId) ?? [];
    list.push({ code: us.subject.code, name: us.subject.name });
    userSubjectMap.set(us.userId, list);
  }

  const demoUser = await prisma.user.findUnique({
    where: { email: 'demo@sgm.local' },
    select: { id: true },
  });

  const nowBudapest = DateTime.now().setZone('Europe/Budapest');
  const startOfCurrentWeek = nowBudapest.startOf('week'); // Monday

  const calendarEvents: Array<{
    userId: string;
    title: string;
    start: Date;
    end: Date;
    room: string;
    subjectCode: string;
    source: 'NEPTUN';
    externalUid: string;
  }> = [];

  // Generate 8 weeks of timetable classes for each user
  for (let userIdx = 0; userIdx < targetUserIds.length; userIdx++) {
    const userId = targetUserIds[userIdx];
    const isDemo = demoUser && userId === demoUser.id;
    const subjects = userSubjectMap.get(userId) ?? [];

    if (isDemo) {
      // Demo schedule: predictable, leaving afternoons and Friday open
      const demoClasses = [
        { weekday: 1, periodIdx: 1, code: 'IP-18AA1E', name: 'Algorithms and Data Structures I', room: 'IB 028' },
        { weekday: 2, periodIdx: 0, code: 'BMETE90AX00', name: 'Calculus I', room: 'Q-II' },
        { weekday: 3, periodIdx: 3, code: 'IP-18DB1E', name: 'Database Systems I', room: 'I.E.224' },
        { weekday: 4, periodIdx: 1, code: 'BMETE90AX00', name: 'Calculus I', room: 'K.I.50' },
      ];

      for (let week = 0; week < 8; week++) {
        for (const cls of demoClasses) {
          const period = PERIODS[cls.periodIdx];
          const classStart = startOfCurrentWeek
            .plus({ weeks: week, days: cls.weekday - 1 })
            .set({ hour: period.startHour, minute: period.startMin, second: 0, millisecond: 0 });
          const classEnd = classStart.set({ hour: period.endHour, minute: period.endMin });

          calendarEvents.push({
            userId,
            title: `${cls.name} (${cls.code}) - Lecture`,
            start: classStart.toJSDate(),
            end: classEnd.toJSDate(),
            room: cls.room,
            subjectCode: cls.code,
            source: 'NEPTUN',
            externalUid: `neptun-${userId}-${cls.code}-w${week}-d${cls.weekday}`,
          });
        }
      }
    } else {
      // Seed regular student timetable based on their enrolled subjects (up to 3 classes)
      const classesToSchedule = subjects.slice(0, 3);
      for (let sIdx = 0; sIdx < classesToSchedule.length; sIdx++) {
        const subj = classesToSchedule[sIdx];
        const weekday = ((userIdx + sIdx * 2) % 4) + 1; // Mon - Thu
        const periodIdx = (userIdx + sIdx) % PERIODS.length;
        const period = PERIODS[periodIdx];
        const room = CAMPUS_ROOMS[(userIdx + sIdx) % CAMPUS_ROOMS.length];

        for (let week = 0; week < 8; week++) {
          const classStart = startOfCurrentWeek
            .plus({ weeks: week, days: weekday - 1 })
            .set({ hour: period.startHour, minute: period.startMin, second: 0, millisecond: 0 });
          const classEnd = classStart.set({ hour: period.endHour, minute: period.endMin });

          calendarEvents.push({
            userId,
            title: `${subj.name} (${subj.code})`,
            start: classStart.toJSDate(),
            end: classEnd.toJSDate(),
            room,
            subjectCode: subj.code,
            source: 'NEPTUN',
            externalUid: `neptun-${userId}-${subj.code}-w${week}-d${weekday}`,
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
