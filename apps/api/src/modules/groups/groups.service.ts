import type { PrismaClient, RoleTag } from '@prisma/client';
import { conflict, notFound } from '../../core/errors.js';
import { stubIntersectSlots } from '../../core/stubs/integrations.stub.js';
import type { CreateGroupInput, SuggestedSlotsQuery } from './groups.schemas.js';

function generateDaySlots(rangeStart: Date, rangeEnd: Date, minMinutes: number) {
  const slots: Array<{ start: Date; end: Date }> = [];
  const curr = new Date(rangeStart);
  curr.setUTCHours(0, 0, 0, 0);

  while (curr.getTime() < rangeEnd.getTime()) {
    const dayOfWeek = curr.getUTCDay();
    // Weekdays Monday - Friday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const slotStart = new Date(curr);
      slotStart.setUTCHours(9, 0, 0, 0);
      const slotEnd = new Date(curr);
      slotEnd.setUTCHours(17, 0, 0, 0);

      const effectiveStart = new Date(Math.max(slotStart.getTime(), rangeStart.getTime()));
      const effectiveEnd = new Date(Math.min(slotEnd.getTime(), rangeEnd.getTime()));

      if (effectiveEnd.getTime() - effectiveStart.getTime() >= minMinutes * 60 * 1000) {
        slots.push({ start: effectiveStart, end: effectiveEnd });
      }
    }
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return slots;
}

function subtractBusy(
  freeSlots: Array<{ start: Date; end: Date }>,
  busy: Array<{ start: Date; end: Date }>,
  minMinutes: number,
) {
  let current = [...freeSlots];
  const minMs = minMinutes * 60 * 1000;

  for (const b of busy) {
    const next: Array<{ start: Date; end: Date }> = [];
    for (const f of current) {
      // No overlap
      if (b.end.getTime() <= f.start.getTime() || b.start.getTime() >= f.end.getTime()) {
        next.push(f);
        continue;
      }
      // Keep portion before busy start
      if (b.start.getTime() > f.start.getTime()) {
        if (b.start.getTime() - f.start.getTime() >= minMs) {
          next.push({ start: f.start, end: new Date(b.start) });
        }
      }
      // Keep portion after busy end
      if (b.end.getTime() < f.end.getTime()) {
        if (f.end.getTime() - b.end.getTime() >= minMs) {
          next.push({ start: new Date(b.end), end: f.end });
        }
      }
    }
    current = next;
  }
  return current;
}

export async function listMyGroups(prisma: PrismaClient, userId: string) {
  const groups = await prisma.group.findMany({
    where: {
      members: { some: { userId } },
    },
    include: {
      subject: true,
      members: { select: { userId: true } },
      sessions: {
        where: {
          status: 'PLANNED',
          start: { gte: new Date() },
        },
        orderBy: { start: 'asc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    subject: {
      id: g.subject.id,
      code: g.subject.code,
      name: g.subject.name,
      credits: g.subject.credits,
    },
    memberCount: g.members.length,
    maxSize: g.maxSize,
    nextSessionAt: g.sessions[0]?.start ? g.sessions[0].start.toISOString() : null,
  }));
}

export async function createGroup(
  prisma: PrismaClient,
  userId: string,
  data: CreateGroupInput,
) {
  const subject = await prisma.subject.findUnique({
    where: { id: data.subjectId },
  });
  if (!subject) {
    throw notFound('Subject not found', 'NOT_FOUND');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      faculty: true,
      bio: true,
    },
  });
  if (!user) {
    throw notFound('User not found', 'NOT_FOUND');
  }

  const userSubj = await prisma.userSubject.findUnique({
    where: { userId_subjectId: { userId, subjectId: data.subjectId } },
  });
  const role: RoleTag = userSubj?.role ?? 'PEER';

  const group = await prisma.group.create({
    data: {
      name: data.name,
      subjectId: data.subjectId,
      maxSize: data.maxSize,
      description: data.description ?? null,
      isOpen: data.isOpen ?? true,
      members: {
        create: [
          {
            userId,
            role,
            isOwner: true,
          },
        ],
      },
    },
    include: {
      subject: true,
      members: {
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              faculty: true,
              bio: true,
            },
          },
        },
      },
    },
  });

  return {
    id: group.id,
    name: group.name,
    subject: {
      id: group.subject.id,
      code: group.subject.code,
      name: group.subject.name,
      credits: group.subject.credits,
    },
    memberCount: 1,
    maxSize: group.maxSize,
    nextSessionAt: null,
    description: group.description,
    isOpen: group.isOpen,
    members: group.members.map((m) => ({
      user: m.user,
      role: m.role,
      isOwner: m.isOwner,
      joinedAt: m.joinedAt.toISOString(),
    })),
  };
}

export async function getGroup(prisma: PrismaClient, groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      subject: true,
      members: {
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              faculty: true,
              bio: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      },
      sessions: {
        where: {
          status: 'PLANNED',
          start: { gte: new Date() },
        },
        orderBy: { start: 'asc' },
        take: 1,
      },
    },
  });

  if (!group) {
    throw notFound('Group not found', 'NOT_FOUND');
  }

  return {
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
    description: group.description,
    isOpen: group.isOpen,
    members: group.members.map((m) => ({
      user: m.user,
      role: m.role,
      isOwner: m.isOwner,
      joinedAt: m.joinedAt.toISOString(),
    })),
  };
}

export async function joinGroup(
  prisma: PrismaClient,
  userId: string,
  groupId: string,
) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                faculty: true,
                bio: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        subject: true,
        sessions: {
          where: {
            status: 'PLANNED',
            start: { gte: new Date() },
          },
          orderBy: { start: 'asc' },
          take: 1,
        },
      },
    });

    if (!group) {
      throw notFound('Group not found', 'NOT_FOUND');
    }

    if (group.members.some((m) => m.userId === userId)) {
      throw conflict('Already a member of this group', 'ALREADY_MEMBER');
    }
    if (group.members.length >= group.maxSize) {
      throw conflict('Group is full', 'GROUP_FULL');
    }
    if (!group.isOpen) {
      throw conflict('Group is closed', 'GROUP_CLOSED');
    }

    const userSubj = await tx.userSubject.findUnique({
      where: { userId_subjectId: { userId, subjectId: group.subjectId } },
    });
    const role: RoleTag = userSubj?.role ?? 'PEER';

    const newMember = await tx.groupMember.create({
      data: {
        groupId,
        userId,
        role,
        isOwner: false,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            faculty: true,
            bio: true,
          },
        },
      },
    });

    const newMemberCount = group.members.length + 1;
    let isOpen: boolean = group.isOpen;
    if (newMemberCount >= group.maxSize) {
      await tx.group.update({
        where: { id: groupId },
        data: { isOpen: false },
      });
      isOpen = false;
    }

    const allMembers = [...group.members, newMember];
    return {
      id: group.id,
      name: group.name,
      subject: {
        id: group.subject.id,
        code: group.subject.code,
        name: group.subject.name,
        credits: group.subject.credits,
      },
      memberCount: newMemberCount,
      maxSize: group.maxSize,
      nextSessionAt: group.sessions[0]?.start ? group.sessions[0].start.toISOString() : null,
      description: group.description,
      isOpen,
      members: allMembers.map((m) => ({
        user: m.user,
        role: m.role,
        isOwner: m.isOwner,
        joinedAt: m.joinedAt.toISOString(),
      })),
    };
  });
}

