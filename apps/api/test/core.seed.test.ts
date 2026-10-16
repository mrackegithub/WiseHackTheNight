import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { seedCore } from '../prisma/seed/core.seed.js';

describe('B4: Core Seed', () => {
  const prisma = new PrismaClient();

  beforeAll(async () => {
    // Seed database
    await seedCore(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates 200 seed users with isSeed=true', async () => {
    const userCount = await prisma.user.count({ where: { isSeed: true } });
    expect(userCount).toBe(200);
  });

  it('creates 40 subjects with valid codes and credits', async () => {
    const subjectCount = await prisma.subject.count();
    expect(subjectCount).toBeGreaterThanOrEqual(40);
  });

  it('creates 25 interests', async () => {
    const interestCount = await prisma.interest.count();
    expect(interestCount).toBeGreaterThanOrEqual(25);
  });

  it('creates at least 30 groups', async () => {
    const groupCount = await prisma.group.count();
    expect(groupCount).toBeGreaterThanOrEqual(30);
  });

  it('seeds demo user demo@sgm.local with password password123 and complementary roles', async () => {
    const demo = await prisma.user.findUnique({
      where: { email: 'demo@sgm.local' },
      include: {
        preferences: true,
        subjects: { include: { subject: true } },
        interests: { include: { interest: true } },
      },
    });

    expect(demo).toBeDefined();
    expect(demo?.displayName).toBe('Demo Student');
    expect(demo?.isSeed).toBe(true);
    expect(demo?.onboardingComplete).toBe(true);
    expect(demo?.homeLat).toBe(47.4979);
    expect(demo?.homeLng).toBe(19.0402);

    // Verify password is password123
    const passwordValid = await argon2.verify(demo!.passwordHash, 'password123');
    expect(passwordValid).toBe(true);

    // Verify subjects
    expect(demo?.subjects.length).toBeGreaterThanOrEqual(2);
    const algoSubj = demo?.subjects.find((s) => s.subject.code === 'IP-18AA1E');
    expect(algoSubj?.role).toBe('CAN_EXPLAIN');

    const calcSubj = demo?.subjects.find((s) => s.subject.code === 'BMETE90AX00');
    expect(calcSubj?.role).toBe('NEEDS_HELP');

    // Verify demo user has matches
    const matches = await prisma.match.findMany({
      where: {
        OR: [{ userAId: demo!.id }, { userBId: demo!.id }],
      },
    });
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
