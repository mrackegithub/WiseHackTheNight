import type { PrismaClient } from '@prisma/client';
import {
  decryptUrl,
  encryptUrl,
  fetchIcs,
  normalizeCalendarUrl,
  parseIcs,
  validateSafeUrl,
  type ParsedCalendarEvent,
} from '@sgm/integrations';
import type { paths } from '@sgm/contracts';
import { conflict, badRequest } from '../../../core/errors.js';

export type NeptunStatusResponse =
  paths['/integrations/neptun']['get']['responses'][200]['content']['application/json'];
export type SyncResultResponse =
  paths['/integrations/neptun/sync']['post']['responses'][200]['content']['application/json'];

export async function getNeptunStatus(
  prisma: PrismaClient,
  userId: string,
): Promise<NeptunStatusResponse> {
  const connection = await prisma.neptunConnection.findUnique({
    where: { userId },
  });

  const eventCount = await prisma.calendarEvent.count({
    where: { userId, source: 'NEPTUN' },
  });

  if (!connection || connection.status === 'NOT_CONNECTED') {
    return {
      connected: false,
      status: 'NOT_CONNECTED',
      lastSyncedAt: null,
      lastError: null,
      eventCount,
    };
  }

  return {
    connected: Boolean(connection.icsUrlEncrypted),
    status: connection.status,
    lastSyncedAt: connection.lastSyncedAt ? connection.lastSyncedAt.toISOString() : null,
    lastError: connection.lastError ?? null,
    eventCount,
  };
}

export async function connectNeptun(
  prisma: PrismaClient,
  userId: string,
  rawUrl: string,
  fetcher?: typeof fetch,
): Promise<NeptunStatusResponse> {
  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeCalendarUrl(rawUrl);
    await validateSafeUrl(normalizedUrl);
  } catch (err: unknown) {
    throw badRequest(
      `Invalid or unsafe Neptun URL: ${err instanceof Error ? err.message : String(err)}`,
      'VALIDATION_FAILED',
    );
  }

  const encryptedUrl = encryptUrl(normalizedUrl);

  await prisma.neptunConnection.upsert({
    where: { userId },
    update: {
      icsUrlEncrypted: encryptedUrl,
      status: 'SYNCING',
      lastError: null,
    },
    create: {
      userId,
      icsUrlEncrypted: encryptedUrl,
      status: 'SYNCING',
      lastError: null,
    },
  });

  // Trigger sync
  try {
    await performSync(prisma, userId, normalizedUrl, fetcher);
  } catch {
    // performSync updates the status to ERROR and records lastError
  }

  return getNeptunStatus(prisma, userId);
}

export async function disconnectNeptun(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.calendarEvent.deleteMany({
      where: { userId, source: 'NEPTUN' },
    });

    await tx.neptunConnection.upsert({
      where: { userId },
      update: {
        icsUrlEncrypted: null,
        status: 'NOT_CONNECTED',
        lastError: null,
        lastSyncedAt: null,
      },
      create: {
        userId,
        icsUrlEncrypted: null,
        status: 'NOT_CONNECTED',
        lastError: null,
        lastSyncedAt: null,
      },
    });
  });
}

export async function syncNeptun(
  prisma: PrismaClient,
  userId: string,
  fetcher?: typeof fetch,
): Promise<SyncResultResponse> {
  const connection = await prisma.neptunConnection.findUnique({
    where: { userId },
  });

  if (!connection || !connection.icsUrlEncrypted || connection.status === 'NOT_CONNECTED') {
    throw conflict('Not connected to Neptun', 'NOT_CONNECTED');
  }

  let url: string;
  try {
    url = decryptUrl(connection.icsUrlEncrypted);
  } catch {
    await prisma.neptunConnection.update({
      where: { userId },
      data: { status: 'ERROR', lastError: 'Failed to decrypt calendar URL' },
    });
    throw conflict('Encrypted URL corrupted', 'INVALID_CREDENTIALS');
  }

  await prisma.neptunConnection.update({
    where: { userId },
    data: { status: 'SYNCING', lastError: null },
  });

  return performSync(prisma, userId, url, fetcher);
}

