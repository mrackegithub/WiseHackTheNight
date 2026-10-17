import type { PrismaClient } from '@prisma/client';
import { notFound, validationError } from '../../core/errors.js';
import type { GeoPointInput, PreferencesInput, UpdateMeInput, UserSubjectInput } from './users.schemas.js';

export async function getMe(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      interests: {
        include: { interest: true },
      },
    },
  });

  if (!user) {
    throw notFound('User not found');
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    university: user.university,
    faculty: user.faculty,
    location:
      user.homeLat !== null && user.homeLng !== null
        ? {
            lat: user.homeLat,
            lng: user.homeLng,
            ...(user.homeLabel ? { label: user.homeLabel } : {}),
          }
        : null,
    interests: user.interests.map((ui) => ({
      id: ui.interest.id,
      slug: ui.interest.slug,
      label: ui.interest.label,
    })),
    onboardingComplete: user.onboardingComplete,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Me.onboardingComplete (docs/handoffs/fe-to-be-onboarding-complete.md): true once the user has ≥1 subject,
 * a preferences row, and a home location unless they study ONLINE only. Never flips back to false.
 * Called after every write that can complete onboarding.
 */
async function refreshOnboarding(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingComplete: true, homeLat: true, preferences: { select: { mode: true } }, _count: { select: { subjects: true } } },
  });
  if (!user || user.onboardingComplete) return;
  const complete = user._count.subjects > 0 && !!user.preferences && (user.homeLat !== null || user.preferences.mode === 'ONLINE');
  if (complete) await prisma.user.update({ where: { id: userId }, data: { onboardingComplete: true } });
}

export async function updateMe(prisma: PrismaClient, userId: string, input: UpdateMeInput) {
  if (input.interestIds && input.interestIds.length > 0) {
    const existingInterests = await prisma.interest.findMany({
      where: { id: { in: input.interestIds } },
      select: { id: true },
    });
    if (existingInterests.length !== input.interestIds.length) {
      throw validationError('One or more interest IDs do not exist', [
        { path: 'interestIds', issue: 'Invalid interest ID' },
      ]);
    }
  }

  await prisma.$transaction(async (tx) => {
    if (input.interestIds !== undefined) {
      await tx.userInterest.deleteMany({
        where: { userId },
      });
      if (input.interestIds.length > 0) {
        await tx.userInterest.createMany({
          data: input.interestIds.map((interestId) => ({
            userId,
            interestId,
          })),
        });
      }
    }

    const dataToUpdate: Record<string, unknown> = {};
    if (input.displayName !== undefined) dataToUpdate.displayName = input.displayName;
    if (input.bio !== undefined) dataToUpdate.bio = input.bio;
    if (input.avatarUrl !== undefined) dataToUpdate.avatarUrl = input.avatarUrl || null;
    if (input.university !== undefined) dataToUpdate.university = input.university;
    if (input.faculty !== undefined) dataToUpdate.faculty = input.faculty;

    if (Object.keys(dataToUpdate).length > 0) {
      await tx.user.update({
        where: { id: userId },
        data: dataToUpdate,
      });
    }
  });

  await refreshOnboarding(prisma, userId);
  return getMe(prisma, userId);
}

export async function getMySubjects(prisma: PrismaClient, userId: string) {
  const userSubjects = await prisma.userSubject.findMany({
    where: { userId },
    include: { subject: true },
    orderBy: { subject: { code: 'asc' } },
  });

  return userSubjects.map((us) => ({
    subject: {
      id: us.subject.id,
      code: us.subject.code,
      name: us.subject.name,
      credits: us.subject.credits,
    },
    role: us.role,
    confidence: us.confidence,
  }));
}

export async function replaceMySubjects(
  prisma: PrismaClient,
  userId: string,
  items: UserSubjectInput[],
) {
  if (items.length > 0) {
    const subjectIds = items.map((i) => i.subjectId);
    const existingSubjects = await prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true },
    });
    const existingSet = new Set(existingSubjects.map((s) => s.id));
    for (const item of items) {
      if (!existingSet.has(item.subjectId)) {
        throw validationError(`Subject with ID ${item.subjectId} does not exist`, [
          { path: 'subjectId', issue: 'Subject does not exist' },
        ]);
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.userSubject.deleteMany({
      where: { userId },
    });

    if (items.length > 0) {
      await tx.userSubject.createMany({
        data: items.map((item) => ({
          userId,
          subjectId: item.subjectId,
          role: item.role,
          confidence: item.confidence,
        })),
      });
    }
  });

  await refreshOnboarding(prisma, userId);
  return getMySubjects(prisma, userId);
}

export async function getMyPreferences(prisma: PrismaClient, userId: string) {
  let prefs = await prisma.preferences.findUnique({
    where: { userId },
  });

  if (!prefs) {
    prefs = await prisma.preferences.create({
      data: {
        userId,
        groupSizeMin: 2,
        groupSizeMax: 4,
        maxDistanceKm: 5,
        sessionLengthMinutes: 90,
        mode: 'EITHER',
        locationTypes: [],
      },
    });
  }

  return {
    groupSizeMin: prefs.groupSizeMin,
    groupSizeMax: prefs.groupSizeMax,
    maxDistanceKm: prefs.maxDistanceKm,
    sessionLengthMinutes: prefs.sessionLengthMinutes,
    locationTypes: prefs.locationTypes,
    mode: prefs.mode,
  };
}

export async function updateMyPreferences(
  prisma: PrismaClient,
  userId: string,
  input: PreferencesInput,
) {
  const prefs = await prisma.preferences.upsert({
    where: { userId },
    update: {
      groupSizeMin: input.groupSizeMin,
      groupSizeMax: input.groupSizeMax,
      maxDistanceKm: input.maxDistanceKm,
      sessionLengthMinutes: input.sessionLengthMinutes,
      locationTypes: input.locationTypes,
      mode: input.mode,
    },
    create: {
      userId,
      groupSizeMin: input.groupSizeMin,
      groupSizeMax: input.groupSizeMax,
      maxDistanceKm: input.maxDistanceKm,
      sessionLengthMinutes: input.sessionLengthMinutes,
      locationTypes: input.locationTypes,
      mode: input.mode,
    },
  });

  await refreshOnboarding(prisma, userId);
  return {
    groupSizeMin: prefs.groupSizeMin,
    groupSizeMax: prefs.groupSizeMax,
    maxDistanceKm: prefs.maxDistanceKm,
    sessionLengthMinutes: prefs.sessionLengthMinutes,
    locationTypes: prefs.locationTypes,
    mode: prefs.mode,
  };
}

export async function updateMyLocation(
  prisma: PrismaClient,
  userId: string,
  input: GeoPointInput,
) {
  // Round to 3 decimal places (~100 m) for privacy
  const lat = Math.round(input.lat * 1000) / 1000;
  const lng = Math.round(input.lng * 1000) / 1000;
  const label = input.label?.trim() || null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      homeLat: lat,
      homeLng: lng,
      homeLabel: label,
    },
  });
  await refreshOnboarding(prisma, userId);

  return {
    lat,
    lng,
    ...(label ? { label } : {}),
  };
}
