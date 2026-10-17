import { DateTime } from 'luxon';
import type { Schemas } from '@sgm/contracts';
import { ZONE } from '../lib/time';
import { expandTimetable, freeSlots } from './calendar';
import { interestById } from './data/interests';
import { people, type MockPerson } from './data/people';
import { db, defaultPreferences, type MockUser } from './db';
import { isMember, toGroupSummary, type MockGroup } from './groups';

/** ARCHITECTURE §4.2 weights. */
const WEIGHTS = { timeOverlap: 0.35, roleComplement: 0.25, interests: 0.15, proximity: 0.15, groupSizeFit: 0.1 };

export function roleComplement(a: Schemas['RoleTag'], b: Schemas['RoleTag']) {
  if ((a === 'NEEDS_HELP' && b === 'CAN_EXPLAIN') || (a === 'CAN_EXPLAIN' && b === 'NEEDS_HELP')) return 1;
  if (a === 'PEER' && b === 'PEER') return 0.7;
  if (a === 'PEER' || b === 'PEER') return 0.5;
  return a === 'NEEDS_HELP' ? 0.3 : 0.4;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const minutes = (s: Schemas['TimeSlot']) => (Date.parse(s.end) - Date.parse(s.start)) / 60_000;
const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

/** The user's free slots in the next 14 days (what /me/availability would say). */
function myUpcomingFreeSlots(user: MockUser) {
  const from = DateTime.now().setZone(ZONE).startOf('hour').plus({ hours: 1 });
  const to = from.plus({ days: 14 });
  return freeSlots(user.calendar.windows, expandTimetable(user.calendar.timetable, from, to), from, to, 60);
}

/** Deterministic stand-in for "intersectSlots(mine, theirs)": each classmate is free in a different share (30–90 %) of my slots. */
function sharedWith(mySlots: Schemas['TimeSlot'][], seed: number) {
  const keep = 3 + (seed % 7);
  return mySlots.filter((_, k) => (k * 7 + seed) % 10 < keep);
}

function score(parts: Omit<Schemas['ScoreBreakdown'], 'total'>): Schemas['ScoreBreakdown'] {
  const total = 100 * Object.entries(WEIGHTS).reduce((sum, [k, w]) => sum + w * parts[k as keyof typeof WEIGHTS], 0);
  return { total: round(total, 1), ...Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, round(v)])) } as Schemas['ScoreBreakdown'];
}

const swipedRecently = (user: MockUser, targetId: string, subjectId: string) =>
  user.swipes.some((s) => s.targetId === targetId && s.subjectId === subjectId && Date.now() - Date.parse(s.at) < 14 * 86_400_000);

export function buildCandidates(user: MockUser, subjectId: string, kind: 'user' | 'group', limit: number): Schemas['Candidate'][] {
  const mine = user.subjects.find((s) => s.subject.id === subjectId);
  const myRole = mine?.role ?? 'PEER';
  const prefs = user.preferences ?? defaultPreferences();
  const inPerson = prefs.mode === 'IN_PERSON';
  const myInterests = new Set((user.me.interests ?? []).map((i) => i.id));
  const mySlots = myUpcomingFreeSlots(user);
  // share of my free time we have in common (ARCHITECTURE §4.2)
  const myFreeMinutes = mySlots.reduce((m, s) => m + minutes(s), 0);
  const timeOverlap = (slots: Schemas['TimeSlot'][]) => (myFreeMinutes > 0 ? Math.min(1, slots.reduce((m, s) => m + minutes(s), 0) / myFreeMinutes) : 0);
  const proximity = (km: number | null) => (km === null || prefs.mode === 'ONLINE' ? 1 : Math.max(0, 1 - km / prefs.maxDistanceKm));
  const distanceTo = (p: { lat: number; lng: number }) => (user.me.location ? round(haversineKm(user.me.location, p), 1) : null);
  const groupsWithMe = [...db.groups.values()].filter((g) => isMember(g, user.me.id));

  if (kind === 'group') {
    return [...db.groups.values()]
      .filter((g) => g.subjectId === subjectId && g.isOpen && g.members.length < g.maxSize && !isMember(g, user.me.id) && !swipedRecently(user, g.id, subjectId))
      .map((g, i) => groupCandidate(g, i))
      .sort((a, b) => b.score.total - a.score.total)
      .slice(0, limit);
  }

  function groupCandidate(g: MockGroup, i: number): Schemas['Candidate'] {
    const slots = sharedWith(mySlots, i + 7);
    const bestRole = Math.max(...g.members.map((m) => roleComplement(myRole, m.role)));
    const fits = g.members.length + 1 >= prefs.groupSizeMin && g.members.length + 1 <= prefs.groupSizeMax;
    return {
      kind: 'group',
      id: g.id,
      subjectId,
      group: toGroupSummary(g),
      distanceKm: null,
      sharedInterests: [],
      sharedSlots: slots.slice(0, 5),
      score: score({ timeOverlap: timeOverlap(slots), roleComplement: bestRole, interests: 0, proximity: 1, groupSizeFit: fits ? 1 : 0 }),
    };
  }

  const candidates = people
    .map((p, i) => ({ p, i, theirs: p.subjects.find((s) => s.subjectId === subjectId) }))
    .filter(({ p, theirs }) => theirs && !swipedRecently(user, p.user.id, subjectId) && !groupsWithMe.some((g) => isMember(g, p.user.id)))
    .map(({ p, i, theirs }) => personCandidate(p, i, theirs!.role))
    .filter((c) => !inPerson || c.distanceKm == null || c.distanceKm <= prefs.maxDistanceKm);

  function personCandidate(p: MockPerson, i: number, role: Schemas['RoleTag']): Schemas['Candidate'] {
    const slots = sharedWith(mySlots, i);
    const shared = p.interestIds.filter((id) => myInterests.has(id));
    const union = new Set([...p.interestIds, ...myInterests]).size;
    const km = distanceTo(p.location);
    const theirMax = 3 + (i % 3); // classmates' group size preference: 2–3, 2–4 or 2–5
    const overlap = Math.max(0, Math.min(prefs.groupSizeMax, theirMax) - Math.max(prefs.groupSizeMin, 2) + 1);
    return {
      kind: 'user',
      id: p.user.id,
      subjectId,
      user: p.user,
      role,
      distanceKm: km,
      sharedInterests: shared.map((id) => interestById(id)!),
      sharedSlots: slots.slice(0, 5),
      score: score({
        timeOverlap: timeOverlap(slots),
        roleComplement: roleComplement(myRole, role),
        interests: union ? shared.length / union : 0,
        proximity: proximity(km),
        groupSizeFit: overlap / (prefs.groupSizeMax - prefs.groupSizeMin + 1),
      }),
    };
  }

  return candidates.sort((a, b) => b.score.total - a.score.total).slice(0, limit);
}
