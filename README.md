# Wise Hack The Night

## Structure

- `web/` - React + Vite frontend

## Run

```bash
cd web
npm install
npm run dev
```

# Study Group Matcher

Match with classmates by shared free time (from Neptun), subjects, "I need help" / "I can explain" role tags and distance, then book a room together.

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- API contract: [contracts/openapi.yaml](contracts/openapi.yaml)
- **Agent rules (read first):** [AGENTS.md](AGENTS.md)

## Laptop setup
```bash
echo A > .agent-role      # A = frontend, B = backend/db, C = integrations (one per laptop)
pnpm -r install && pnpm db:up
cp apps/api/.env.example apps/api/.env && cp apps/web/.env.example apps/web/.env
```