export async function leaveGroup(
  prisma: PrismaClient,
  userId: string,
  groupId: string,
) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({
      where: { id: groupId },
      include: {
        members: { orderBy: { joinedAt: 'asc' } },
      },
    });

    if (!group) {
      throw notFound('Group not found', 'NOT_FOUND');
    }

    const membership = group.members.find((m) => m.userId === userId);
    if (!membership) {
      throw notFound('Not a member of this group', 'NOT_FOUND');
    }

    await tx.groupMember.delete({
      where: {
        groupId_userId: { groupId, userId },
      },
    });

    const remainingMembers = group.members.filter((m) => m.userId !== userId);
    if (remainingMembers.length === 0) {
      await tx.group.delete({ where: { id: groupId } });
      return;
    }

    // Transfer ownership if leaving member was the owner
    if (membership.isOwner) {
      const nextOwner = remainingMembers[0];
      await tx.groupMember.update({
        where: { groupId_userId: { groupId, userId: nextOwner.userId } },
        data: { isOwner: true },
      });
    }

    // Reopen group if it was closed due to being full
    if (!group.isOpen && remainingMembers.length < group.maxSize) {
      await tx.group.update({
        where: { id: groupId },
        data: { isOpen: true },
      });
    }
  });
}

export async function getGroupSuggestedSlots(
  prisma: PrismaClient,
  groupId: string,
  query: SuggestedSlotsQuery,
) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: { select: { userId: true } },
    },
  });

  if (!group) {
    throw notFound('Group not found', 'NOT_FOUND');
  }

  const from = new Date(query.from);
  const to = new Date(query.to);
  const minMinutes = query.minMinutes;
  const memberIds = group.members.map((m) => m.userId);

  if (memberIds.length === 0) {
    return [];
  }

  // Fetch busy events for each member (study sessions + calendar events)
  const [sessions, calendarEvents] = await Promise.all([
    prisma.studySession.findMany({
      where: {
        status: { in: ['PLANNED', 'DONE'] },
        group: {
          members: { some: { userId: { in: memberIds } } },
        },
        start: { lt: to },
        end: { gt: from },
      },
      include: {
        group: { select: { members: { select: { userId: true } } } },
      },
    }),
    prisma.calendarEvent.findMany({
      where: {
        userId: { in: memberIds },
        start: { lt: to },
        end: { gt: from },
      },
      select: {
        userId: true,
        start: true,
        end: true,
      },
    }),
  ]);

  // Compute free slots per member
  const memberSlots = memberIds.map((uid) => {
    const userSessions = sessions
      .filter((s) => s.group.members.some((m) => m.userId === uid))
      .map((s) => ({ start: s.start, end: s.end }));

    const userCal = calendarEvents
      .filter((c) => c.userId === uid)
      .map((c) => ({ start: c.start, end: c.end }));

    const busy = [...userSessions, ...userCal];
    const baseSlots = generateDaySlots(from, to, minMinutes);
    return subtractBusy(baseSlots, busy, minMinutes);
  });

  // Intersect all members' slots
  let commonSlots = memberSlots[0] ?? [];
  for (let i = 1; i < memberSlots.length; i++) {
    commonSlots = stubIntersectSlots(commonSlots, memberSlots[i], minMinutes);
  }

  // Rank: prefers >= 90 min, daytime, soonest
  const totalSpan = Math.max(1, to.getTime() - from.getTime());
  const scoredSlots = commonSlots.map((slot) => {
    const durationMin = (slot.end.getTime() - slot.start.getTime()) / (60 * 1000);
    const durationScore = durationMin >= 90 ? 1.0 : durationMin / 90;

    // Daytime check: hours in UTC 9..17 (approx 10..18 local Budapest time)
    const startHour = slot.start.getUTCHours();
    const daytimeScore = startHour >= 9 && startHour <= 15 ? 1.0 : 0.7;

    // Soonest check: earlier in range gets higher score
    const soonestScore = Math.max(0, 1 - (slot.start.getTime() - from.getTime()) / totalSpan);

    const score = Math.round((durationScore * 0.4 + daytimeScore * 0.3 + soonestScore * 0.3) * 100) / 100;

    return {
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      availableMemberIds: memberIds,
      score,
    };
  });

  scoredSlots.sort((a, b) => b.score - a.score);

  return scoredSlots;
}
