// OWNER: human (Phase 0). Wires the per-zone seeds together; agents edit their own seed file only.
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
