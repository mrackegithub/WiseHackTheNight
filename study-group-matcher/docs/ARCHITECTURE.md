# Study Group Matcher: Architecture

> "Tinder for scheduling classes together." OWNER: human. Agents read this file but never edit it.

## 1. System overview

```
┌──────────────────────────┐        REST/JSON (contracts/openapi.yaml)        ┌───────────────────────────────────────────┐
│  apps/web  (Agent A)     │ ───────────────────────────────────────────────▶ │  apps/api  (Fastify, Node 22)              │
│  React + Vite + TS       │   typed client generated from the contract      │                                           │
│  TanStack Query, Leaflet │                                                 │  modules/auth, users, subjects,            │
│  MSW mocks (contract)    │                                                 │  matching, groups, sessions   (Agent B)    │
└──────────────────────────┘                                                 │                                           │
                                                                             │  modules/integrations/                     │
                                                                             │    neptun, locations, rooms   (Agent C)    │
                                                                             │          │ imports ports only               │
                                                                             └──────────┼────────────────────────────────┘
                                                                                        ▼
                                                     ┌─────────────────────────────────────────────┐
                                                     │ packages/integrations (Agent C)              │
                                                     │  neptun/  iCal fetch + parse + diff          │
                                                     │  geo/     haversine, centroid, Nominatim     │
                                                     │  booking/ BookingProvider: Mock, LibCal, MS  │
                                                     └─────────────────────────────────────────────┘
                                                                        │
                                                        PostgreSQL 16 (Prisma, multi-file schema)
```

## 2. Tech stack (baseline. Additions are logged in `docs/stack/*.md`)

| Layer | Choice | Why |
|---|---|---|
| Monorepo | pnpm workspaces, **per-package lockfiles** (`shared-workspace-lockfile=false`) | no lockfile merge conflicts between agents |
| Contract | OpenAPI 3.1 → `openapi-typescript` → `@sgm/contracts` | one source of truth; FE and BE compile against the same types |
| Frontend | React 18, Vite, TypeScript, TanStack Query, React Router, Tailwind, `openapi-fetch`, `react-leaflet`, `framer-motion` (swipe), MSW | fast, typed, mockable before the backend exists |
| Backend | Node 22, Fastify 5, `@fastify/autoload`, Zod, Prisma 6 (multi-file schema), JWT (`@fastify/jwt`), argon2 | autoload means no shared route-registration file |
| Integrations | `node-ical`, `luxon` (Europe/Budapest), Nominatim (OSM) geocoding, Overpass for seeding locations | free, no keys |
| DB | PostgreSQL 16 (docker compose) | lat/lng as floats + bbox index; PostGIS optional later |
| Tests | Vitest everywhere, Playwright (web e2e), Supertest-style `app.inject` (api) | |
| Seed | `@faker-js/faker` with a fixed seed (`hu` locale) | deterministic test data |

## 3. Domain model (summary)

`User` 1─1 `Preferences`, 1─n `UserSubject{role: NEEDS_HELP|CAN_EXPLAIN|PEER, confidence}`, n─n `Interest`,
1─1 `NeptunConnection`, 1─n `CalendarEvent` (busy), 1─n `AvailabilityWindow` (weekly willingness).
`Swipe(swiper → user|group, subject, LIKE|PASS)`. A mutual LIKE creates a `Match` plus a `Group`.
`Group` n─n `User` via `GroupMember`, 1─n `StudySession` (optional `Location`, optional `Booking`).
`Location` 1─n `Room` 1─n `Booking`.

Full schema: `apps/api/prisma/schema/{base,core,integrations}.prisma`.

## 4. Key flows

### 4.1 Neptun calendar sync (Agent C)
1. User pastes the calendar link Neptun gives for importing into Google Calendar. It is a public iCal (`.ics`) subscription URL.
   `webcal://` links are normalised to `https://`. Uploading an exported `.ics` file is the fallback.
2. `PUT /integrations/neptun` encrypts and stores the URL, then fetches and parses it with `node-ical` (RRULE expanded 16 weeks ahead).
3. Events are upserted by `(userId, NEPTUN, iCal UID)`. Stale ones are deleted, so re-syncs are idempotent.
4. Course codes found in `SUMMARY`/`DESCRIPTION` are matched against `Subject.code`, and missing ones are added to `/me/subjects` as `PEER`.
5. Free slots = `AvailabilityWindow`s (default Mon–Fri 08:00–20:00) − busy events, keeping slots ≥ 30 min. Computed on read, never stored.
6. Background re-sync every 6 h (simple `setInterval` job in the integrations module; no queue needed for the MVP).

### 4.2 Matching (Agent B)
`GET /matching/candidates?subjectId=` builds the swipe deck:

