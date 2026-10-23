import type { Prisma, PrismaClient } from '@prisma/client';
import type { ListSubjectsQuery } from './subjects.schemas.js';

export async function listInterests(prisma: PrismaClient) {
  return prisma.interest.findMany({
    select: { id: true, slug: true, label: true },
    orderBy: { slug: 'asc' },
  });
}

export async function listSubjects(prisma: PrismaClient, query: ListSubjectsQuery) {
  const { q, cursor, limit } = query;

  const where: Prisma.SubjectWhereInput = {};
  if (q && q.trim().length > 0) {
    const search = q.trim();
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  let items;
  try {
    items = await prisma.subject.findMany({
      where,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: { id: 'asc' },
      select: { id: true, code: true, name: true, credits: true },
    });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === 'P2025') {
      return { items: [], nextCursor: null };
    }
    throw err;
  }

  let nextCursor: string | null = null;
  if (items.length > limit) {
    items.pop();
    const lastItem = items[items.length - 1];
    nextCursor = lastItem ? lastItem.id : null;
  }

  return { items, nextCursor };
}
