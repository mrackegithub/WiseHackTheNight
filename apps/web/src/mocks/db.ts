import type { Schemas } from '@sgm/contracts';

/**
 * In-memory "backend" for MSW. Shapes come from the contract (`Schemas[...]`), so a contract
 * change that breaks the mocks fails `pnpm typecheck`. `resetDb()` restores the seed (tests call it).
 */
export interface MockUser {
  me: Schemas['Me'];
  password: string;
}

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
export const DEMO_EMAIL = 'demo@sgm.local';
export const DEMO_PASSWORD = 'password123';

function seed() {
  const demo: MockUser = {
    password: DEMO_PASSWORD,
    me: {
      id: DEMO_USER_ID,
      email: DEMO_EMAIL,
      displayName: 'Demo Student',
      bio: 'Second-year CS student, happy to explain recursion.',
      avatarUrl: null,
      university: 'ELTE',
      faculty: 'Faculty of Informatics',
      location: { lat: 47.473, lng: 19.062, label: 'Lágymányos' },
      interests: [],
      onboardingComplete: true,
      createdAt: '2026-09-01T08:00:00Z',
    },
  };

  return {
    users: new Map<string, MockUser>([[demo.me.id, demo]]),
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