1. **Hard filters:** same subject; not already swiped in 14 days; not already in a group together; distance ≤ min(both `maxDistanceKm`) when both are `IN_PERSON`; group candidates must be `isOpen` and not full.
2. **Pre-select** ≤ 200 users by subject index + lat/lng bounding box.
3. **Score**, with each component in [0, 1]:

| Component | Weight | Formula |
|---|---|---|
| `timeOverlap` | 0.35 | overlapping free minutes in the next 14 days ÷ (3 × `sessionLengthMinutes`), capped at 1. Uses `AvailabilityService.getFreeSlotsBulk` + `intersectSlots` |
| `roleComplement` | 0.25 | NEEDS_HELP↔CAN_EXPLAIN = 1.0 · PEER↔PEER = 0.7 · PEER↔other = 0.5 · NEEDS_HELP↔NEEDS_HELP = 0.3 · CAN_EXPLAIN↔CAN_EXPLAIN = 0.4 |
| `interests` | 0.15 | Jaccard(interest sets) |
| `proximity` | 0.15 | `1 − d / maxDistanceKm` (1.0 when either side is ONLINE-only) |
| `groupSizeFit` | 0.10 | users: overlap of `[groupSizeMin, groupSizeMax]` ranges · groups: 1 if `memberCount+1` within my range, else 0 |

`total = 100 × Σ weight × component`. Weights live in one constant (`matching/weights.ts`) so they can be tuned.
The response includes the breakdown so the UI can show *why* someone matched ("4 h shared free time · they can explain").

4. **Swipe:** `LIKE` on a user checks for the reverse LIKE. If found, a `Match` is created together with a `Group` (owner = earlier liker, `maxSize = min(groupSizeMax)`).
   `LIKE` on an open group joins it directly (or returns `GROUP_FULL`).

### 4.3 Locations & room booking (Agent C)
- `getGroupSuggestedLocations`: centroid of members' home points → `Location`s within 3 km of the centroid → ranked by **max** member distance (fairness), then by type preference. Bookable libraries get a bonus.
- Booking goes through the `BookingProvider` interface. `MOCK` is the default and is fully functional against the `Room`/`Booking` tables. `LIBCAL` and `MS_GRAPH` adapters are stubs until real credentials exist.
- A confirmed booking is linked to a `StudySession`. `AvailabilityService.upsertStudySessionBlock` mirrors the session into each member's calendar as a `STUDY_SESSION` event, so it blocks future matching.

### 4.4 Seeding
`pnpm db:seed` (Faker seed `42`, deterministic):
- **Agent B** (`prisma/seed/core.seed.ts`): 40 subjects with realistic codes, 25 interests, 200 users (password `password123`, `isSeed=true`) scattered within 8 km of central Budapest, role tags, preferences, 30 groups, swipes, and matches.
- **Agent C** (`prisma/seed/integrations.seed.ts`): 25 locations (libraries, campus rooms, cafés) with rooms; Neptun-like class timetables for every seed user (generated from `packages/integrations/test/fixtures/*.ics` templates); default availability windows.
- `prisma/seed/index.ts` (Phase 0) calls core first, then integrations. Each file can also run alone.
- Demo login: `demo@sgm.local` / `password123`, with guaranteed good matches.

## 5. Cross-cutting rules
- **Time:** store UTC, compute "weekday/HH:mm" in `Europe/Budapest` with luxon, and render local time in the UI.
- **Errors:** `{ code, message, details? }` with stable `code`s (listed in the contract). The FE switches on `code`, never on `message`.
- **Privacy:** home coordinates are rounded to 3 decimals and never returned to other users (only `distanceKm`). iCal URLs are encrypted at rest.
- **Auth:** access JWT 15 min plus a rotating refresh token (hash stored).
- **Pagination:** cursor-based, `limit` ≤ 100.

## 6. Phase plan

| Phase | Who | Output |
|---|---|---|
| 0: Foundation (½ day, **sequential**) | Human + one agent on one laptop | This repo: contract, Prisma schema, ports, the team's existing placeholder React app pasted into `apps/web` (package renamed `@sgm/web`), an empty `apps/api` shell (Fastify + autoload + Prisma client + `/health`), seed `index.ts` wiring, generated `@sgm/contracts`, initial migration `0_init`. Tag `v0-foundation`. |
| 1: Parallel build | A, B, C simultaneously | A: full UI on MSW mocks. B: auth/profile/subjects/matching/groups. C: Neptun/availability/geo/booking. |
| 2: Integration | All, human-led | FE flips `VITE_USE_MOCKS=false`; contract tests green; e2e happy path: register → Neptun connect → swipe → match → book room. |
| 3: Polish | All | perf of candidate query, real booking provider, notifications. |
