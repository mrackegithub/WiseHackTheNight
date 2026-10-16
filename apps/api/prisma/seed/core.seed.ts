// OWNER: Agent B — implement in ticket B4.
import type { PrismaClient } from '@prisma/client';

export interface CoreSeedResult { userIds: string[]; subjectIds: string[]; groupIds: string[] }

export async function seedCore(_prisma: PrismaClient): Promise<CoreSeedResult> {
  return { userIds: [], subjectIds: [], groupIds: [] };
}
