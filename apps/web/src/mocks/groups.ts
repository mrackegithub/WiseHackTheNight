import type { Schemas } from '@sgm/contracts';
import { personById } from './data/people';
import { subjectById } from './data/subjects';
import { db } from './db';

export interface MockGroupMember {
  userId: string;
  role: Schemas['RoleTag'];
  isOwner: boolean;
  joinedAt: string;
}

export interface MockGroup {
  id: string;
  name: string;
  description: string | null;
  subjectId: string;
  maxSize: number;
  isOpen: boolean;
  members: MockGroupMember[];
  sessions: Schemas['StudySession'][];
}

/** PublicUser for a seeded classmate or a mock-registered user (never exposes email/location). */
export function publicUser(userId: string): Schemas['PublicUser'] {
  const person = personById(userId);
  if (person) return person.user;
  const me = db.users.get(userId)?.me;
  return { id: userId, displayName: me?.displayName ?? 'Unknown', avatarUrl: me?.avatarUrl ?? null, faculty: me?.faculty ?? null, bio: me?.bio ?? null };
}

/** Start of the next PLANNED session that hasn't started yet. */
export function nextSessionAt(g: MockGroup): string | null {
  const now = Date.now();
  const upcoming = g.sessions.filter((s) => s.status === 'PLANNED' && Date.parse(s.start) > now).map((s) => s.start);
  return upcoming.sort()[0] ?? null;
}

export const toGroupSummary = (g: MockGroup): Schemas['GroupSummary'] => ({
  id: g.id,
  name: g.name,
  subject: subjectById(g.subjectId)!,
  memberCount: g.members.length,
  maxSize: g.maxSize,
  nextSessionAt: nextSessionAt(g),
});

export const toGroup = (g: MockGroup): Schemas['Group'] => ({
  ...toGroupSummary(g),
  description: g.description,
  isOpen: g.isOpen,
  members: g.members.map((m) => ({ user: publicUser(m.userId), role: m.role, isOwner: m.isOwner, joinedAt: m.joinedAt })),
});

export const isMember = (g: MockGroup, userId: string) => g.members.some((m) => m.userId === userId);
