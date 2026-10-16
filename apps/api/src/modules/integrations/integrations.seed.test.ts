import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { seedCore } from '../../../prisma/seed/core.seed.js';
import { seedIntegrations } from '../../../prisma/seed/integrations.seed.js';

describe('C7: Integration Seed', () => {
  const prisma = new PrismaClient();

  beforeAll(async () => {
    // Seed core first (if not already seeded)
    const core = await seedCore(prisma);
    // Seed integrations
    await seedIntegrations(prisma, core);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates exactly 25 Budapest locations', async () => {
    const count = await prisma.location.count();
    expect(count).toBe(25);
  });

  it('creates rooms for all locations with MOCK provider', async () => {
    const locationsWithRooms = await prisma.location.findMany({
      include: { rooms: true },
    });

    expect(locationsWithRooms.length).toBe(25);
    for (const loc of locationsWithRooms) {
      expect(loc.rooms.length).toBeGreaterThanOrEqual(1);
      for (const room of loc.rooms) {
        expect(room.provider).toBe('MOCK');
        expect(room.capacity).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('seeds default availability windows for seed users', async () => {
    const windows = await prisma.availabilityWindow.findMany({
      take: 10,
    });
    expect(windows.length).toBeGreaterThan(0);

    const demoUser = await prisma.user.findUnique({
      where: { email: 'demo@sgm.local' },
      include: { availabilityWindows: true },
    });

    expect(demoUser).toBeDefined();
    expect(demoUser?.availabilityWindows.length).toBe(5); // Mon - Fri
    const weekdays = demoUser?.availabilityWindows.map((w) => w.weekday).sort();
    expect(weekdays).toEqual([1, 2, 3, 4, 5]);

    for (const w of demoUser!.availabilityWindows) {
      expect(w.startTime).toBe('08:00');
      expect(w.endTime).toBe('20:00');
    }
  });

  it('connects Neptun for seed users with status OK', async () => {
    const demoUser = await prisma.user.findUnique({
      where: { email: 'demo@sgm.local' },
      include: { neptunConnection: true },
    });

    expect(demoUser?.neptunConnection).toBeDefined();
    expect(demoUser?.neptunConnection?.status).toBe('OK');
    expect(demoUser?.neptunConnection?.lastSyncedAt).toBeDefined();
  });

  it('creates NEPTUN calendar events for seed users', async () => {
    const count = await prisma.calendarEvent.count({
      where: { source: 'NEPTUN' },
    });
    expect(count).toBeGreaterThan(100);

    const demoEvents = await prisma.calendarEvent.findMany({
      where: {
        source: 'NEPTUN',
        user: { email: 'demo@sgm.local' },
      },
    });

    expect(demoEvents.length).toBeGreaterThan(0);
    const subjectCodes = new Set(demoEvents.map((e) => e.subjectCode));
    expect(subjectCodes.has('IP-18AA1E')).toBe(true);
    expect(subjectCodes.has('BMETE90AX00')).toBe(true);
  });

  it('can be re-run idempotently without error', async () => {
    await expect(seedIntegrations(prisma)).resolves.not.toThrow();

    const count = await prisma.location.count();
    expect(count).toBe(25);
  });
});

