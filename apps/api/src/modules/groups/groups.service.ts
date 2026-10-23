import { randomBytes } from 'node:crypto';
import type { PrismaClient, RoleTag } from '@prisma/client';
import { conflict, forbidden, HttpError, notFound } from '../../core/errors.js';
import { DateTime, intersectMultipleSlots, subtractSlots } from '@sgm/integrations';
import { getAvailabilityService } from '../integrations/neptun/availability.service.js';
import type { CreateGroupInput, SuggestedSlotsQuery } from './groups.schemas.js';

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
      throw conflict('This group is invite-only', 'GROUP_CLOSED');
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

    // Sync all upcoming planned sessions into the joining member's calendar
    const now = new Date();
    const futureSessions = await tx.studySession.findMany({
      where: {
        groupId,
        status: 'PLANNED',
        start: { gte: now },
      },
    });
    for (const session of futureSessions) {
      await tx.calendarEvent.upsert({
        where: {
          userId_source_externalUid: {
            userId,
            source: 'STUDY_SESSION',
            externalUid: session.id,
          },
        },
        update: {
          start: session.start,
          end: session.end,
          title: `Study Session: ${group.name}`,
        },
        create: {
          userId,
          source: 'STUDY_SESSION',
          externalUid: session.id,
          title: `Study Session: ${group.name}`,
          start: session.start,
          end: session.end,
        },
      });
    }

    // isOpen is the creator's choice (listed vs invite-only), not fullness: member count is checked on every join
    const newMemberCount = group.members.length + 1;

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
      isOpen: group.isOpen,
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
        sessions: { select: { id: true, start: true } },
      },
    });

    if (!group) {
      throw notFound('Group not found', 'NOT_FOUND');
    }

    const membership = group.members.find((m) => m.userId === userId);
    if (!membership) {
      throw notFound('Not a member of this group', 'NOT_FOUND');
    }

    const now = new Date();
    const futureSessionIds = group.sessions
      .filter((s) => s.start >= now)
      .map((s) => s.id);

    if (futureSessionIds.length > 0) {
      await tx.calendarEvent.deleteMany({
        where: {
          userId,
          source: 'STUDY_SESSION',
          externalUid: { in: futureSessionIds },
        },
      });
    }

    await tx.groupMember.delete({
      where: {
        groupId_userId: { groupId, userId },
      },
    });

    const remainingMembers = group.members.filter((m) => m.userId !== userId);
    if (remainingMembers.length === 0) {
      const allSessionIds = group.sessions.map((s) => s.id);
      if (allSessionIds.length > 0) {
        await tx.calendarEvent.deleteMany({
          where: {
            source: 'STUDY_SESSION',
            externalUid: { in: allSessionIds },
          },
        });
      }
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
  });
}

const INVITE_DAYS = 7;

