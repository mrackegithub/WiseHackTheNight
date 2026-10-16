import { http, HttpResponse } from 'msw';
import type { Schemas } from '@sgm/contracts';
import { db } from '../db';
import { isMember, toGroup } from '../groups';
import { apiError, authed, url } from '../utils';

export const groupHandlers = [
  http.get(
    url('/groups/:groupId'),
    authed((user, { params }) => {
      const group = db.groups.get(String(params.groupId));
      // Members see any of their groups; others only open ones (as in the candidate deck).
      if (!group || (!isMember(group, user.me.id) && !group.isOpen)) return apiError(404, 'NOT_FOUND', 'Group not found');
      return HttpResponse.json<Schemas['Group']>(toGroup(group));
    }),
  ),
];
