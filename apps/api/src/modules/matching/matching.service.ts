import type { Prisma, PrismaClient, RoleTag, StudyMode } from '@prisma/client';
import { AvailabilityServiceImpl, intersectMultipleSlots, intersectSlots, type AvailabilityDb, type TimeSlot } from '@sgm/integrations';
import { conflict, notFound, validationError } from '../../core/errors.js';

const MATCH_HORIZON_DAYS = 14;

/** Real free slots (weekly windows − classes − study sessions, Europe/Budapest) for the next 14 days. ≤ 2 queries. */
async function freeSlotsFor(prisma: PrismaClient, userIds: string[]): Promise<Map<string, TimeSlot[]>> {
  const start = new Date();
  const end = new Date(start.getTime() + MATCH_HORIZON_DAYS * 24 * 60 * 60 * 1000);
  return new AvailabilityServiceImpl(prisma as unknown as AvailabilityDb).getFreeSlotsBulk([...new Set(userIds)], { start, end }, 30);
}
import type {
  GetCandidatesQuery,
  ListMatchesQuery,
  SwipeRequest,
} from './matching.schemas.js';
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

/** One side of a match in a subject: what the score needs to know about a user. */
interface MatchSide {
  role: RoleTag;
  maxDistanceKm: number;
  mode: StudyMode;
  groupRange: [number, number];
  sessionLengthMinutes: number;
  interestSlugs: string[];
  point: { lat: number; lng: number } | null;
}

async function loadMatchSide(prisma: PrismaClient, userId: string, subjectId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      preferences: true,
      subjects: { where: { subjectId } },
      interests: { include: { interest: true } },
      memberships: { select: { groupId: true } },
    },
  });
  if (!user) {
    throw notFound('User not found');
  }
  const side: MatchSide = {
    role: (user.subjects[0]?.role ?? 'PEER') as RoleTag,
    maxDistanceKm: user.preferences?.maxDistanceKm ?? 5,
    mode: user.preferences?.mode ?? 'EITHER',
    groupRange: [user.preferences?.groupSizeMin ?? 2, user.preferences?.groupSizeMax ?? 4],
    sessionLengthMinutes: user.preferences?.sessionLengthMinutes ?? 90,
    interestSlugs: user.interests.map((i) => i.interest.slug),
    point: user.homeLat !== null && user.homeLng !== null ? { lat: user.homeLat, lng: user.homeLng } : null,
  };
  return { user, side };
}

const candidateInclude = {
  user: { include: { preferences: true, interests: { include: { interest: true } } } },
} satisfies Prisma.UserSubjectInclude;
type CandidateEnrollment = Prisma.UserSubjectGetPayload<{ include: typeof candidateInclude }>;

/** A user card for the deck, scored from `me`'s point of view; null if they're filtered out (too far apart, both in person). */
function scoreUserCandidate(me: MatchSide, myFreeSlots: TimeSlot[], enrollment: CandidateEnrollment, candFreeSlots: TimeSlot[], subjectId: string) {
  const candidateUser = enrollment.user;
  const candPrefs = candidateUser.preferences;
  const candMode = candPrefs?.mode ?? 'EITHER';
  const candMaxDistance = candPrefs?.maxDistanceKm ?? 5;
  const candGroupRange: [number, number] = [candPrefs?.groupSizeMin ?? 2, candPrefs?.groupSizeMax ?? 4];

  const candPoint =
    candidateUser.homeLat !== null && candidateUser.homeLng !== null
      ? { lat: candidateUser.homeLat, lng: candidateUser.homeLng }
      : null;

  const isOnline = me.mode === 'ONLINE' || candMode === 'ONLINE';

  let distanceKm: number | null = null;
  if (me.point && candPoint) {
    distanceKm = haversineDistance(me.point, candPoint);
  }

  const effectiveMaxDistance = Math.min(me.maxDistanceKm, candMaxDistance);

  // Hard filter: distance if both are IN_PERSON only
  if (!isOnline && me.mode === 'IN_PERSON' && candMode === 'IN_PERSON') {
    if (distanceKm === null || distanceKm > effectiveMaxDistance) {
      return null;
    }
  }

  // Shared free slots
  const sharedTimeSlots = intersectSlots(myFreeSlots, candFreeSlots, 30);
  const overlappingMinutes = sharedTimeSlots.reduce((acc, slot) => {
    return acc + (slot.end.getTime() - slot.start.getTime()) / (60 * 1000);
  }, 0);

  const candInterestSlugs = candidateUser.interests.map((i) => i.interest.slug);

  // Calculate score breakdown
  const scoreBreakdown = score({
    overlappingFreeMinutes: overlappingMinutes,
    sessionLengthMinutes: me.sessionLengthMinutes,
    myRole: me.role,
    candidateRole: enrollment.role,
    myInterests: me.interestSlugs,
    candidateInterests: candInterestSlugs,
    distanceKm,
    maxDistanceKm: effectiveMaxDistance,
    isOnline,
    myGroupRange: me.groupRange,
    candidateGroupRange: candGroupRange,
  });

  // Find shared interests objects
  const sharedInterests = candidateUser.interests
    .filter((ci) => me.interestSlugs.includes(ci.interest.slug))
    .map((ci) => ({
      id: ci.interest.id,
      slug: ci.interest.slug,
      label: ci.interest.label,
    }));

  return {
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
  };
}

