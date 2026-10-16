import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Using a config file turns off Prisma's automatic .env loading, so load it ourselves.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema', // multi-file schema: base + core (Agent B) + integrations (Agent C)
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx --env-file-if-exists=.env prisma/seed/index.ts',
  },
});
