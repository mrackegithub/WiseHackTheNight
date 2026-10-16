import { http, HttpResponse } from 'msw';
import type { paths, Schemas } from '@sgm/contracts';
import { personById } from '../data/people';
import { subjectById } from '../data/subjects';
import { db, defaultPreferences, nextId, type MockUser } from '../db';
import { publicUser, type MockGroup } from '../groups';
import { buildCandidates } from '../matching';
import { apiError, authed, url } from '../utils';

type MatchPage = paths['/matching/matches']['get']['responses'][200]['content']['application/json'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function recordMatch(user: MockUser, group: MockGroup, otherUserId: string | null): Schemas['Match'] {
  const match: Schemas['Match'] = {
    id: nextId(),
    subject: subjectById(group.subjectId)!,
    groupId: group.id,
    createdAt: new Date().toISOString(),
    ...(otherUserId ? { otherUser: publicUser(otherUserId) } : {}),
  };
  user.matches.unshift(match);
  return match;
}

/** Mutual LIKE: a Match plus a new Group (owner = the earlier liker, maxSize = min of both maxima). */
function matchWithPerson(user: MockUser, personId: string, subjectId: string): Schemas['Match'] {
  const person = personById(personId)!;
  const theirRole = person.subjects.find((s) => s.subjectId === subjectId)?.role ?? 'PEER';
  const myRole = user.subjects.find((s) => s.subject.id === subjectId)?.role ?? 'PEER';
  const now = new Date().toISOString();
  const group: MockGroup = {
    id: nextId(),
    name: `${subjectById(subjectId)!.name} study group`,
    description: null,
    subjectId,
    maxSize: Math.min((user.preferences ?? defaultPreferences()).groupSizeMax, 4),
    isOpen: true,
    members: [
      { userId: personId, role: theirRole, isOwner: true, joinedAt: now },
      { userId: user.me.id, role: myRole, isOwner: false, joinedAt: now },
    ],
    nextSessionAt: null,
  };
  db.groups.set(group.id, group);
  return recordMatch(user, group, personId);
}

export const matchingHandlers = [
  http.get(
    url('/matching/candidates'),
    authed((user, { request }) => {
      const p = new URL(request.url).searchParams;
      const subjectId = p.get('subjectId') ?? '';
      const kind = p.get('kind') ?? 'user';
      const limit = Math.min(Math.max(Number(p.get('limit') ?? 10) || 10, 1), 30);
      if (!UUID.test(subjectId)) return apiError(422, 'VALIDATION_FAILED', 'subjectId required', [{ path: 'subjectId', issue: 'must be a uuid' }]);
      if (kind !== 'user' && kind !== 'group') return apiError(422, 'VALIDATION_FAILED', 'Invalid kind', [{ path: 'kind', issue: 'user or group' }]);
      return HttpResponse.json<Schemas['Candidate'][]>(buildCandidates(user, subjectId, kind, limit));
    }),
  ),

  http.post(
    url('/matching/swipes'),
    authed(async (user, { request }) => {
      const body = (await request.json()) as Schemas['SwipeRequest'];
      if (!UUID.test(body.targetId ?? '') || !UUID.test(body.subjectId ?? '') || !['LIKE', 'PASS'].includes(body.direction)) {
        return apiError(422, 'VALIDATION_FAILED', 'Invalid swipe', [{ path: 'direction', issue: 'LIKE or PASS with valid ids' }]);
      }
      if (user.swipes.some((s) => s.targetId === body.targetId && s.subjectId === body.subjectId)) {
        return apiError(409, 'CONFLICT', 'Already swiped');
      }

      let match: Schemas['Match'] | null = null;
      if (body.direction === 'LIKE' && body.targetKind === 'group') {
        const group = db.groups.get(body.targetId);
        if (!group) return apiError(404, 'NOT_FOUND', 'Group not found');
        if (group.members.length >= group.maxSize) return apiError(409, 'GROUP_FULL', 'Group is full');
        const role = user.subjects.find((s) => s.subject.id === group.subjectId)?.role ?? 'PEER';
        group.members.push({ userId: user.me.id, role, isOwner: false, joinedAt: new Date().toISOString() });
        match = recordMatch(user, group, null);
      } else if (body.direction === 'LIKE' && personById(body.targetId)?.likesYou) {
        match = matchWithPerson(user, body.targetId, body.subjectId);
      }

      user.swipes.push({ ...body, at: new Date().toISOString() });
      return HttpResponse.json<Schemas['SwipeResult']>({ recorded: true, match });
    }),
  ),

  http.get(
    url('/matching/matches'),
    authed((user, { request }) => {
      const p = new URL(request.url).searchParams;
      const limit = Math.min(Number(p.get('limit') ?? 20) || 20, 100);
      const offset = Number(p.get('cursor') ?? 0) || 0;
      const items = user.matches.slice(offset, offset + limit);
      return HttpResponse.json<MatchPage>({ items, nextCursor: offset + limit < user.matches.length ? String(offset + limit) : null });
    }),
  ),
];
