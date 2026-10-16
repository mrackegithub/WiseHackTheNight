# Tech stack log: Frontend (Agent A)

Agent A appends a row in the **same commit** that changes a package.json, env var, port or service (AGENTS.md §4).

| Package / tool | Version | dev/prod | Why | Added in branch |
|---|---|---|---|---|
| react | ^18.3.1 | prod | UI library (ARCHITECTURE §2 pins React 18) | chore/phase-0 |
| react-dom | ^18.3.1 | prod | DOM renderer for React | chore/phase-0 |
| react-router | ^7.18.4 | prod | client-side routing (v7 is the last major supporting React 18; import from `react-router`, not `react-router-dom`) | chore/phase-0 |
| @tanstack/react-query | ^5.104.3 | prod | server-state cache / data fetching | chore/phase-0 |
| openapi-fetch | ^0.17.0 | prod | typed fetch client generated from `@sgm/contracts` `paths` | chore/phase-0 |
| @sgm/contracts | workspace:* | prod | shared OpenAPI types | chore/phase-0 |
| vite | ^8.3.4 | dev | dev server (port 5173) and bundler | chore/phase-0 |
| @vitejs/plugin-react | ^6.1.2 | dev | React JSX / fast refresh for Vite | chore/phase-0 |
| tailwindcss | ^4.3.3 | dev | utility CSS (v4: `@import 'tailwindcss'` in `src/index.css`, no tailwind.config) | chore/phase-0 |
| @tailwindcss/vite | ^4.3.3 | dev | Tailwind v4 Vite plugin (replaces PostCSS setup) | chore/phase-0 |
| msw | ^3.0.3 | dev | API mocks shaped like the contract. v3 ships a Vite plugin (`msw()` in `vite.config.ts`) that serves the worker, so there is no `public/mockServiceWorker.js`; bootstrap via `virtual:msw` (ticket A1) | chore/phase-0 |
| typescript | ~5.9.3 | dev | type checking (`strict`) | chore/phase-0 |
| @types/react | ^18.3.31 | dev | React 18 types | chore/phase-0 |
| @types/react-dom | ^18.3.7 | dev | React DOM 18 types | chore/phase-0 |
| @types/node | ^22.20.5 | dev | Node 22 types for tooling config | chore/phase-0 |
| vitest | ^5.0.5 | dev | unit / component tests | chore/phase-0 |
| jsdom | ^30.1.3 | dev | DOM environment for Vitest | chore/phase-0 |
| @testing-library/react | ^16.3.3 | dev | component testing | chore/phase-0 |
| @testing-library/dom | ^10.4.2 | dev | peer of @testing-library/react | chore/phase-0 |
| @testing-library/jest-dom | ^7.0.1 | dev | DOM matchers (`toBeInTheDocument`), loaded in `src/test/setup.ts` | chore/phase-0 |
| eslint | ^10.13.0 | dev | linting (flat config `eslint.config.js`) | chore/phase-0 |
| @eslint/js | ^10.0.1 | dev | ESLint recommended rules | chore/phase-0 |
| typescript-eslint | ^8.71.2 | dev | TypeScript lint rules | chore/phase-0 |
| eslint-plugin-react-hooks | ^7.1.1 | dev | rules of hooks | chore/phase-0 |
| eslint-plugin-react-refresh | ^0.5.7 | dev | keeps modules fast-refresh safe | chore/phase-0 |
| globals | ^17.13.0 | dev | browser globals for ESLint | chore/phase-0 |

## Env vars

| Name | Example | Purpose |
|---|---|---|
| VITE_API_URL | http://localhost:4000/api/v1 | API base URL (`src/lib/config.ts`; this value is also the default) |
| VITE_USE_MOCKS | true | dev only: MSW answers every API call from `src/mocks/` (in-memory, contract-typed). Mocks are **on in dev unless set to `false`**; production builds never include them |
| VITE_MAP_TILE_URL | https://tile.openstreetmap.org/{z}/{x}/{y}.png | Leaflet tile server (used from ticket A7) |

Dev server port: **5173** (`vite.config.ts`).