async function performSync(
  prisma: PrismaClient,
  userId: string,
  url: string,
  fetcher?: typeof fetch,
): Promise<SyncResultResponse> {
  let icsText: string;
  try {
    icsText = await fetchIcs(url, {
      fetcher,
      skipDnsCheck: Boolean(fetcher), // skip DNS check when custom fetcher injected in tests
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await prisma.neptunConnection.update({
      where: { userId },
      data: { status: 'ERROR', lastError: errorMsg },
    });
    const error = new Error(`Neptun feed unreachable: ${errorMsg}`);
    (error as unknown as { statusCode: number; code: string }).statusCode = 502;
    (error as unknown as { statusCode: number; code: string }).code = 'NEPTUN_UNREACHABLE';
    throw error;
  }

  return applyIcsData(prisma, userId, icsText);
}

export async function uploadNeptunIcs(
  prisma: PrismaClient,
  userId: string,
  icsText: string,
): Promise<SyncResultResponse> {
  if (!icsText || !icsText.includes('BEGIN:VCALENDAR')) {
    throw badRequest('Invalid iCalendar file format', 'VALIDATION_FAILED');
  }

  const result = await applyIcsData(prisma, userId, icsText);

  // Mark connection as OK even if without URL
  await prisma.neptunConnection.upsert({
    where: { userId },
    update: {
      status: 'OK',
      lastSyncedAt: new Date(),
      lastError: null,
    },
    create: {
      userId,
      status: 'OK',
      lastSyncedAt: new Date(),
      lastError: null,
    },
  });

  return result;
}

export async function applyIcsData(
  prisma: PrismaClient,
  userId: string,
  icsText: string,
): Promise<SyncResultResponse> {
  const allSubjects = await prisma.subject.findMany({ select: { id: true, code: true } });
  const knownSubjectCodes = allSubjects.map((s) => s.code);

  const parsedEvents: ParsedCalendarEvent[] = parseIcs(icsText, {
    knownSubjectCodes,
    maxWeeksAhead: 16,
  });

  const now = new Date();

  // Find existing NEPTUN events for this user
  const existingEvents = await prisma.calendarEvent.findMany({
    where: { userId, source: 'NEPTUN' },
    select: { id: true, externalUid: true },
  });

  const existingMap = new Map<string, string>();
  for (const e of existingEvents) {
    if (e.externalUid) existingMap.set(e.externalUid, e.id);
  }

  const parsedUids = new Set<string>();
  let importedCount = 0;

  const result = await prisma.$transaction(async (tx) => {
    // Upsert parsed events
    for (const ev of parsedEvents) {
      parsedUids.add(ev.externalUid);

      const existingId = existingMap.get(ev.externalUid);
      if (existingId) {
        await tx.calendarEvent.update({
          where: { id: existingId },
          data: {
            title: ev.title,
            start: ev.start,
            end: ev.end,
            room: ev.room ?? null,
            subjectCode: ev.subjectCode ?? null,
          },
        });
        importedCount++;
      } else {
        await tx.calendarEvent.create({
          data: {
            userId,
            title: ev.title,
            start: ev.start,
            end: ev.end,
            room: ev.room ?? null,
            subjectCode: ev.subjectCode ?? null,
            source: 'NEPTUN',
            externalUid: ev.externalUid,
          },
        });
        importedCount++;
      }
    }

    // Delete stale events whose UID is no longer in parsed feed
    const uidsToDelete: string[] = [];
    for (const [uid, id] of existingMap.entries()) {
      if (!parsedUids.has(uid)) {
        uidsToDelete.push(id);
      }
    }

    let removedCount = 0;
    if (uidsToDelete.length > 0) {
      const delRes = await tx.calendarEvent.deleteMany({
        where: { id: { in: uidsToDelete } },
      });
      removedCount = delRes.count;
    }

    // Subject linking: link detected course codes to /me/subjects as PEER
    const detectedCodes = new Set<string>();
    for (const ev of parsedEvents) {
      if (ev.subjectCode) {
        detectedCodes.add(ev.subjectCode.toUpperCase());
      }
    }

    const matchingSubjects = allSubjects.filter((s) => detectedCodes.has(s.code.toUpperCase()));
    const existingUserSubjects = await tx.userSubject.findMany({
      where: { userId },
      select: { subjectId: true },
    });
    const existingSubjectIds = new Set(existingUserSubjects.map((us) => us.subjectId));

    let subjectsLinked = 0;
    for (const subj of matchingSubjects) {
      if (!existingSubjectIds.has(subj.id)) {
        await tx.userSubject.create({
          data: {
            userId,
            subjectId: subj.id,
            role: 'PEER',
            confidence: 3,
          },
        });
        subjectsLinked++;
      }
    }

    // Update connection status
    await tx.neptunConnection.upsert({
      where: { userId },
      update: {
        status: 'OK',
        lastSyncedAt: now,
        lastError: null,
      },
      create: {
        userId,
        status: 'OK',
        lastSyncedAt: now,
        lastError: null,
      },
    });

    return {
      imported: importedCount,
      removed: removedCount,
      subjectsLinked,
      syncedAt: now.toISOString(),
    };
  });

  return result;
}

let syncInterval: NodeJS.Timeout | null = null;

/**
 * 6-hourly background re-sync job for active Neptun connections.
 */
export function startPeriodicNeptunResync(
  prisma: PrismaClient,
  intervalMs = 6 * 60 * 60 * 1000,
): void {
  if (syncInterval) return;

  syncInterval = setInterval(async () => {
    try {
      const activeConnections = await prisma.neptunConnection.findMany({
        where: {
          status: { not: 'NOT_CONNECTED' },
          icsUrlEncrypted: { not: null },
        },
      });

      for (const conn of activeConnections) {
        try {
          const url = decryptUrl(conn.icsUrlEncrypted!);
          await performSync(prisma, conn.userId, url);
        } catch {
          // Log and continue to next user without crashing loop
        }
      }
    } catch {
      // Ignore background loop error
    }
  }, intervalMs);

  syncInterval.unref();
}

export function stopPeriodicNeptunResync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
