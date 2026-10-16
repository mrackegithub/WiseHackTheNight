# CI is red on main: API tests need a Postgres database
Status: OPEN
From: A   To: human
Blocking: yes, for every PR's CI check (not for frontend work itself)

## Need
Since B7 (#27), `pnpm test` in CI fails in **apps/api** with
`PrismaClientInitializationError: Environment variable not found: DATABASE_URL`
(auth, contract and seed tests: 12 failed suites). #27, #29 and #30 were merged with this red check, so `main`
fails too, and every new PR (e.g. #31, which only touches `apps/web`) inherits the failure.
`apps/web` tests pass in the same runs.

`.github/workflows/ci.yml` is human-owned (AGENTS.md §2), so agents can't fix it.

## Proposed solution / interface
Give the CI job a Postgres 16 service, set `DATABASE_URL`, and apply migrations before the tests:

```yaml
jobs:
  checks:
    runs-on: ubuntu-latest
    services:
      db:
        image: postgres:16
        env: { POSTGRES_USER: sgm, POSTGRES_PASSWORD: sgm, POSTGRES_DB: sgm }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U sgm" --health-interval 5s --health-timeout 5s --health-retries 10
    env:
      DATABASE_URL: postgresql://sgm:sgm@localhost:5432/sgm
      JWT_SECRET: ci-only-secret
    steps:
      # … existing checkout / pnpm / node / ownership / install steps …
      - run: pnpm --filter @sgm/api exec prisma migrate deploy
      # … existing contract, typecheck and test steps …
```

Optional, same PR: run the new frontend e2e tests (A10, #31):

```yaml
      - run: pnpm --filter @sgm/web exec playwright install --with-deps chromium
      - run: pnpm --filter @sgm/web e2e
```

## Acceptance
- The `ci` check is green on `main` and on #31 without code changes in either app.
- `apps/api` tests that need the DB run against the CI Postgres instead of failing on `DATABASE_URL`.
