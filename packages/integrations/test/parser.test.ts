import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractCourseCodes, parseIcs } from '../src/neptun/parser';

describe('extractCourseCodes', () => {
  it('returns empty array on empty input', () => {
    expect(extractCourseCodes('')).toEqual([]);
    expect(extractCourseCodes('   ')).toEqual([]);
  });

  it('extracts ELTE style course codes (IP-18...)', () => {
    const text = 'Algorithms and Data Structures I (IP-18AA1E) - Lecture';
    expect(extractCourseCodes(text)).toEqual(['IP-18AA1E']);
  });

  it('extracts BME style course codes (BME...)', () => {
    const text = 'Calculus I - BMETE90AX00 and Digital Design (BMEVIAUA000)';
    expect(extractCourseCodes(text)).toEqual(['BMETE90AX00', 'BMEVIAUA000']);
  });

  it('extracts university prefix codes like ELTE-FIZ1 and CORV-FIN1', () => {
    const text = 'Physics class ELTE-FIZ1 and Finance CORV-FIN1';
    expect(extractCourseCodes(text)).toEqual(['CORV-FIN1', 'ELTE-FIZ1']);
  });

  it('matches codes provided in knownSubjectCodes list', () => {
    const text = 'Special class for web-intro course';
    const known = ['WEB-INTRO', 'OTHER-CODE'];
    expect(extractCourseCodes(text, known)).toEqual(['WEB-INTRO']);
  });

  it('deduplicates multiple mentions of the same course code', () => {
    const text = 'IP-18AA1E in summary, Tantárgykód: IP-18AA1E in description';
    expect(extractCourseCodes(text)).toEqual(['IP-18AA1E']);
  });
});

describe('parseIcs with fixtures', () => {
  const fixturesDir = resolve(__dirname, 'fixtures');

  it('parses realistic neptun-export.ics fixture correctly', () => {
    const icsContent = readFileSync(resolve(fixturesDir, 'neptun-export.ics'), 'utf8');
    const referenceDate = new Date('2026-10-18T00:00:00Z');

    const events = parseIcs(icsContent, { now: referenceDate });
    expect(events).toHaveLength(3);

    // Event 1: IP-18AA1E
    const ev1 = events[0];
    expect(ev1.externalUid).toBe('neptun-event-101@bme.hu');
    expect(ev1.title).toContain('IP-18AA1E');
    expect(ev1.subjectCode).toBe('IP-18AA1E');
    expect(ev1.room).toBe('IB 028');
    expect(ev1.start.toISOString()).toBe('2026-10-19T06:00:00.000Z');
    expect(ev1.end.toISOString()).toBe('2026-10-19T07:30:00.000Z');

    // Event 2: BMETE90AX00
    const ev2 = events[1];
    expect(ev2.externalUid).toBe('neptun-event-102@bme.hu');
    expect(ev2.subjectCode).toBe('BMETE90AX00');
    expect(ev2.room).toBe('Q-II');

    // Event 3: BMEVIAUA000
    const ev3 = events[2];
    expect(ev3.externalUid).toBe('neptun-event-103@bme.hu');
    expect(ev3.subjectCode).toBe('BMEVIAUA000');
    expect(ev3.room).toBe('I.E.224');
  });

  it('expands weekly recurring events via RRULE up to 16 weeks ahead', () => {
    const icsContent = readFileSync(resolve(fixturesDir, 'recurring-rrule.ics'), 'utf8');
    const referenceDate = new Date('2026-10-18T00:00:00Z');

    const events = parseIcs(icsContent, {
      now: referenceDate,
      maxWeeksAhead: 16,
    });

    // The fixture contains two recurring events:
    // Event 1 (IP-18PROGE): weekly Mondays from 2026-10-19 until 2026-12-21 (10 weeks)
    // Event 2 (BMETE90AX21): COUNT=6 weekly Tuesdays from 2026-10-20, with EXDATE on 2026-11-03 (5 active occurrences)
    expect(events.length).toBeGreaterThan(10);

    const progeEvents = events.filter((e) => e.subjectCode === 'IP-18PROGE');
    expect(progeEvents.length).toBe(10);

    // Verify all occurrences have deterministic externalUids with timestamp suffix
    expect(progeEvents[0].externalUid).toContain('neptun-recurring-201@elte.hu');
    expect(progeEvents[0].start.toISOString()).toBe('2026-10-19T08:00:00.000Z');
    expect(progeEvents[1].start.toISOString()).toBe('2026-10-26T08:00:00.000Z');
    expect(progeEvents[0].room).toBe('Déli tömb 0-823');

    // Verify EXDATE was respected: 2026-11-03 must not exist
    const algebraEvents = events.filter((e) => e.subjectCode === 'BMETE90AX21');
    expect(algebraEvents.length).toBe(5);
    const exdateIso = '2026-11-03T10:00:00.000Z';
    expect(algebraEvents.some((e) => e.start.toISOString() === exdateIso)).toBe(false);
  });

  it('gracefully handles corrupted or empty ICS content', () => {
    const corrupted = readFileSync(resolve(fixturesDir, 'corrupted.ics'), 'utf8');
    expect(parseIcs(corrupted)).toEqual([]);
    expect(parseIcs('')).toEqual([]);
    expect(parseIcs('   ')).toEqual([]);
  });
});
