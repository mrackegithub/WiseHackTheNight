# Tech stack log: Contract tooling (human)

`packages/contracts` is human-only (AGENTS.md §5). Log its tooling here.

| Package / tool | Version | dev/prod | Why | Added in branch |
|---|---|---|---|---|
| openapi-typescript | ^7.13.0 | dev | `pnpm contract:gen`: `contracts/openapi.yaml` → `src/generated.ts` (reproduces the committed file byte-for-byte, which CI checks) | chore/phase-0 |
| @redocly/cli | ^2.64.1 | dev | `pnpm contract:lint` | chore/phase-0 |

## Workspace settings

| Setting | Where | Why | Added in branch |
|---|---|---|---|
| `virtual-store-dir-max-length=40` | `.npmrc` | keeps `node_modules/.pnpm` folder names short; Node's ESM resolver fails on `package.json` paths over Windows' 260-char limit, which broke Vite/Vitest on deep checkouts | chore/phase-0 |
