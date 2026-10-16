import type { PrismaClient, RoleTag } from '@prisma/client';
import { notFound } from '../../core/errors.js';
import { stubIntersectSlots } from '../../core/stubs/integrations.stub.js';
import type { GetCandidatesQuery } from './matching.schemas.js';
import { score } from './score.js';

function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(R * c * 10) / 10;
}

function generateDefaultSlots(rangeStart: Date, daysAhead = 14) {
  const slots: Array<{ start: Date; end: Date }> = [];
  for (let i = 0; i < daysAhead; i++) {
    const day = new Date(rangeStart.getTime() + i * 24 * 60 * 60 * 1000);
    const dayOfWeek = day.getDay(); // 0 is Sunday, 6 is Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Mon - Fri afternoon study window: 14:00 - 18:00
      const start = new Date(day);
      start.setHours(14, 0, 0, 0);
      const end = new Date(day);
      end.setHours(18, 0, 0, 0);
      slots.push({ start, end });
    }
  }
  return slots;
}

export async function getCandidates(
  prisma: PrismaClient,
  currentUserId: string,
  query: GetCandidatesQuery,
) {
  const { subjectId, kind, limit } = query;

  // 1. Fetch current user context
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    include: {
      preferences: true,
      subjects: { where: { subjectId } },
      interests: { include: { interest: true } },
      memberships: { select: { groupId: true } },
    },
  });

  if (!currentUser) {
    throw notFound('User not found');
  }

  const myRole = (currentUser.subjects[0]?.role ?? 'PEER') as RoleTag;
  const myMaxDistance = currentUser.preferences?.maxDistanceKm ?? 5;
  const myMode = currentUser.preferences?.mode ?? 'EITHER';
  const myGroupRange: [number, number] = [
    currentUser.preferences?.groupSizeMin ?? 2,
    currentUser.preferences?.groupSizeMax ?? 4,
  ];
  const mySessionLength = currentUser.preferences?.sessionLengthMinutes ?? 90;
  const myInterestSlugs = currentUser.interests.map((i) => i.interest.slug);
  const myPoint =
    currentUser.homeLat !== null && currentUser.homeLng !== null
      ? { lat: currentUser.homeLat, lng: currentUser.homeLng }
      : null;

  // 2. Swipes in the last 14 days
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const recentSwipes = await prisma.swipe.findMany({
    where: {
      swiperId: currentUserId,
      subjectId,
      createdAt: { gte: fourteenDaysAgo },
    },
    select: { targetId: true },
  });
  const swipedTargetIds = new Set(recentSwipes.map((s) => s.targetId));

  // 3. User candidates
  if (kind === 'user') {
    const myGroupIds = currentUser.memberships.map((m) => m.groupId);
    const sharedGroupMembers = await prisma.groupMember.findMany({
      where: { groupId: { in: myGroupIds } },
      select: { userId: true },
    });
    const excludedUserIds = new Set([
      currentUserId,
      ...sharedGroupMembers.map((m) => m.userId),
      ...Array.from(swipedTargetIds),
    ]);

    // Pre-select up to 200 users taking the same subject
    const candidateEnrollments = await prisma.userSubject.findMany({
      where: {
        subjectId,
        userId: { notIn: Array.from(excludedUserIds) },
      },
      include: {
        user: {
          include: {
            preferences: true,
            interests: { include: { interest: true } },
          },
        },
      },
      take: 200,
    });

    const now = new Date();
    const myFreeSlots = generateDefaultSlots(now, 14);

    const candidates = [];

    for (const enrollment of candidateEnrollments) {
      const candidateUser = enrollment.user;
      const candPrefs = candidateUser.preferences;
      const candMode = candPrefs?.mode ?? 'EITHER';
      const candMaxDistance = candPrefs?.maxDistanceKm ?? 5;
      const candGroupRange: [number, number] = [candPrefs?.groupSizeMin ?? 2, candPrefs?.groupSizeMax ?? 4];

      const candPoint =
        candidateUser.homeLat !== null && candidateUser.homeLng !== null
          ? { lat: candidateUser.homeLat, lng: candidateUser.homeLng }
          : null;

      const isOnline = myMode === 'ONLINE' || candMode === 'ONLINE';

      let distanceKm: number | null = null;
      if (myPoint && candPoint) {
        distanceKm = haversineDistance(myPoint, candPoint);
      }

      const effectiveMaxDistance = Math.min(myMaxDistance, candMaxDistance);

      // Hard filter: distance if both are IN_PERSON only
      if (!isOnline && myMode === 'IN_PERSON' && candMode === 'IN_PERSON') {
        if (distanceKm === null || distanceKm > effectiveMaxDistance) {
          continue; // Filter out
        }
      }

      // Shared free slots
      const candFreeSlots = generateDefaultSlots(now, 14);
      const sharedTimeSlots = stubIntersectSlots(myFreeSlots, candFreeSlots, 30);
      const overlappingMinutes = sharedTimeSlots.reduce((acc, slot) => {
        return acc + (slot.end.getTime() - slot.start.getTime()) / (60 * 1000);
      }, 0);

      const candInterestSlugs = candidateUser.interests.map((i) => i.interest.slug);

      // Calculate score breakdown
      const scoreBreakdown = score({
        overlappingFreeMinutes: overlappingMinutes,
        sessionLengthMinutes: mySessionLength,
        myRole,
        candidateRole: enrollment.role,
        myInterests: myInterestSlugs,
        candidateInterests: candInterestSlugs,
        distanceKm,
        maxDistanceKm: effectiveMaxDistance,
        isOnline,
        myGroupRange,
        candidateGroupRange: candGroupRange,
      });

      // Find shared interests objects
      const sharedInterests = candidateUser.interests
        .filter((ci) => myInterestSlugs.includes(ci.interest.slug))
        .map((ci) => ({
          id: ci.interest.id,
          slug: ci.interest.slug,
          label: ci.interest.label,
        }));

      candidates.push({
        kind: 'user' as const,
        id: candidateUser.id,
        subjectId,
        user: {
          id: candidateUser.id,
          displayName: candidateUser.displayName,
          avatarUrl: candidateUser.avatarUrl,
          faculty: candidateUser.faculty,
          bio: candidateUser.bio,
        },
        role: enrollment.role,
        distanceKm,
        sharedInterests,
        sharedSlots: sharedTimeSlots.slice(0, 5).map((s) => ({
          start: s.start.toISOString(),
          end: s.end.toISOString(),
        })),
        score: scoreBreakdown,
      });
    }

    // Rank by total score descending
    candidates.sort((a, b) => b.score.total - a.score.total);

    return candidates.slice(0, limit);
  }

  // 4. Group candidates
  const myGroupIds = currentUser.memberships.map((m) => m.groupId);
  const excludedGroupIds = new Set([...myGroupIds, ...Array.from(swipedTargetIds)]);

  const candidateGroups = await prisma.group.findMany({
    where: {
      subjectId,
      isOpen: true,
      id: { notIn: Array.from(excludedGroupIds) },
    },
    include: {
      subject: true,
      members: {
        include: {
          user: {
            include: {
              preferences: true,
              interests: { include: { interest: true } },
            },
          },
        },
      },
      sessions: {
        where: { start: { gte: new Date() }, status: 'PLANNED' },
        orderBy: { start: 'asc' },
        take: 1,
      },
    },
    take: 50,
  });

  const now = new Date();
  const myFreeSlots = generateDefaultSlots(now, 14);
  const groupCandidates = [];

  for (const group of candidateGroups) {
    // Hard filter: group must not be full
    if (group.members.length >= group.maxSize) {
      continue;
    }

    // Group centroid and distance
    const memberPoints = group.members
      .filter((m) => m.user.homeLat !== null && m.user.homeLng !== null)
      .map((m) => ({ lat: m.user.homeLat!, lng: m.user.homeLng! }));

    let distanceKm: number | null = null;
    if (myPoint && memberPoints.length > 0) {
      const sum = memberPoints.reduce(
        (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
        { lat: 0, lng: 0 },
      );
      const centroid = { lat: sum.lat / memberPoints.length, lng: sum.lng / memberPoints.length };
      distanceKm = haversineDistance(myPoint, centroid);
    }

    // Dominant or owner role
    const ownerMember = group.members.find((m) => m.isOwner) ?? group.members[0];
    const groupRole = ownerMember?.role ?? ('PEER' as RoleTag);

    // Group shared interests
    const groupInterestMap = new Map<string, { id: string; slug: string; label: string }>();
    for (const m of group.members) {
      for (const ui of m.user.interests) {
        groupInterestMap.set(ui.interest.slug, ui.interest);
      }
    }
    const groupInterestSlugs = Array.from(groupInterestMap.keys());
    const sharedInterests = Array.from(groupInterestMap.values()).filter((i) =>
      myInterestSlugs.includes(i.slug),
    );

    // Slots
    const groupSlots = generateDefaultSlots(now, 14);
    const sharedTimeSlots = stubIntersectSlots(myFreeSlots, groupSlots, 30);
    const overlappingMinutes = sharedTimeSlots.reduce((acc, slot) => {
      return acc + (slot.end.getTime() - slot.start.getTime()) / (60 * 1000);
    }, 0);

    const isOnline = myMode === 'ONLINE';

    const scoreBreakdown = score({
      overlappingFreeMinutes: overlappingMinutes,
      sessionLengthMinutes: mySessionLength,
      myRole,
      candidateRole: groupRole,
      myInterests: myInterestSlugs,
      candidateInterests: groupInterestSlugs,
      distanceKm,
      maxDistanceKm: myMaxDistance,
      isOnline,
      myGroupRange,
      candidateMemberCount: group.members.length,
    });

    groupCandidates.push({
      kind: 'group' as const,
      id: group.id,
      subjectId,
      group: {
        id: group.id,
        name: group.name,
        subject: {
          id: group.subject.id,
          code: group.subject.code,
          name: group.subject.name,
          credits: group.subject.credits,
        },
        memberCount: group.members.length,
        maxSize: group.maxSize,
        nextSessionAt: group.sessions[0]?.start ? group.sessions[0].start.toISOString() : null,
      },
      role: groupRole,
      distanceKm,
      sharedInterests,
      sharedSlots: sharedTimeSlots.slice(0, 5).map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
      })),
      score: scoreBreakdown,
    });
  }

  groupCandidates.sort((a, b) => b.score.total - a.score.total);

  return groupCandidates.slice(0, limit);
}
