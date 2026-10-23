// OWNER: human (Phase 0). Wires the per-zone seeds together; agents edit their own seed file only.
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(dir, '../../.env');
if (existsSync(envFile)) {
  const content = readFileSync(envFile, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { seedCore } from './core.seed';               // Agent B
import { seedIntegrations } from './integrations.seed'; // Agent C

const prisma = new PrismaClient();

async function main() {
  faker.seed(42);
  const core = await seedCore(prisma);          // returns { userIds, subjectIds, groupIds }
  await seedIntegrations(prisma, core);         // timetables, locations, rooms, availability
  console.info('seed complete', { users: core.userIds.length });
}

main().finally(() => prisma.$disconnect());
