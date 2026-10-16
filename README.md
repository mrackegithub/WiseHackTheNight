

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
pnpm --filter @sgm/api exec prisma migrate dev   # apply migrations
pnpm db:seed
pnpm dev                  # web http://localhost:5173 · api http://localhost:4000/api/v1/health
```

### Windows
- Clone to a short path outside OneDrive (e.g. `C:\dev\WiseHackTheNight`). Long paths break Node's module resolution, and OneDrive syncing `node_modules` is slow.
- Add `C:\Program Files\Git\bin` to your PATH so `bash` works for `pnpm check:ownership`.
- No Docker? Any local PostgreSQL 16 works if it has user `sgm` / password `sgm` / database `sgm` on port 5432 (matches `DATABASE_URL`).



