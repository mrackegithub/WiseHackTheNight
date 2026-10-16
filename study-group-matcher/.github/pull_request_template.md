## What
<!-- one paragraph, user-visible behaviour -->

## Agent / zone
- [ ] A – Frontend (`fe/`)   - [ ] B – Backend (`be/`)   - [ ] C – Integrations (`int/`)   - [ ] Human (`contract/`, `chore/`)

## Contract
- operationIds implemented / consumed:
- [ ] No change to `contracts/openapi.yaml` (otherwise this must be a `contract/` PR)

## Agent self-check (must all be ticked before requesting human test)
- [ ] `pnpm check:ownership` passes
- [ ] Lint, typecheck, tests pass locally
- [ ] New/changed deps recorded in my `docs/stack/*.md`
- [ ] Migrations (if any) named `*_be_*` / `*_int_*` and `prisma migrate reset` works from scratch

## How to test (for the human)
1.
2.
Expected:

## Human test result
- [ ] Tested on laptop ___ — PASS / FAIL — notes:
