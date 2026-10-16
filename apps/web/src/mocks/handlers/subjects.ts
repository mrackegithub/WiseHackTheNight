import { http, HttpResponse } from 'msw';
import type { paths } from '@sgm/contracts';
import { subjects } from '../data/subjects';
import { url } from '../utils';

type SubjectPage = paths['/subjects']['get']['responses'][200]['content']['application/json'];

export const subjectHandlers = [
  http.get(url('/subjects'), ({ request }) => {
    const params = new URL(request.url).searchParams;
    const q = (params.get('q') ?? '').trim().toLowerCase();
    const limit = Math.min(Number(params.get('limit') ?? 20) || 20, 100);
    const offset = Number(params.get('cursor') ?? 0) || 0; // mock cursor = offset

    const matches = q ? subjects.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)) : subjects;
    const items = matches.slice(offset, offset + limit);
    const nextCursor = offset + limit < matches.length ? String(offset + limit) : null;
    return HttpResponse.json<SubjectPage>({ items, nextCursor });
  }),
];
