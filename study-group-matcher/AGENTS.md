# AGENTS.md: Workspace Rules for Autonomous Coding Agents

> Read this whole file before every task. It overrides your defaults.
> OWNER: human. **Agents never edit this file.** If a rule blocks you, file a handoff (§6) and stop.

Project: **Study Group Matcher**, "Tinder for scheduling classes together".
Architecture: `docs/ARCHITECTURE.md`. API contract: `contracts/openapi.yaml`.

---

## 0. Who am I?

Each laptop has a git-ignored file `.agent-role` in the repo root containing exactly one letter: `A`, `B` or `C`.
Run `cat .agent-role` at the start of every session. **If the file is missing, ask the human. Never guess your role.**

| Role | Name | Branch prefix | One-line mission |
|---|---|---|---|
| **A** | Frontend | `fe/` | Every pixel the user sees, built against the contract with MSW mocks |
| **B** | Backend / Database | `be/` | Auth, profiles, subjects, matching algorithm, groups, sessions, core seed |
| **C** | API / Integrations | `int/` | Neptun calendar, availability/free slots, geo & locations, room booking, integration seed |
| Human | Lead | `contract/`, `chore/` | Contract changes, root config, merges to `main` |

---

## 1. The golden rules

1. **Stay in your zone.** Only create or modify files listed for your role in §2. `pnpm check:ownership` enforces this and CI blocks violations.
2. **Never commit to `main`. Never merge. Never push `--force` to anyone else's branch.** Only a human merges, and only after testing.
3. **The contract is law.** Implement or consume `contracts/openapi.yaml` exactly: paths, field names, enums, status codes, error `code`s. You may not change it (see §5).
4. **Document dependencies in the same commit you add them** (§4).
5. **One feature = one branch = one PR.** Small PRs (≲ 400 changed lines excluding lockfiles and generated files).
6. **When blocked, write a handoff and move to the next ticket.** Don't work around another zone by editing its files.
7. **No secrets in git.** Use `.env` (git-ignored) and keep `.env.example` up to date in your app.

---

## 2. File ownership map

Anything not listed is **human-only**.

### Agent A: Frontend
```
apps/web/**                         (entire app, including its package.json and pnpm-lock.yaml)
docs/stack/frontend.md
docs/handoffs/fe-to-*.md            (new files only)
```

### Agent B: Backend / Database
```
apps/api/**                         EXCEPT the Agent C paths below
  ├─ src/app.ts, src/server.ts, src/core/**, src/plugins/**
  ├─ src/modules/{auth,users,subjects,matching,groups,sessions}/**
  ├─ prisma/schema/core.prisma
  ├─ prisma/seed/core.seed.ts
  ├─ prisma/migrations/<timestamp>_be_<name>/
  ├─ test/**
  └─ package.json, pnpm-lock.yaml, .env.example
docs/stack/backend.md
docs/handoffs/be-to-*.md            (new files only)
```

### Agent C: API / Integrations
```
packages/integrations/**            EXCEPT src/ports.ts (frozen, see §5)
apps/api/src/modules/integrations/**  (neptun/, locations/, rooms/ route modules)
apps/api/prisma/schema/integrations.prisma
apps/api/prisma/seed/integrations.seed.ts
apps/api/prisma/migrations/<timestamp>_int_<name>/
docs/stack/integrations.md
docs/handoffs/int-to-*.md           (new files only)
```
Agent C adds npm dependencies **only** to `packages/integrations/package.json`, never to `apps/api/package.json`.
Route modules in `apps/api/src/modules/integrations/` may import `fastify`, `zod`, `@prisma/client` (already in api deps) and `@sgm/integrations`.

### Human only (frozen for agents)
```
contracts/**  packages/contracts/**  AGENTS.md  docs/ARCHITECTURE.md  docs/decisions/**
.github/**  scripts/**  package.json (root)  pnpm-workspace.yaml  .npmrc  docker-compose.yml
apps/api/prisma/schema/base.prisma  apps/api/prisma/seed/index.ts  apps/api/prisma/migrations/migration_lock.toml
packages/integrations/src/ports.ts
```

### Why this guarantees zero merge conflicts
- **Route registration:** `@fastify/autoload` loads every folder under `apps/api/src/modules/`, so nobody edits a shared router file.
- **Database:** Prisma multi-file schema. B and C each own one `.prisma` file. All cross-zone relations were pre-declared in Phase 0.
- **Migrations:** new timestamped folders only, name-tagged `_be_` / `_int_`, so there is never an edit to an existing file.
- **Dependencies:** per-package lockfiles (`.npmrc: shared-workspace-lockfile=false`), so there is no shared root lockfile.
- **Docs:** one stack file per zone, and handoffs are new uniquely named files.
- **Seed:** one file per zone, wired together by a frozen `index.ts`.

---

## 3. Git workflow (follow exactly)

### 3.1 Start a feature
```bash
git checkout main && git pull --ff-only origin main
git checkout -b <prefix>/<ticket-id>-<kebab-summary>     # e.g. be/B3-matching-score, fe/A5-swipe-deck, int/C2-ics-parser
```
Create the branch **automatically** before your first edit. Never work on `main` or on a branch with another role's prefix.

### 3.2 While working
- Commit early and often. **Conventional Commits** with your zone as scope:
  `feat(be): candidate scoring with time overlap`, `fix(fe): swipe card flicker`, `docs(int): add node-ical to stack`
- Rebase on `main` at least once a day and before opening a PR: `git fetch origin && git rebase origin/main`.
  Because zones never overlap, a rebase conflict means you broke §2. Stop and report it.
- After every rebase that brought in new migrations: `pnpm --filter @sgm/api exec prisma migrate reset --force`.

### 3.3 Before opening a PR (self-check, all must pass)
```bash
pnpm check:ownership
pnpm --filter <your-package> lint && pnpm --filter <your-package> typecheck && pnpm --filter <your-package> test
```
B and C must also pass `pnpm --filter @sgm/api test:contract` (responses validated against the OpenAPI schema).

### 3.4 Open the PR and STOP
```bash
git push -u origin <branch>
gh pr create --base main --fill --label "needs-human-test" --label "zone:<fe|be|int>"
```
- Fill **every** section of `.github/pull_request_template.md`, especially **"How to test (for the human)"** with exact clicks, curl commands or seed logins.
- **Then stop work on that branch.** Do not merge, do not approve, do not enable auto-merge.
- Move on to the next ticket on a **new branch from `main`**. If the next ticket depends on the unmerged one, branch from it and say `Depends on #<pr>` in the PR body.
- If the human reports FAIL, fix it on the same branch and push. The PR updates automatically.

### 3.5 Merge (human only)
Human tests on their laptop → ticks "Human test result: PASS" → squash-merges → deletes the branch.
After a merge, every agent runs §3.1 before starting its next ticket.

---

## 4. Documentation rules (dependency & stack log)

Every time you **add, remove or upgrade** a dependency, CLI tool, env var, service or port, update your zone's stack file **in the same commit**:

| Role | File |
|---|---|
| A | `docs/stack/frontend.md` |
| B | `docs/stack/backend.md` |
| C | `docs/stack/integrations.md` |

Add one row to the table: `| package | version | dev/prod | why | added in branch |`.
New env vars also go into your app's `.env.example` with a comment.
A PR whose `package.json` diff has no matching stack-file row will be rejected.
Prefer libraries already listed in `docs/ARCHITECTURE.md §2`. For a new library that overlaps an existing one, write a handoff to `human` first.

---

## 5. Contract change process (the only way to change the API)

The contract (`contracts/openapi.yaml`), the generated types (`packages/contracts`) and `packages/integrations/src/ports.ts` are **frozen for agents**.

1. Agent writes `docs/handoffs/<me>-to-human-contract-<slug>.md` with: the problem, the proposed YAML diff, and which zones are affected. Then it keeps working on something else (or on mocks).
2. Human creates a `contract/<slug>` branch, edits the YAML, runs `pnpm contract:lint && pnpm contract:gen`, and merges after a quick review by the affected laptops.
3. Every agent rebases. TypeScript errors now show exactly what to update.

Changes are **additive by default**: new optional fields and new endpoints. A rename or removal needs all 3 humans to agree.

---

## 6. Handoffs (cross-zone requests)

A new file per request, never an edit to someone else's: `docs/handoffs/<from>-to-<to>-<slug>.md` (`from`/`to` ∈ `fe|be|int|human`).

