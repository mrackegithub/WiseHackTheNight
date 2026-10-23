import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { describe, expect, it, vi } from 'vitest';
import type { Schemas } from '@sgm/contracts';
import { ZONE } from '../../lib/time';
import { computeVisibleRange, place } from './visible-range';
import { WeekView } from './WeekView';

describe('WeekView - computeVisibleRange', () => {
  const weekStart = DateTime.fromISO('2026-10-12T00:00:00', { zone: ZONE });
  const days = Array.from({ length: 7 }, (_, i) => weekStart.plus({ days: i }));

  it('defaults to 7–21 when there are no events', () => {
    expect(computeVisibleRange([], days)).toEqual({ startHour: 7, endHour: 21 });
  });

  it('keeps 7–21 when events are inside normal daytime hours', () => {
    const events: Schemas['CalendarEvent'][] = [
      {
        id: '1',
        title: 'Algorithms',
        start: '2026-10-12T10:00:00+02:00',
        end: '2026-10-12T12:00:00+02:00',
        room: null,
        subjectCode: null,
        source: 'MANUAL',
        category: 'STUDY',
      },
    ];
    expect(computeVisibleRange(events, days)).toEqual({ startHour: 7, endHour: 21 });
  });

  it('expands start hour when an early morning event exists', () => {
    const events: Schemas['CalendarEvent'][] = [
      {
        id: '1',
        title: 'Early workout',
        start: '2026-10-12T05:15:00+02:00',
        end: '2026-10-12T06:45:00+02:00',
        room: null,
        subjectCode: null,
        source: 'MANUAL',
        category: 'OTHER',
      },
    ];
    expect(computeVisibleRange(events, days)).toEqual({ startHour: 5, endHour: 21 });
  });

  it('expands end hour when a late evening event exists', () => {
    const events: Schemas['CalendarEvent'][] = [
      {
        id: '1',
        title: 'Late hackathon session',
        start: '2026-10-12T20:00:00+02:00',
        end: '2026-10-12T22:30:00+02:00',
        room: null,
        subjectCode: null,
        source: 'MANUAL',
        category: 'STUDY',
      },
    ];
    expect(computeVisibleRange(events, days)).toEqual({ startHour: 7, endHour: 23 });
  });

  it('expands to 0–24 for overnight events crossing midnight', () => {
    const events: Schemas['CalendarEvent'][] = [
      {
        id: '1',
        title: 'Night shift',
        start: '2026-10-12T22:00:00+02:00',
        end: '2026-10-13T02:00:00+02:00',
        room: null,
        subjectCode: null,
        source: 'MANUAL',
        category: 'WORK',
      },
    ];
    expect(computeVisibleRange(events, days)).toEqual({ startHour: 0, endHour: 24 });
  });

  it('clamps range to 0–24', () => {
    const events: Schemas['CalendarEvent'][] = [
      {
        id: '1',
        title: 'Full night',
        start: '2026-10-12T00:00:00+02:00',
        end: '2026-10-13T04:00:00+02:00',
        room: null,
        subjectCode: null,
        source: 'MANUAL',
        category: 'WORK',
      },
    ];
    const { startHour, endHour } = computeVisibleRange(events, days);
    expect(startHour).toBeGreaterThanOrEqual(0);
    expect(endHour).toBeLessThanOrEqual(24);
  });
});

describe('WeekView - place function clipping', () => {
  const monday = DateTime.fromISO('2026-10-12T00:00:00', { zone: ZONE });
  const tuesday = DateTime.fromISO('2026-10-13T00:00:00', { zone: ZONE });
  const wednesday = DateTime.fromISO('2026-10-14T00:00:00', { zone: ZONE });

  it('clips overnight events to the Monday column and Tuesday column without negative heights', () => {
    const start = '2026-10-12T22:00:00+02:00';
    const end = '2026-10-13T02:00:00+02:00';

    // Monday column: 22:00–24:00 (2 hours)
    const monBlock = place(monday, start, end, 'ev-1', 0, 24);
    expect(monBlock).not.toBeNull();
    expect(monBlock!.top).toBe(22 * 44);
    expect(monBlock!.height).toBe(2 * 44);

    // Tuesday column: 00:00–02:00 (2 hours)
    const tueBlock = place(tuesday, start, end, 'ev-1', 0, 24);
    expect(tueBlock).not.toBeNull();
    expect(tueBlock!.top).toBe(0);
    expect(tueBlock!.height).toBe(2 * 44);

    // Wednesday column: null
    const wedBlock = place(wednesday, start, end, 'ev-1', 0, 24);
    expect(wedBlock).toBeNull();
  });

  it('returns null and does not produce negative heights when event is outside visible hours', () => {
    // 04:00–06:00 when grid is 07:00–21:00
    const block = place(monday, '2026-10-12T04:00:00+02:00', '2026-10-12T06:00:00+02:00', 'ev-2', 7, 21);
    expect(block).toBeNull();
  });
});

describe('WeekView component', () => {
  const weekStart = DateTime.fromISO('2026-10-12T00:00:00', { zone: ZONE });

  it('renders overnight events in both day columns and handles onSelectEvent', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const events: Schemas['CalendarEvent'][] = [
      {
        id: 'overnight-1',
        title: 'Night Lab',
        start: '2026-10-12T22:00:00+02:00',
        end: '2026-10-13T02:00:00+02:00',
        room: 'IB028',
        subjectCode: null,
        source: 'MANUAL',
        category: 'STUDY',
      },
    ];

    render(<WeekView weekStart={weekStart} events={events} freeSlots={[]} onSelectEvent={onSelect} />);

    // Since overnight event expands to 0–24, hour labels 00:00 and 23:00 exist
    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(screen.getByText('23:00')).toBeInTheDocument();

    const monday = screen.getByRole('region', { name: 'Monday 12 October' });
    const tuesday = screen.getByRole('region', { name: 'Tuesday 13 October' });
    const wednesday = screen.getByRole('region', { name: 'Wednesday 14 October' });

    expect(within(monday).getByRole('button', { name: /Night Lab/ })).toBeInTheDocument();
    expect(within(tuesday).getByRole('button', { name: /Night Lab/ })).toBeInTheDocument();
    expect(within(wednesday).queryByRole('button', { name: /Night Lab/ })).not.toBeInTheDocument();

    await user.click(within(monday).getByRole('button', { name: /Night Lab/ }));
    expect(onSelect).toHaveBeenCalledWith(events[0]);
  });
});
