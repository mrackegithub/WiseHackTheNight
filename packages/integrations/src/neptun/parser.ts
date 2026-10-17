import nodeIcal from 'node-ical';

export interface ParsedCalendarEvent {
  externalUid: string;
  title: string;
  start: Date;
  end: Date;
  room?: string;
  subjectCode?: string;
  description?: string;
}

export interface ParseIcsOptions {
  /** Maximum weeks in future to expand recurring events. Defaults to 16 weeks. */
  maxWeeksAhead?: number;
  /** Reference 'now' date for recurrence expansion window. Defaults to current date. */
  now?: Date;
  /** Known subject codes to match explicitly against. */
  knownSubjectCodes?: string[];
}

// Regex to capture course codes such as:
// ELTE/Corvinus: IP-18AA1E, IP-18PROGE, ELTE-FIZ1, CORV-FIN1
// BME: BMETE90AX00, BMEVIAUA000, BMEVITMA001, BMEGT41A001
const COURSE_CODE_REGEX = /\b([A-Z]{2,6}-[0-9A-Z]{2,10}|BME[0-9A-Z]{6,10})\b/gi;

/**
 * Extracts course / subject codes found within a summary or description text.
 */
export function extractCourseCodes(text: string, knownCodes?: string[]): string[] {
  if (!text || text.trim().length === 0) return [];

  const found = new Set<string>();

  // Check known codes first (case-insensitive)
  if (knownCodes && knownCodes.length > 0) {
    const lowerText = text.toLowerCase();
    for (const code of knownCodes) {
      if (lowerText.includes(code.toLowerCase())) {
        found.add(code.toUpperCase());
      }
    }
  }

  // Regex pattern search
  const matches = text.match(COURSE_CODE_REGEX);
  if (matches) {
    for (const match of matches) {
      found.add(match.toUpperCase());
    }
  }

  return Array.from(found).sort();
}

/**
 * Parses an iCalendar (.ics) string, expands recurring events up to maxWeeksAhead (16 weeks),
 * and extracts metadata (title, room, course codes).
 */
export function parseIcs(icsContent: string, options: ParseIcsOptions = {}): ParsedCalendarEvent[] {
  if (!icsContent || icsContent.trim().length === 0) return [];

  const maxWeeks = options.maxWeeksAhead ?? 16;
  const now = options.now ? new Date(options.now.getTime()) : new Date();

  // Range window: from 60 days ago (full current semester) up to maxWeeks in future
  const rangeStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(now.getTime() + maxWeeks * 7 * 24 * 60 * 60 * 1000);

  const parsed = nodeIcal.sync.parseICS(icsContent);
  const events: ParsedCalendarEvent[] = [];

  for (const key of Object.keys(parsed)) {
    const item = parsed[key];
    if (!item || item.type !== 'VEVENT') continue;

    const summary = (typeof item.summary === 'string' ? item.summary : '') || 'Untitled';
    // Neptun exports administrative task / grade-publication windows ("… - Feladat - Határidő: …") as VEVENTs
    // spanning up to 2+ months; skip them so only real classes/exams enter the schedule.
    if (/ - Feladat - Határidő:/i.test(summary)) continue;

    const description = typeof item.description === 'string' ? item.description : undefined;
    const room = typeof item.location === 'string' && item.location.trim().length > 0
      ? item.location.trim()
      : undefined;

    const fullText = `${summary} ${description ?? ''}`;
    const courseCodes = extractCourseCodes(fullText, options.knownSubjectCodes);
    const subjectCode = courseCodes.length > 0 ? courseCodes[0] : undefined;

    const uid = item.uid || key;

    // Recurring event with RRULE
    if (item.rrule) {
      const baseDurationMs =
        item.end && item.start
          ? new Date(item.end).getTime() - new Date(item.start).getTime()
          : 90 * 60 * 1000;

      // Expand occurrences in the target range
      let dates: Date[] = [];
      try {
        dates = item.rrule.between(rangeStart, rangeEnd, true);
      } catch {
        // Fallback if rrule fails: use original start if available
        if (item.start) dates = [new Date(item.start)];
      }

      // Check exception dates (EXDATE)
      const exdateSet = new Set<number>();
      if (item.exdate) {
        for (const ex of Object.values(item.exdate)) {
          if (ex instanceof Date) {
            exdateSet.add(ex.getTime());
          }
        }
      }

      for (const occurrenceDate of dates) {
        if (exdateSet.has(occurrenceDate.getTime())) continue;

        const occurrenceStart = new Date(occurrenceDate.getTime());
        const occurrenceEnd = new Date(occurrenceStart.getTime() + baseDurationMs);

        // Discard occurrences outside our target window
        if (occurrenceEnd.getTime() < rangeStart.getTime() || occurrenceStart.getTime() > rangeEnd.getTime()) {
          continue;
        }

        const externalUid = `${uid}_${occurrenceStart.toISOString()}`;

        events.push({
          externalUid,
          title: summary,
          start: occurrenceStart,
          end: occurrenceEnd,
          room,
          subjectCode,
          description,
        });
      }
    } else {
      // Single / non-recurring VEVENT
      if (!item.start || !item.end) continue;

      const eventStart = new Date(item.start);
      const eventEnd = new Date(item.end);

      // Discard events outside our target window
      if (eventEnd.getTime() < rangeStart.getTime() || eventStart.getTime() > rangeEnd.getTime()) {
        continue;
      }

      events.push({
        externalUid: uid,
        title: summary,
        start: eventStart,
        end: eventEnd,
        room,
        subjectCode,
        description,
      });
    }
  }

  // Sort events chronologically by start date
  events.sort((a, b) => a.start.getTime() - b.start.getTime());

  return events;
}
