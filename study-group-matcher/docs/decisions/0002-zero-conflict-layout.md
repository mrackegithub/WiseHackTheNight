# 0002: Zero-conflict repository layout for 3 parallel agents
Status: accepted
- Per-package pnpm lockfiles (`shared-workspace-lockfile=false`)
- `@fastify/autoload`: no shared route registry
- Prisma multi-file schema: `core.prisma` (B), `integrations.prisma` (C), cross-relations pre-declared in Phase 0
- Migrations tagged `_be_` / `_int_`; seed split per zone behind a frozen `index.ts`
- Per-zone stack docs, append-only handoff files
- Enforced by `scripts/check-ownership.sh` in CI plus CODEOWNERS