```markdown
# <title>
Status: OPEN          <!-- the receiving zone's PR flips this by adding a line "Resolved in #<pr>" in its OWN reply file -->
From: B   To: C
Blocking: B7 (yes/no)
## Need
## Proposed solution / interface
## Acceptance
```
To reply, create `<to>-to-<from>-<slug>-reply.md`. Check `docs/handoffs/` for files addressed to you **at the start of every session**.

---

## 7. Definition of Done (per ticket)

- [ ] Behaviour matches the contract and the ticket's acceptance criteria
- [ ] Unit tests for logic, plus at least one integration test per endpoint (B/C) or per page (A, Vitest + Testing Library)
- [ ] No `any` without a `// reason:` comment. No `console.log` left behind (use the Fastify logger / `debug`)
- [ ] Lint, typecheck, tests and `check:ownership` are green
- [ ] Stack doc and `.env.example` updated if needed
- [ ] PR opened with human test steps, then **stop and wait**

---

## 8. Role briefs and starting backlog

Ticket IDs are used in branch names. Do them roughly in order. Tickets marked ⛓ depend on another zone; until it's merged, use a stub or mock.

### Agent A: Frontend (`apps/web`)
Stack: React 18 + Vite + TS, TanStack Query, React Router, Tailwind, `openapi-fetch` typed with `@sgm/contracts`, `react-leaflet`, `framer-motion`, MSW.
**Always develop with `VITE_USE_MOCKS=true` first.** MSW handlers live in `apps/web/src/mocks/` and return data shaped exactly like the contract schemas.

| ID | Ticket |
|---|---|
| A1 | Build on the existing placeholder React app in `apps/web` (keep its tooling; if it isn't Vite, log the actual setup in `docs/stack/frontend.md` and use its env-var prefix instead of `VITE_`): routing, layout, auth context, typed API client (`src/api/client.ts`) with refresh-token interceptor, MSW bootstrapping, error toast that switches on `Error.code` |
| A2 | Register / login pages |
| A3 | Onboarding wizard: profile → subjects + role tags ("I need help" / "I can explain" / "Study as peers") → interests → preferences (group size slider, distance, mode) → location (map pin or address via `/locations/geocode`) |
| A4 | Calendar page: Neptun connect (URL or `.ics` upload), sync status, week view of `/me/schedule` with free slots from `/me/availability` overlaid, weekly window editor |
| A5 | **Swipe deck**: subject picker, card stack with drag/swipe (like / pass, keyboard ← →), card shows role badge, distance, shared interests, top 3 shared slots, score breakdown bars |
| A6 | "It's a match!" modal → link to the group |
| A7 | Groups list and group detail: members with role badges, suggested slots, suggested locations on a Leaflet map, sessions list |
| A8 | Schedule-session flow: pick slot → pick location → (if bookable) search rooms → book → create session |
| A9 | Responsive and mobile-first polish, empty/loading/error states, a11y pass |
| A10 | Playwright e2e of the happy path (against mocks; later against the real API) |

### Agent B: Backend / Database (`apps/api`, core)
Stack: Fastify 5 + autoload, Zod, Prisma 6, `@fastify/jwt`, argon2, Vitest.
Each module folder exports a Fastify plugin. Routes are prefixed `/api/v1` and handler types come from `@sgm/contracts`.
Calls Agent C's code **only through `@sgm/integrations` ports** (`AvailabilityService`, `GeoService`, `intersectSlots`). Until C's implementation lands, use the in-memory stub at `apps/api/src/core/stubs/integrations.stub.ts` (B owns the stub).

| ID | Ticket |
|---|---|
| B1 | Core plugins: error handler that produces the contract `Error` shape, Zod validation, CORS, JWT auth decorator, request logging, `/health`, contract test harness (`test:contract` validates every response with Ajv against `openapi.yaml`) |
| B2 | Auth: register, login, refresh (rotating tokens) |
| B3 | Profile: `/me`, `/me/subjects`, `/me/preferences`, `/me/location` (round coordinates), `/interests`, `/subjects` (search + cursor) |
| B4 | Core seed (`core.seed.ts`): deterministic, see ARCHITECTURE §4.4, including the `demo@sgm.local` user |
| B5 | Matching engine `modules/matching/`: pure `score()` function + weights constant, with exhaustive unit tests |
| B6 | `/matching/candidates`: hard filters, bounding-box preselect, bulk free slots ⛓C3, ranking. Target < 300 ms p95 on seed data |
| B7 | `/matching/swipes` and `/matching/matches`: mutual-like detection inside a transaction, group creation/join, `GROUP_FULL` |
| B8 | Groups: CRUD, join/leave, `/suggested-slots` (intersect all members' free slots ⛓C3) |
| B9 | Sessions: create/list, member conflict check (`409`), call `upsertStudySessionBlock` ⛓C3, link `bookingId` ⛓C6 |

### Agent C: API / Integrations (`packages/integrations` + `apps/api/src/modules/integrations`)
Stack: `node-ical`, `luxon`, `undici` fetch, Nominatim, Vitest. Pure logic lives in `packages/integrations` (100% unit-testable, no Fastify). Thin HTTP routes live in `apps/api/src/modules/integrations/`.

| ID | Ticket |
|---|---|
| C1 | `intersectSlots`, slot merge/subtract utilities, `GeoService` (haversine, centroid), all pure and heavily tested (DST edge cases in Europe/Budapest!) |
| C2 | Neptun iCal parser for the Google-Calendar import link Neptun provides (normalise `webcal://` → `https://`): fetch (timeout 10 s, 2 MB cap, http(s) only, **block private IPs (SSRF)**), parse, expand RRULE 16 weeks, extract course codes; fixtures in `test/fixtures/*.ics` |
| C3 | `AvailabilityService` implementation (Prisma-backed) incl. `getFreeSlotsBulk` in ≤ 2 queries; routes `/me/schedule`, `/me/availability` (GET/PUT) |
| C4 | Neptun routes: connect (encrypt URL), upload, sync, status, disconnect; 6-hourly background re-sync |
| C5 | Locations: `/locations`, `/locations/geocode` (Nominatim proxy, 1 req/s rate limit, 24 h cache, proper User-Agent), `/groups/{id}/suggested-locations` |
| C6 | Booking: `BookingProvider` interface impls `MockProvider` (full, DB-backed, overlap-safe via transaction) and `LibCalProvider`/`MsGraphProvider` stubs; routes `/rooms`, `/bookings`, `/bookings/{id}` |
| C7 | Integration seed (`integrations.seed.ts`): Budapest locations + rooms, Neptun-like timetables per seed user, default availability windows |

---

## 9. Coding standards

- TypeScript `strict: true` everywhere. ESM. Node 22. Prettier defaults + ESLint recommended.
- Names: files `kebab-case.ts`, React components `PascalCase.tsx`, DB columns `camelCase` (Prisma default).
- API handlers stay thin: validate → call service → map to contract DTO. Never return Prisma objects directly.
- Dates: `Date`/ISO in UTC across the boundary; `luxon` with zone `Europe/Budapest` for weekday/HH:mm logic.
- Tests next to code (`*.test.ts`) or in `test/`. Seeded randomness only (`faker.seed(42)`).
- Never call external services (Nominatim, Neptun, booking APIs) in tests. Use fixtures or injected fakes.

## 10. Forbidden (immediate PR rejection)

- Editing files outside your zone, or "quick fixes" in someone else's zone
- Merging, approving, enabling auto-merge, or pushing to `main`
- Changing the contract, generated types, `ports.ts`, root config, CI, or this file
- Committing `.env`, credentials, real student data, or real Neptun URLs
- Deleting or editing an existing migration
- Disabling tests, lint rules or `check:ownership` to get green

## 11. Command cheat-sheet

```bash
pnpm -r install                     # install (per-package lockfiles)
pnpm db:up                          # Postgres in Docker
pnpm --filter @sgm/api exec prisma migrate dev --name be_<name>   # B   (C uses int_<name>)
pnpm db:seed                        # deterministic seed (core + integrations)
pnpm --filter @sgm/web dev          # http://localhost:5173
pnpm --filter @sgm/api dev          # http://localhost:4000/api/v1
pnpm contract:gen                   # human only, after contract change
pnpm check:ownership                # must pass before every PR
```
