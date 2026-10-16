import { DateTime } from 'luxon';
import { http, HttpResponse } from 'msw';
import type { Schemas } from '@sgm/contracts';
import { db, type MockUser } from '../db';
import { suggestedSlots } from '../group-slots';
import { isMember, toGroup, toGroupSummary } from '../groups';
import { apiError, authed, url } from '../utils';

/** Members see any of their groups; others only open ones (as in the candidate deck). */
function visibleGroup(user: MockUser, groupId: unknown) {
  const group = db.groups.get(String(groupId));
  return group && (isMember(group, user.me.id) || group.isOpen) ? group : null;
}

const notFound = () => apiError(404, 'NOT_FOUND', 'Group not found');

export const groupHandlers = [
  http.get(
    url('/groups'),
    authed((user) =>
      HttpResponse.json<Schemas['GroupSummary'][]>(
        [...db.groups.values()]
          .filter((g) => isMember(g, user.me.id))
          .map(toGroupSummary)
          // soonest next session first, then groups without one
          .sort((a, b) => (a.nextSessionAt ?? '9999').localeCompare(b.nextSessionAt ?? '9999') || a.name.localeCompare(b.name)),
      ),
    ),
  ),

  http.get(
    url('/groups/:groupId'),
    authed((user, { params }) => {
      const group = visibleGroup(user, params.groupId);
      return group ? HttpResponse.json<Schemas['Group']>(toGroup(group)) : notFound();
    }),
  ),

  http.delete(
    url('/groups/:groupId/members'),
    authed((user, { params }) => {
      const group = visibleGroup(user, params.groupId);
      if (!group || !isMember(group, user.me.id)) return notFound();
      const wasOwner = group.members.find((m) => m.userId === user.me.id)?.isOwner;
      group.members = group.members.filter((m) => m.userId !== user.me.id);
      if (group.members.length === 0) db.groups.delete(group.id);
      else if (wasOwner) group.members[0].isOwner = true; // ownership passes on
      return new HttpResponse(null, { status: 204 });
    }),
  ),

  http.get(
    url('/groups/:groupId/suggested-slots'),
    authed((user, { params, request }) => {
      const group = visibleGroup(user, params.groupId);
      if (!group) return notFound();
      const q = new URL(request.url).searchParams;
      const from = DateTime.fromISO(q.get('from') ?? '');
      const to = DateTime.fromISO(q.get('to') ?? '');
      const minMinutes = Math.max(30, Number(q.get('minMinutes') ?? 60) || 60);
      if (!from.isValid || !to.isValid || to <= from || to.diff(from, 'days').days > 31) {
        return apiError(422, 'VALIDATION_FAILED', 'Invalid range', [{ path: 'to', issue: 'from < to, max 31 days' }]);
      }
      return HttpResponse.json<Schemas['SuggestedSlot'][]>(suggestedSlots(group, from, to, minMinutes));
    }),
  ),

  http.get(
    url('/groups/:groupId/sessions'),
    authed((user, { params }) => {
      const group = visibleGroup(user, params.groupId);
      if (!group) return notFound();
      return HttpResponse.json<Schemas['StudySession'][]>([...group.sessions].sort((a, b) => a.start.localeCompare(b.start)));
    }),
  ),
];
