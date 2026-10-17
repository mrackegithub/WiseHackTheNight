import type { Schemas } from '@sgm/contracts';
import { defaultWindows, sampleTimetable, type TimetableEntry } from './calendar';
import { interests } from './data/interests';
import { people } from './data/people';
import { subjectById, subjects as subjectCatalogue } from './data/subjects';
import type { MockGroup } from './groups';

export interface MockSwipe {
  targetKind: 'user' | 'group';
  targetId: string;
  subjectId: string;
  direction: 'LIKE' | 'PASS';
  at: string;
}

/**
 * In-memory "backend" for MSW. Shapes come from the contract (`Schemas[...]`), so a contract
 * change that breaks the mocks fails `pnpm typecheck`. `resetDb()` restores the seed (tests call it).
 */
export interface MockUser {
  me: Schemas['Me'];
  password: string;
  subjects: Schemas['UserSubject'][];
  /** null until PUT /me/preferences was called (GET returns the defaults meanwhile). */
  preferences: Schemas['Preferences'] | null;
  calendar: {
    neptun: Schemas['NeptunConnection'];
    /** The (mock-)encrypted feed URL; null when connected via file upload or not at all. */
    icsUrl: string | null;
    /** Recurring classes imported from Neptun; expanded per requested range. */
    timetable: TimetableEntry[];
    windows: Schemas['WeeklyWindow'][];
    /** Busy blocks the user added by hand (source MANUAL). */
    manualEvents: Schemas['CalendarEvent'][];
    /** Neptun class occurrences the user removed from their calendar. */
    removedClassIds?: string[];
  };
  swipes: MockSwipe[];
  matches: Schemas['Match'][];
}

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
export const DEMO_EMAIL = 'demo@sgm.local';
export const DEMO_PASSWORD = 'password123';

/** Contract defaults for Preferences. */
export const defaultPreferences = (): Schemas['Preferences'] => ({
  groupSizeMin: 2,
  groupSizeMax: 4,
  maxDistanceKm: 5,
  sessionLengthMinutes: 90,
  locationTypes: [],
  mode: 'EITHER',
});

/** Bump when the shape below changes, so stale browser-saved mock data is discarded instead of crashing. */
const DB_VERSION = 10;

const userSubject = (subjectId: string, role: Schemas['RoleTag'], confidence = 3): Schemas['UserSubject'] => ({
  subject: subjectById(subjectId)!,
  role,
  confidence,
});

export function newMockUser(me: Schemas['Me'], password: string): MockUser {
  return {
    me,
    password,
    subjects: [],
    preferences: null,
    calendar: {
      neptun: { connected: false, status: 'NOT_CONNECTED', lastSyncedAt: null, lastError: null, eventCount: 0 },
      icsUrl: null,
      timetable: [],
      windows: defaultWindows(),
      manualEvents: [],
    },
    swipes: [],
    matches: [],
  };
}

/** Open groups to discover (one full), plus one the demo user already belongs to. */
function seedGroups(): Map<string, MockGroup> {
  const [algo, db, ana] = [subjectCatalogue[0].id, subjectCatalogue[8].id, subjectCatalogue[15].id];
  const p = (i: number) => people[i].user.id;
  const member = (userId: string, role: Schemas['RoleTag'], isOwner = false) => ({ userId, role, isOwner, joinedAt: '2026-10-01T10:00:00Z' });
  const session = (id: string, groupId: string, start: string, end: string, status: Schemas['StudySession']['status'], onlineUrl: string | null): Schemas['StudySession'] => ({ id, groupId, start, end, status, location: null, onlineUrl, bookingId: null });
  const groups: MockGroup[] = [
    { id: '00000000-0000-4000-8005-000000000001', name: 'Algo Night Owls', description: 'Late-evening problem sets, mostly graph algorithms.', subjectId: algo, maxSize: 4, isOpen: true, members: [member(p(6), 'NEEDS_HELP', true), member(p(1), 'CAN_EXPLAIN')], sessions: [session('00000000-0000-4000-8006-000000000001', '00000000-0000-4000-8005-000000000001', '2026-10-20T17:00:00Z', '2026-10-20T18:30:00Z', 'PLANNED', 'https://meet.example.com/algo-night-owls')] },
    { id: '00000000-0000-4000-8005-000000000002', name: 'Analysis I survivors', description: 'Weekly practice sheet walkthroughs.', subjectId: ana, maxSize: 5, isOpen: true, members: [member(p(2), 'CAN_EXPLAIN', true), member(p(4), 'NEEDS_HELP'), member(p(13), 'NEEDS_HELP')], sessions: [] },
    { id: '00000000-0000-4000-8005-000000000003', name: 'SQL Squad', description: null, subjectId: db, maxSize: 3, isOpen: true, members: [member(p(3), 'CAN_EXPLAIN', true), member(p(10), 'CAN_EXPLAIN'), member(p(8), 'PEER')], sessions: [] },
    { id: '00000000-0000-4000-8005-000000000004', name: 'DB Thursday crew', description: 'We meet after the Thursday lecture.', subjectId: db, maxSize: 4, isOpen: true, members: [member(DEMO_USER_ID, 'PEER', true), member(p(11), 'PEER')], sessions: [
      session('00000000-0000-4000-8006-000000000002', '00000000-0000-4000-8005-000000000004', '2026-10-08T16:00:00Z', '2026-10-08T17:30:00Z', 'DONE', null),
      session('00000000-0000-4000-8006-000000000003', '00000000-0000-4000-8005-000000000004', '2026-10-22T16:00:00Z', '2026-10-22T17:30:00Z', 'PLANNED', null),
    ] },
  ];
  return new Map(groups.map((g) => [g.id, g]));
}