/** Chance that a test account likes you back, from the match score you saw: 80 → ~9 in 10, 60 → ~half, under 40 → 1 in 10. */
export const likeBackChance = (scoreTotal: number) => Math.min(0.95, Math.max(0.1, (scoreTotal - 30) / 55));

/** A fixed number in [0, 1) per (swiper, target, subject), so re-swiping the same card doesn't re-roll. */
function pairRoll(...ids: string[]): number {
  let h = 0x811c9dc5; // FNV-1a
  for (const ch of ids.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 2 ** 32;
}

/**
 * Test accounts (isSeed) never open the app, so they answer a LIKE themselves, more often the better the match.
 * Real users still have to like back for real.
 */
async function testAccountLikesBack(prisma: PrismaClient, swiperId: string, targetId: string, subjectId: string): Promise<boolean> {
  const [{ side: me }, enrollment] = await Promise.all([
    loadMatchSide(prisma, swiperId, subjectId),
    prisma.userSubject.findUnique({ where: { userId_subjectId: { userId: targetId, subjectId } }, include: candidateInclude }),
  ]);
  if (!enrollment) return false;
  const slots = await freeSlotsFor(prisma, [swiperId, targetId]);
  const candidate = scoreUserCandidate(me, slots.get(swiperId) ?? [], enrollment, slots.get(targetId) ?? [], subjectId);
  return candidate !== null && pairRoll(swiperId, targetId, subjectId) < likeBackChance(candidate.score.total);
}


export async function getCandidates(
  prisma: PrismaClient,
  currentUserId: string,
  query: GetCandidatesQuery,
) {
  const { subjectId, kind, limit } = query;

  // 1. Fetch current user context
  const { user: currentUser, side: me } = await loadMatchSide(prisma, currentUserId, subjectId);
  const {
    role: myRole,
    maxDistanceKm: myMaxDistance,
    mode: myMode,
    groupRange: myGroupRange,
    sessionLengthMinutes: mySessionLength,
    interestSlugs: myInterestSlugs,
    point: myPoint,
  } = me;

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
      include: candidateInclude,
      take: 200,
    });

    const freeSlots = await freeSlotsFor(prisma, [currentUserId, ...candidateEnrollments.map((e) => e.user.id)]);
    const myFreeSlots = freeSlots.get(currentUserId) ?? [];

    const candidates = [];

    for (const enrollment of candidateEnrollments) {
      const candidate = scoreUserCandidate(me, myFreeSlots, enrollment, freeSlots.get(enrollment.user.id) ?? [], subjectId);
      if (candidate) candidates.push(candidate);
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

  const freeSlots = await freeSlotsFor(prisma, [currentUserId, ...candidateGroups.flatMap((g) => g.members.map((m) => m.userId))]);
  const myFreeSlots = freeSlots.get(currentUserId) ?? [];
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
    // when all current members are free
    const groupSlots = intersectMultipleSlots(group.members.map((m) => freeSlots.get(m.userId) ?? []), 30);
    const sharedTimeSlots = intersectSlots(myFreeSlots, groupSlots, 30);
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

export async function swipe(
  prisma: PrismaClient,
  currentUserId: string,
  data: SwipeRequest,
) {
  const { targetKind, targetId, subjectId, direction } = data;

  if (targetKind === 'user' && targetId === currentUserId) {
    throw validationError('Cannot swipe on yourself', [{ path: 'targetId', issue: 'cannot be your own id' }]);
  }

  // Ensure subject exists
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
  });
  if (!subject) {
    throw notFound('Subject not found', 'NOT_FOUND');
  }

  if (direction === 'PASS') {
    await prisma.swipe.upsert({
      where: {
        swiperId_targetKind_targetId_subjectId: {
          swiperId: currentUserId,
          targetKind,
          targetId,
          subjectId,
        },
      },
      update: { direction: 'PASS', createdAt: new Date() },
      create: {
        swiperId: currentUserId,
        targetKind,
        targetId,
        subjectId,
        direction: 'PASS',
      },
    });
    return { recorded: true, match: null };
  }

  // direction === 'LIKE'
  if (targetKind === 'user') {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!targetUser) {
      throw notFound('User not found', 'NOT_FOUND');
    }

    // scored before the transaction to keep it short
    const alreadyLiked = await prisma.swipe.findFirst({
      where: { swiperId: targetId, targetKind: 'user', targetId: currentUserId, subjectId, direction: 'LIKE' },
      select: { id: true },
    });
    const likesBack = !alreadyLiked && targetUser.isSeed && (await testAccountLikesBack(prisma, currentUserId, targetId, subjectId));

    return prisma.$transaction(async (tx) => {
      // 1. Record current swipe
      const currentSwipe = await tx.swipe.upsert({
        where: {
          swiperId_targetKind_targetId_subjectId: {
            swiperId: currentUserId,
            targetKind: 'user',
            targetId,
            subjectId,
          },
        },
        update: { direction: 'LIKE', createdAt: new Date() },
        create: {
          swiperId: currentUserId,
          targetKind: 'user',
          targetId,
          subjectId,
          direction: 'LIKE',
        },
      });

      // 2. Check for reverse LIKE (a test account may answer now)
      let reverseSwipe = await tx.swipe.findFirst({
        where: {
          swiperId: targetId,
          targetKind: 'user',
          targetId: currentUserId,
          subjectId,
          direction: 'LIKE',
        },
      });
      if (!reverseSwipe && likesBack) {
        reverseSwipe = await tx.swipe.upsert({
          where: { swiperId_targetKind_targetId_subjectId: { swiperId: targetId, targetKind: 'user', targetId: currentUserId, subjectId } },
          update: { direction: 'LIKE', createdAt: new Date() },
          create: { swiperId: targetId, targetKind: 'user', targetId: currentUserId, subjectId, direction: 'LIKE' },
        });
      }

      if (!reverseSwipe) {
        return { recorded: true, match: null };
      }

      // 3. Mutual LIKE! Check if a match already exists between them for this subject
      const existingMatch = await tx.match.findFirst({
        where: {
          subjectId,
          OR: [
            { userAId: currentUserId, userBId: targetId },
            { userAId: targetId, userBId: currentUserId },
          ],
        },
        include: {
          group: { include: { subject: true } },
        },
      });

      if (existingMatch) {
        return {
          recorded: true,
          match: {
            id: existingMatch.id,
            subject: {
              id: existingMatch.group.subject.id,
              code: existingMatch.group.subject.code,
              name: existingMatch.group.subject.name,
              credits: existingMatch.group.subject.credits,
            },
            otherUser: {
              id: targetUser.id,
              displayName: targetUser.displayName,
              avatarUrl: targetUser.avatarUrl,
              faculty: targetUser.faculty,
              bio: targetUser.bio,
            },
            groupId: existingMatch.groupId,
            createdAt: existingMatch.createdAt.toISOString(),
          },
        };
      }

      // 4. Create Group and Match
      // Earlier liker is group owner
      const isTargetEarlier = reverseSwipe.createdAt <= currentSwipe.createdAt;
      const ownerId = isTargetEarlier ? targetId : currentUserId;
      const memberId = isTargetEarlier ? currentUserId : targetId;

      const [pref1, pref2] = await Promise.all([
        tx.preferences.findUnique({ where: { userId: currentUserId } }),
        tx.preferences.findUnique({ where: { userId: targetId } }),
      ]);
      const max1 = pref1?.groupSizeMax ?? 4;
      const max2 = pref2?.groupSizeMax ?? 4;
      const maxSize = Math.max(2, Math.min(max1, max2));

      const [currSubj, targetSubj] = await Promise.all([
        tx.userSubject.findUnique({
          where: { userId_subjectId: { userId: currentUserId, subjectId } },
        }),
        tx.userSubject.findUnique({
          where: { userId_subjectId: { userId: targetId, subjectId } },
        }),
      ]);
      const currRole: RoleTag = currSubj?.role ?? 'PEER';
      const targetRole: RoleTag = targetSubj?.role ?? 'PEER';

      const currentUserRecord = await tx.user.findUnique({ where: { id: currentUserId } });
      const groupName = `${currentUserRecord?.displayName ?? 'Study'} & ${targetUser.displayName} Study Pod`;

      const group = await tx.group.create({
        data: {
          name: groupName,
          description: `Study group for ${subject.name} (${subject.code})`,
          subjectId,
          maxSize,
          isOpen: true,
          members: {
            create: [
              {
                userId: ownerId,
                role: ownerId === currentUserId ? currRole : targetRole,
                isOwner: true,
              },
              {
                userId: memberId,
                role: memberId === currentUserId ? currRole : targetRole,
                isOwner: false,
              },
            ],
          },
        },
      });

      const match = await tx.match.create({
        data: {
          groupId: group.id,
          subjectId,
          userAId: ownerId,
          userBId: memberId,
        },
      });

      return {
        recorded: true,
        match: {
          id: match.id,
          subject: {
            id: subject.id,
            code: subject.code,
            name: subject.name,
            credits: subject.credits,
          },
          otherUser: {
            id: targetUser.id,
            displayName: targetUser.displayName,
            avatarUrl: targetUser.avatarUrl,
            faculty: targetUser.faculty,
            bio: targetUser.bio,
          },
          groupId: group.id,
          createdAt: match.createdAt.toISOString(),
        },
      };
    });
  }

  // targetKind === 'group'
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({
      where: { id: targetId },
      include: {
        members: true,
        subject: true,
      },
    });

    if (!group) {
      throw notFound('Group not found', 'NOT_FOUND');
    }
    if (group.subjectId !== subjectId) {
      throw validationError('Group is for a different subject', [{ path: 'subjectId', issue: 'must match the group subject' }]);
    }

    const isMember = group.members.some((m) => m.userId === currentUserId);
    if (!isMember) {
      if (group.members.length >= group.maxSize) {
        throw conflict('Group is full', 'GROUP_FULL');
      }
      if (!group.isOpen) {
        throw conflict('Group is closed', 'GROUP_CLOSED');
      }

      const userSubj = await tx.userSubject.findUnique({
        where: { userId_subjectId: { userId: currentUserId, subjectId } },
      });
      const role: RoleTag = userSubj?.role ?? 'PEER';

      await tx.groupMember.create({
        data: {
          groupId: group.id,
          userId: currentUserId,
          role,
          isOwner: false,
        },
      });

      if (group.members.length + 1 >= group.maxSize) {
        await tx.group.update({
          where: { id: group.id },
          data: { isOpen: false },
        });
      }
    }

    await tx.swipe.upsert({
      where: {
        swiperId_targetKind_targetId_subjectId: {
          swiperId: currentUserId,
          targetKind: 'group',
          targetId,
          subjectId,
        },
      },
      update: { direction: 'LIKE', createdAt: new Date() },
      create: {
        swiperId: currentUserId,
        targetKind: 'group',
        targetId,
        subjectId,
        direction: 'LIKE',
      },
    });

    let match = await tx.match.findFirst({
      where: {
        groupId: group.id,
        userAId: currentUserId,
        userBId: null,
      },
    });

    if (!match) {
      match = await tx.match.create({
        data: {
          groupId: group.id,
          subjectId,
          userAId: currentUserId,
          userBId: null,
        },
      });
    }

    return {
      recorded: true,
      match: {
        id: match.id,
        subject: {
          id: group.subject.id,
          code: group.subject.code,
          name: group.subject.name,
          credits: group.subject.credits,
        },
        groupId: group.id,
        createdAt: match.createdAt.toISOString(),
      },
    };
  });
}

