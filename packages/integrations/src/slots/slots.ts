import type { TimeSlot } from '../ports';

/**
 * Normalizes and merges overlapping or contiguous time slots.
 * Invalid slots where start >= end are discarded.
 * Returns slots sorted chronologically.
 */
export function mergeSlots(slots: TimeSlot[]): TimeSlot[] {
  const valid = slots
    .filter((s) => s.end.getTime() > s.start.getTime())
    .map((s) => ({
      start: new Date(s.start.getTime()),
      end: new Date(s.end.getTime()),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());

  if (valid.length === 0) return [];

  const merged: TimeSlot[] = [valid[0]];

  for (let i = 1; i < valid.length; i++) {
    const current = valid[i];
    const last = merged[merged.length - 1];

    if (current.start.getTime() <= last.end.getTime()) {
      if (current.end.getTime() > last.end.getTime()) {
        last.end = current.end;
      }
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Subtracts busy slots from source available slots.
 * Any resulting slot shorter than minMinutes is dropped.
 */
export function subtractSlots(
  source: TimeSlot[],
  busy: TimeSlot[],
  minMinutes = 0,
): TimeSlot[] {
  const mergedSource = mergeSlots(source);
  const mergedBusy = mergeSlots(busy);
  const minMs = minMinutes * 60 * 1000;

  const result: TimeSlot[] = [];

  for (const src of mergedSource) {
    let currentStart = src.start.getTime();
    const srcEnd = src.end.getTime();

    for (const b of mergedBusy) {
      const bStart = b.start.getTime();
      const bEnd = b.end.getTime();

      // If busy ends before current available window, skip
      if (bEnd <= currentStart) continue;

      // If busy starts after source window, we're done with this busy slot
      if (bStart >= srcEnd) break;

      // If there is free time before this busy slot starts
      if (bStart > currentStart) {
        if (bStart - currentStart >= minMs) {
          result.push({
            start: new Date(currentStart),
            end: new Date(bStart),
          });
        }
      }

      // Advance currentStart past this busy slot
      currentStart = Math.max(currentStart, bEnd);
      if (currentStart >= srcEnd) break;
    }

    // Remaining segment after all busy slots
    if (srcEnd - currentStart >= minMs) {
      result.push({
        start: new Date(currentStart),
        end: new Date(srcEnd),
      });
    }
  }

  return result;
}

/**
 * Finds the intersection between two slot lists.
 * Only intersections with duration >= minMinutes (default 30) are returned.
 */
export function intersectSlots(
  a: TimeSlot[],
  b: TimeSlot[],
  minMinutes = 30,
): TimeSlot[] {
  const mergedA = mergeSlots(a);
  const mergedB = mergeSlots(b);
  const minMs = minMinutes * 60 * 1000;

  const result: TimeSlot[] = [];
  let i = 0;
  let j = 0;

  while (i < mergedA.length && j < mergedB.length) {
    const slotA = mergedA[i];
    const slotB = mergedB[j];

    const start = Math.max(slotA.start.getTime(), slotB.start.getTime());
    const end = Math.min(slotA.end.getTime(), slotB.end.getTime());

    if (end - start >= minMs) {
      result.push({
        start: new Date(start),
        end: new Date(end),
      });
    }

    if (slotA.end.getTime() < slotB.end.getTime()) {
      i++;
    } else if (slotB.end.getTime() < slotA.end.getTime()) {
      j++;
    } else {
      i++;
      j++;
    }
  }

  return result;
}

/**
 * Computes the intersection of N slot lists.
 */
export function intersectMultipleSlots(
  slotLists: TimeSlot[][],
  minMinutes = 30,
): TimeSlot[] {
  if (slotLists.length === 0) return [];
  if (slotLists.length === 1) {
    return mergeSlots(slotLists[0]).filter(
      (s) => s.end.getTime() - s.start.getTime() >= minMinutes * 60 * 1000,
    );
  }

  let current = slotLists[0];
  for (let i = 1; i < slotLists.length; i++) {
    current = intersectSlots(current, slotLists[i], minMinutes);
    if (current.length === 0) return [];
  }

  return current;
}

/** Duration in minutes of a single slot */
export function slotDurationMinutes(slot: TimeSlot): number {
  return Math.max(0, Math.round((slot.end.getTime() - slot.start.getTime()) / (60 * 1000)));
}

/** Total duration in minutes of a list of non-overlapping slots */
export function totalDurationMinutes(slots: TimeSlot[]): number {
  const merged = mergeSlots(slots);
  return merged.reduce((acc, s) => acc + slotDurationMinutes(s), 0);
}