/** A link any member can send to the people they choose; it also lets them into an invite-only group. */
export async function createGroupInvite(prisma: PrismaClient, userId: string, groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId }, include: { members: { select: { userId: true } } } });
  if (!group) {
    throw notFound('Group not found', 'NOT_FOUND');
  }
  if (!group.members.some((m) => m.userId === userId)) {
    throw forbidden('Only members can invite people', 'FORBIDDEN');
  }
  const invite = await prisma.groupInvite.create({
    data: {
      token: randomBytes(18).toString('base64url'), // 24 chars, unguessable
      groupId,
      createdById: userId,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  return { token: invite.token, groupId, expiresAt: invite.expiresAt.toISOString() };
}

async function validInvite(prisma: PrismaClient, token: string) {
  const invite = await prisma.groupInvite.findUnique({
    where: { token },
    include: {
      createdBy: { select: { id: true, displayName: true, avatarUrl: true, faculty: true, bio: true } },
      group: { include: { members: { select: { userId: true } } } },
    },
  });
  if (!invite) {
    throw notFound('Invite not found', 'NOT_FOUND');
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    throw new HttpError(410, 'INVITE_EXPIRED', 'This invite link has expired');
  }
  return invite;
}

export async function getInvite(prisma: PrismaClient, userId: string, token: string) {
  const invite = await validInvite(prisma, token);
  return {
    token,
    expiresAt: invite.expiresAt.toISOString(),
    invitedBy: invite.createdBy,
    group: await getGroup(prisma, invite.groupId),
    alreadyMember: invite.group.members.some((m) => m.userId === userId),
  };
}

/** Joins through an invite: works for invite-only groups too, as long as there's room. Idempotent. */
export async function acceptInvite(prisma: PrismaClient, userId: string, token: string) {
  const invite = await validInvite(prisma, token);
  const groupId = invite.groupId;

  await prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({
      where: { id: groupId },
      include: { members: { select: { userId: true } } },
    });
    if (!group) {
      throw notFound('Group not found', 'NOT_FOUND');
    }
    if (!group.members.some((m) => m.userId === userId)) {
      if (group.members.length >= group.maxSize) {
        throw conflict('Group is full', 'GROUP_FULL');
      }
      const userSubj = await tx.userSubject.findUnique({
        where: { userId_subjectId: { userId, subjectId: group.subjectId } },
      });
      await tx.groupMember.create({
        data: { groupId: group.id, userId, role: userSubj?.role ?? 'PEER', isOwner: false },
      });

      // Sync all upcoming planned sessions into the joining member's calendar
      const now = new Date();
      const futureSessions = await tx.studySession.findMany({
        where: {
          groupId,
          status: 'PLANNED',
          start: { gte: now },
        },
      });
      for (const session of futureSessions) {
        await tx.calendarEvent.upsert({
          where: {
            userId_source_externalUid: {
              userId,
              source: 'STUDY_SESSION',
              externalUid: session.id,
            },
          },
          update: {
            start: session.start,
            end: session.end,
            title: `Study Session: ${group.name}`,
          },
          create: {
            userId,
            source: 'STUDY_SESSION',
            externalUid: session.id,
            title: `Study Session: ${group.name}`,
            start: session.start,
            end: session.end,
          },
        });
      }
    }
  });

  return getGroup(prisma, groupId);
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

  // Each member's real free time (their weekly windows in Europe/Budapest − Neptun classes − mirrored
  // study sessions) via AvailabilityService (≤ 2 queries), minus planned sessions of their groups in case
  // a session wasn't mirrored into the calendar (e.g. seeded ones).
  const [freeByUser, sessions] = await Promise.all([
    getAvailabilityService(prisma).getFreeSlotsBulk(memberIds, { start: from, end: to }, minMinutes),
    prisma.studySession.findMany({
      where: {
        status: 'PLANNED',
        group: { members: { some: { userId: { in: memberIds } } } },
        start: { lt: to },
        end: { gt: from },
      },
      include: { group: { select: { members: { select: { userId: true } } } } },
    }),
  ]);

  const memberSlots = memberIds.map((uid) => {
    const busy = sessions.filter((s) => s.group.members.some((m) => m.userId === uid)).map((s) => ({ start: s.start, end: s.end }));
    return subtractSlots(freeByUser.get(uid) ?? [], busy, minMinutes);
  });

  const commonSlots = intersectMultipleSlots(memberSlots, minMinutes);

  // Rank: prefers >= 90 min, daytime, soonest
  const totalSpan = Math.max(1, to.getTime() - from.getTime());
  const scoredSlots = commonSlots.map((slot) => {
    const durationMin = (slot.end.getTime() - slot.start.getTime()) / (60 * 1000);
    const durationScore = durationMin >= 90 ? 1.0 : durationMin / 90;

    // Daytime: starts between 09:00 and 17:00 Budapest time
    const startHour = DateTime.fromJSDate(slot.start).setZone('Europe/Budapest').hour;
    const daytimeScore = startHour >= 9 && startHour < 17 ? 1.0 : 0.7;

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