export async function listMatches(
  prisma: PrismaClient,
  currentUserId: string,
  query: ListMatchesQuery,
) {
  const { cursor, limit } = query;

  const matches = await prisma.match.findMany({
    where: {
      OR: [{ userAId: currentUserId }, { userBId: currentUserId }],
    },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    orderBy: { id: 'desc' },
    include: {
      group: {
        include: {
          subject: true,
        },
      },
    },
  });

  let nextCursor: string | null = null;
  if (matches.length > limit) {
    matches.pop();
    const lastItem = matches[matches.length - 1];
    nextCursor = lastItem ? lastItem.id : null;
  }

  const otherUserIds = matches
    .map((m) => (m.userAId === currentUserId ? m.userBId : m.userAId))
    .filter((id): id is string => id !== null);

  const users =
    otherUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: otherUserIds } },
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            faculty: true,
            bio: true,
          },
        })
      : [];

  const userMap = new Map(users.map((u) => [u.id, u]));

  const items = matches.map((m) => {
    const otherUserId = m.userAId === currentUserId ? m.userBId : m.userAId;
    const otherUser = otherUserId ? userMap.get(otherUserId) : undefined;

    return {
      id: m.id,
      subject: {
        id: m.group.subject.id,
        code: m.group.subject.code,
        name: m.group.subject.name,
        credits: m.group.subject.credits,
      },
      ...(otherUser ? { otherUser } : {}),
      groupId: m.groupId,
      createdAt: m.createdAt.toISOString(),
    };
  });

  return { items, nextCursor };
}
