# Tech stack log: Integrations (Agent C)

Agent C appends a row in the **same commit** that changes a package.json, env var, port or service (AGENTS.md §4).

| Package / tool | Version | dev/prod | Why | Added in branch |
|---|---|---|---|---|
| typescript | ~5.9.3 | dev | type checking (`strict`) | chore/phase-0 |
| @types/node | ^22.20.5 | dev | Node 22 types | chore/phase-0 |
| vitest | ^5.0.5 | dev | unit tests (`passWithNoTests` until C1 lands) | chore/phase-0 |
| luxon | ^3.7.2 | prod | timezone-aware date math in Europe/Budapest | int/C1-slot-geo-utils |
| @types/luxon | ^3.7.6 | dev | TypeScript types for luxon | int/C1-slot-geo-utils |

## Env vars

| Name | Example | Purpose |
|---|---|---|
