# Tech stack log: Backend (Agent B)

Agent B appends a row in the **same commit** that changes a package.json, env var, port or service (AGENTS.md §4).

| Package / tool | Version | dev/prod | Why | Added in branch |
|---|---|---|---|---|
| fastify | ^5.12.7 | prod | HTTP server | chore/phase-0 |
| @fastify/autoload | ^6.5.1 | prod | loads every `src/plugins/*` and every `src/modules/**/index.ts` (under `/api/v1`), so there is no shared router file | chore/phase-0 |
| fastify-plugin | ^6.0.1 | prod | un-encapsulates shared plugins (e.g. `app.prisma`) so all modules see their decorators | chore/phase-0 |
| @prisma/client | ^6.19.3 | prod | DB client (generated on `postinstall`) | chore/phase-0 |
| @faker-js/faker | ^10.6.0 | prod | deterministic seed data (`faker.seed(42)`) | chore/phase-0 |
| @sgm/contracts | workspace:* | prod | OpenAPI types for handler request/response shapes | chore/phase-0 |
| @sgm/integrations | workspace:* | prod | integration ports (Agent C) | chore/phase-0 |
| @fastify/cors | ^11.3.1 | prod | CORS support (allows frontend to reach API) | be/B1-core-plugins |
| @fastify/jwt | ^10.2.4 | prod | JWT verification decorator and token signing | be/B1-core-plugins |
| zod | ^4.6.7 | prod | request validation schemas and error details | be/B1-core-plugins |
| argon2 | ^0.45.1 | prod | password hashing for authentication | be/B1-core-plugins |
| prisma | ^6.19.3 | dev | CLI: migrate, generate. Configured by `prisma.config.ts` (schema folder `prisma/schema`, migrations in `prisma/migrations`) | chore/phase-0 |
| tsx | ^4.23.15 | dev | runs TS directly: `dev` (watch) and `db:seed` | chore/phase-0 |
| typescript | ~5.9.3 | dev | type checking (`strict`, Bundler resolution) | chore/phase-0 |
| @types/node | ^22.20.5 | dev | Node 22 types | chore/phase-0 |
| vitest | ^5.0.5 | dev | unit + integration tests (`app.inject`) | chore/phase-0 |
| ajv | ^8.20.0 | dev | `test:contract`: validates responses against `contracts/openapi.yaml` (JSON Schema 2020-12) | chore/phase-0 |
| ajv-formats | ^3.0.1 | dev | `uuid`, `date-time`, `email` formats for Ajv | chore/phase-0 |
| yaml | ^2.9.1 | dev | parses `openapi.yaml` for the contract tests | chore/phase-0 |
| eslint | ^10.13.0 | dev | linting (flat config `eslint.config.js`) | chore/phase-0 |
| @eslint/js | ^10.0.1 | dev | ESLint recommended rules | chore/phase-0 |
| typescript-eslint | ^8.71.2 | dev | TypeScript lint rules | chore/phase-0 |
| globals | ^17.13.0 | dev | Node globals for ESLint | chore/phase-0 |
| PostgreSQL | 16 | service | database, `localhost:5432` (`pnpm db:up` = docker compose) | chore/phase-0 |

## Env vars

| Name | Example | Purpose |
|---|---|---|
| PORT | 4000 | API port |
| HOST | localhost | interface the API binds to (`0.0.0.0` to expose it on the LAN) |
| DATABASE_URL | postgresql://sgm:sgm@localhost:5432/sgm | Prisma connection string (`prisma.config.ts`, `dev` and `db:seed` load `apps/api/.env`) |
| JWT_SECRET | change-me | secret key for signing/verifying JWT access tokens (`src/plugins/jwt.ts`) |
| CORS_ORIGIN | http://localhost:5173 | allowed CORS origin for browser clients (`src/plugins/cors.ts`) |

The other variables in `apps/api/.env.example` are pre-declared for later tickets and are not read yet.
