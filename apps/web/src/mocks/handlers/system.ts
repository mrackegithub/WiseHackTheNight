import { http, HttpResponse } from 'msw';
import type { paths } from '@sgm/contracts';
import { url } from '../utils';

type Health = paths['/health']['get']['responses'][200]['content']['application/json'];

export const systemHandlers = [http.get(url('/health'), () => HttpResponse.json<Health>({ status: 'ok', version: 'mock' }))];
