import type { PrismaClient, RoleTag } from '@prisma/client';
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

    const freeSlots = await freeSlotsFor(prisma, [currentUserId, ...candidateEnrollments.map((e) => e.user.id)]);
    const myFreeSlots = freeSlots.get(currentUserId) ?? [];

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
      const candFreeSlots = freeSlots.get(candidateUser.id) ?? [];
      const sharedTimeSlots = intersectSlots(myFreeSlots, candFreeSlots, 30);
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

      // 2. Check for reverse LIKE
      const reverseSwipe = await tx.swipe.findFirst({
        where: {
          swiperId: targetId,
          targetKind: 'user',
          targetId: currentUserId,
          subjectId,
          direction: 'LIKE',
        },
      });

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
