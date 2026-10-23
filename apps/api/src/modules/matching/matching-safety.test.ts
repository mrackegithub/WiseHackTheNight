import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { swipe, getCandidates } from './matching.service.js';
import { HttpError } from '../../core/errors.js';

describe('Matching Safety & Invariant Unit Tests', () => {
  describe('swipe() safety checks', () => {
    it('rejects swiping on yourself with 422 VALIDATION_FAILED', async () => {
      const mockPrisma = {} as unknown as PrismaClient;

      try {
        await swipe(mockPrisma, 'user-1', {
          targetKind: 'user',
          targetId: 'user-1',
          subjectId: 'subj-1',
          direction: 'LIKE',
        });
        expect.unreachable('Should have thrown 422 VALIDATION_FAILED');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
        const httpErr = err as HttpError;
        expect(httpErr.statusCode).toBe(422);
        expect(httpErr.code).toBe('VALIDATION_FAILED');
        expect(httpErr.message).toBe('Cannot swipe on yourself');
      }
    });

    it('rejects swiping LIKE on a group you are already a member of with 409 ALREADY_MEMBER', async () => {
      const currentUserId = 'user-1';
      const targetGroupId = 'group-1';
      const subjectId = 'subj-1';

      const mockTx = {
        group: {
          findUnique: vi.fn().mockResolvedValue({
            id: targetGroupId,
            subjectId,
            maxSize: 4,
            isOpen: true,
            members: [
              { userId: currentUserId, role: 'PEER', isOwner: false },
              { userId: 'user-2', role: 'PEER', isOwner: true },
            ],
            subject: { id: subjectId, code: 'SUBJ1', name: 'Subject 1', credits: 3 },
          }),
        },
      };

      const mockPrisma = {
        subject: {
          findUnique: vi.fn().mockResolvedValue({ id: subjectId, name: 'Subject 1' }),
        },
        $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx)),
      } as unknown as PrismaClient;

      try {
        await swipe(mockPrisma, currentUserId, {
          targetKind: 'group',
          targetId: targetGroupId,
          subjectId,
          direction: 'LIKE',
        });
        expect.unreachable('Should have thrown 409 ALREADY_MEMBER');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
        const httpErr = err as HttpError;
        expect(httpErr.statusCode).toBe(409);
        expect(httpErr.code).toBe('ALREADY_MEMBER');
        expect(httpErr.message).toBe('You are already a member of this study group');
      }
    });

    it('rejects swiping LIKE on a user who is already in a group with you for that subject with 409 ALREADY_MATCHED', async () => {
      const currentUserId = 'user-1';
      const targetUserId = 'user-2';
      const subjectId = 'subj-1';

      const mockTx = {
        groupMember: {
          findFirst: vi.fn().mockResolvedValue({
            groupId: 'group-1',
            userId: targetUserId,
            group: { id: 'group-1', subjectId },
          }),
        },
      };

      const mockPrisma = {
        subject: {
          findUnique: vi.fn().mockResolvedValue({ id: subjectId, name: 'Subject 1' }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: targetUserId,
            displayName: 'User 2',
            isSeed: false,
          }),
        },
        groupMember: {
          findFirst: vi.fn().mockResolvedValue({
            groupId: 'group-1',
            userId: targetUserId,
            group: { id: 'group-1', subjectId },
          }),
        },
        $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx)),
      } as unknown as PrismaClient;

      try {
        await swipe(mockPrisma, currentUserId, {
          targetKind: 'user',
          targetId: targetUserId,
          subjectId,
          direction: 'LIKE',
        });
        expect.unreachable('Should have thrown 409 ALREADY_MATCHED');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
        const httpErr = err as HttpError;
        expect(httpErr.statusCode).toBe(409);
        expect(httpErr.code).toBe('ALREADY_MATCHED');
        expect(httpErr.message).toBe('You are already in a study group together for this subject');
      }
    });
  });

  describe('getCandidates() safety filters', () => {
    it('strictly excludes currentUserId and all users sharing any group with currentUserId for the subject', async () => {
      const currentUserId = 'user-1';
      const subjectId = 'subj-1';
      const sharedMemberId = 'user-2';

      let userSubjectWhereCaptured: unknown;

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: currentUserId,
            displayName: 'Current User',
            homeLat: null,
            homeLng: null,
            preferences: { mode: 'EITHER', maxDistanceKm: 10, groupSizeMin: 2, groupSizeMax: 4 },
            subjects: [{ role: 'PEER', subjectId }],
            interests: [],
            memberships: [{ groupId: 'group-1' }],
          }),
          findMany: vi.fn().mockResolvedValue([{ id: currentUserId, customWindows: false }]),
        },
        availabilityWindow: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        calendarEvent: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        swipe: {
          findMany: vi.fn().mockResolvedValue([{ targetId: 'user-swiped' }]),
        },
        groupMember: {
          findMany: vi.fn().mockImplementation((args: { where: { group?: { subjectId?: string } } }) => {
            expect(args.where.group?.subjectId).toBe(subjectId);
            return Promise.resolve([{ userId: sharedMemberId }, { userId: currentUserId }]);
          }),
        },
        userSubject: {
          findMany: vi.fn().mockImplementation((args: { where: unknown }) => {
            userSubjectWhereCaptured = args.where;
            return Promise.resolve([]);
          }),
        },
        recurringSlot: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        timetableEvent: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        studySession: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      } as unknown as PrismaClient;

      await getCandidates(mockPrisma, currentUserId, {
        subjectId,
        kind: 'user',
        limit: 10,
      });

      expect(userSubjectWhereCaptured).toBeDefined();
      const where = userSubjectWhereCaptured as {
        subjectId: string;
        userId: { notIn: string[] };
      };
      expect(where.subjectId).toBe(subjectId);
      expect(where.userId.notIn).toContain(currentUserId);
      expect(where.userId.notIn).toContain(sharedMemberId);
      expect(where.userId.notIn).toContain('user-swiped');
    });

    it('strictly excludes groups the current user is already a member of', async () => {
      const currentUserId = 'user-1';
      const subjectId = 'subj-1';
      const memberGroupId = 'group-1';

      let groupWhereCaptured: unknown;

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: currentUserId,
            displayName: 'Current User',
            homeLat: null,
            homeLng: null,
            preferences: { mode: 'EITHER', maxDistanceKm: 10, groupSizeMin: 2, groupSizeMax: 4 },
            subjects: [{ role: 'PEER', subjectId }],
            interests: [],
            memberships: [{ groupId: memberGroupId }],
          }),
          findMany: vi.fn().mockResolvedValue([{ id: currentUserId, customWindows: false }]),
        },
        availabilityWindow: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        calendarEvent: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        swipe: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        group: {
          findMany: vi.fn().mockImplementation((args: { where: unknown }) => {
            groupWhereCaptured = args.where;
            return Promise.resolve([]);
          }),
        },
        recurringSlot: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        timetableEvent: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        studySession: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      } as unknown as PrismaClient;

      await getCandidates(mockPrisma, currentUserId, {
        subjectId,
        kind: 'group',
        limit: 10,
      });

      expect(groupWhereCaptured).toBeDefined();
      const where = groupWhereCaptured as {
        subjectId: string;
        isOpen: boolean;
        id: { notIn: string[] };
        members: { none: { userId: string } };
      };
      expect(where.subjectId).toBe(subjectId);
      expect(where.isOpen).toBe(true);
      expect(where.id.notIn).toContain(memberGroupId);
      expect(where.members).toEqual({ none: { userId: currentUserId } });
    });
  });
});