/**
 * Server-side rule for Me.onboardingComplete, as proposed in docs/handoffs/fe-to-be-onboarding-complete.md:
 * ≥1 subject, preferences saved, and a home location unless studying online only. Once true it stays true.
 */
export function updateOnboarding(user: MockUser) {
  if (user.me.onboardingComplete) return;
  const p = user.preferences;
  user.me.onboardingComplete = user.subjects.length > 0 && p !== null && (user.me.location != null || p.mode === 'ONLINE');
}

function seed() {
  const demo: MockUser = {
    ...newMockUser(
      {
        id: DEMO_USER_ID,
        email: DEMO_EMAIL,
        displayName: 'Demo Student',
        bio: 'Second-year CS student, happy to explain recursion.',
        avatarUrl: null,
        university: 'ELTE',
        faculty: 'Faculty of Informatics',
        location: { lat: 47.473, lng: 19.062, label: 'Lágymányos' },
        interests: [interests[0], interests[3], interests[22]],
        onboardingComplete: true,
        createdAt: '2026-09-01T08:00:00Z',
      },
      DEMO_PASSWORD,
    ),
    subjects: [
      userSubject('00000000-0000-4000-8001-000000000001', 'CAN_EXPLAIN', 4),
      userSubject('00000000-0000-4000-8001-000000000016', 'NEEDS_HELP', 2),
      userSubject('00000000-0000-4000-8001-000000000009', 'PEER'),
    ],
    preferences: { ...defaultPreferences(), groupSizeMax: 3, maxDistanceKm: 4, locationTypes: ['LIBRARY', 'CAFE'], mode: 'IN_PERSON' },
  };
  demo.calendar = {
    neptun: { connected: true, status: 'OK', lastSyncedAt: '2026-10-15T06:00:00Z', lastError: null, eventCount: 112 },
    icsUrl: 'webcal://neptun.example.edu/calendar/demo.ics',
    timetable: sampleTimetable,
    windows: defaultWindows(),
    manualEvents: [],
  };

  return {
    users: new Map<string, MockUser>([[demo.me.id, demo]]),
    groups: seedGroups(),
    bookings: new Map<string, Schemas['Booking']>(),
    /** invite token -> the group it lets people into */
    invites: new Map<string, { groupId: string; createdById: string; expiresAt: string }>(),
    /** token -> userId */
    accessTokens: new Map<string, string>(),
    refreshTokens: new Map<string, string>(),
  };
}

export let db = seed();

export function resetDb() {
  db = seed();
  tokenCounter = 0;
}

let tokenCounter = 0;

export function issueTokens(userId: string): Schemas['AuthTokens'] {
  tokenCounter += 1;
  const accessToken = `mock-access-${tokenCounter}`;
  const refreshToken = `mock-refresh-${tokenCounter}`;
  db.accessTokens.set(accessToken, userId);
  db.refreshTokens.set(refreshToken, userId);
  return { accessToken, refreshToken, expiresIn: 900 };
}

export function findUserByEmail(email: string) {
  const needle = email.trim().toLowerCase();
  return [...db.users.values()].find((u) => u.me.email.toLowerCase() === needle);
}

let idCounter = 1000;
/** Deterministic UUID v4-shaped ids for created mock entities. */
export function nextId() {
  idCounter += 1;
  return `00000000-0000-4000-8000-${idCounter.toString().padStart(12, '0')}`;
}

// ── Browser persistence: keeps mock logins/edits across page reloads (not used in tests) ──
const STORAGE_KEY = 'sgm.mockdb';
const replacer = (_key: string, value: unknown) => (value instanceof Map ? { __map: [...value] } : value);
const reviver = (_key: string, value: unknown) =>
  value && typeof value === 'object' && '__map' in value ? new Map((value as { __map: [unknown, unknown][] }).__map) : value;

export function saveDb() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: DB_VERSION, db, tokenCounter, idCounter }, replacer));
  } catch {
    // storage full or unavailable: mocks just won't survive a reload
  }
}

export function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw, reviver) as { version?: number; db: ReturnType<typeof seed>; tokenCounter: number; idCounter: number };
    if (saved.version !== DB_VERSION) return; // older shape: start from the seed
    db = saved.db;
    tokenCounter = saved.tokenCounter;
    idCounter = saved.idCounter;
  } catch {
    db = seed();
  }
}

/** Wipes persisted mock data. Run `localStorage.removeItem('sgm.mockdb')` in the console for the same effect. */
export function clearSavedDb() {
  localStorage.removeItem(STORAGE_KEY);
  resetDb();
}
