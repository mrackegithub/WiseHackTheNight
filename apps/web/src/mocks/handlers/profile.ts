import { http, HttpResponse } from 'msw';
import type { Schemas } from '@sgm/contracts';
import { authed, url } from '../utils';

export const profileHandlers = [
  http.get(
    url('/me'),
    authed((user) => HttpResponse.json<Schemas['Me']>(user.me)),
  ),
];
