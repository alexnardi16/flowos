import type { Commitment, Energy } from '../types';

export type AvailabilityWindow = { startHour: number; endHour: number };
/** 0 = Sunday ... 6 = Saturday, matching Date#getDay(). Weekends default to no availability. */
export type WeeklyAvailability = Record<number, AvailabilityWindow[]>;

export const DEFAULT_WEEKLY_AVAILABILITY: WeeklyAvailability = {
  0: [],
  1: [{ startHour: 9, endHour: 13 }, { startHour: 14, endHour: 18 }],
  2: [{ startHour: 9, endHour: 13 }, { startHour: 14, endHour: 18 }],
  3: [{ startHour: 9, endHour: 13 }, { startHour: 14, endHour: 18 }],
  4: [{ startHour: 9, endHour: 13 }, { startHour: 14, endHour: 18 }],
  5: [{ startHour: 9, endHour: 13 }, { startHour: 14, endHour: 18 }],
  6: [],
};

const BUFFER_MINUTES = 10;
const SLOT_STEP_MINUTES = 10;

function energyWeight(energy: Energy) {
  return energy === 'high' ? 3 : energy === 'medium' ? 2 : 1;
}

function priority(item: Commitment) {
  const due = item.dueAt ? new Date(item.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  const urgency = due === Number.MAX_SAFE_INTEGER ? 0 : Math.max(0, 10 - Math.floor((due - Date.now()) / 86400000));
  return urgency * 10 + energyWeight(item.energy) * 2 + item.confidence;
}

function overlaps(start: Date, end: Date, item: Commitment) {
  if (!item.scheduledAt) return false;
  const itemStart = new Date(item.scheduledAt);
  const itemEnd = new Date(itemStart.getTime() + item.durationMinutes * 60000);
  return start < itemEnd && end > itemStart;
}

function windowsForDay(availability: WeeklyAvailability, date: Date): AvailabilityWindow[] {
  return availability[date.getDay()] ?? [];
}

/**
 * How well a candidate start time matches an item's energy level: high-energy
 * work fits best in the morning, low-energy work in the afternoon, medium
 * anywhere — a common circadian-productivity heuristic. Used to pick the best
 * of several open slots on the same day, not just the first one that fits.
 */
function energyTimeFit(energy: Energy, hour: number): number {
  const isMorning = hour < 13;
  if (energy === 'high') return isMorning ? 2 : 0;
  if (energy === 'low') return isMorning ? 0 : 2;
  return 1;
}

function candidateSlotsForDay(item: Commitment, date: Date, availability: WeeklyAvailability, now: Date): { start: Date; score: number }[] {
  const slots: { start: Date; score: number }[] = [];
  for (const window of windowsForDay(availability, date)) {
    let cursor = new Date(date);
    cursor.setHours(window.startHour, 0, 0, 0);
    const windowEnd = new Date(date);
    windowEnd.setHours(window.endHour, 0, 0, 0);

    if (cursor.toDateString() === now.toDateString() && cursor.getTime() < now.getTime()) {
      cursor = new Date(now.getTime() + BUFFER_MINUTES * 60000);
      cursor.setMinutes(Math.ceil(cursor.getMinutes() / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES, 0, 0);
    }

    while (cursor.getTime() + item.durationMinutes * 60000 <= windowEnd.getTime()) {
      slots.push({ start: new Date(cursor), score: energyTimeFit(item.energy, cursor.getHours()) });
      cursor = new Date(cursor.getTime() + SLOT_STEP_MINUTES * 60000);
    }
  }
  return slots;
}

/**
 * PlanningEngine: places flexible commitments into open availability
 * windows, working around fixed events, ordered by urgency/energy/confidence
 * priority, and — among the open slots on a given day — preferring the one
 * whose time of day best matches the task's energy level.
 */
export function createAutomaticPlan(
  commitments: Commitment[],
  availability: WeeklyAvailability = DEFAULT_WEEKLY_AVAILABILITY,
  now: Date = new Date(),
): Commitment[] {
  const fixed = commitments.filter((item) => item.fixed && item.scheduledAt && item.status !== 'done');
  // All-day fixed events (birthdays, "vacanza", etc.) span the entire day by
  // construction (duration 1440) — they must stay visible/scheduled, but
  // must not block every flexible slot that day.
  const blockingFixed = fixed.filter((item) => !item.allDay);
  const flexible = commitments
    .filter((item) => !item.fixed && item.status !== 'done')
    .sort((a, b) => priority(b) - priority(a));

  const scheduled: Commitment[] = [...blockingFixed];
  const replacements = new Map<string, Commitment>();

  for (const item of flexible) {
    let best: { start: Date; score: number } | null = null;

    for (let dayOffset = 0; dayOffset < 14 && !best; dayOffset += 1) {
      const day = new Date(now);
      day.setDate(day.getDate() + dayOffset);
      const open = candidateSlotsForDay(item, day, availability, now).filter(
        (slot) => !scheduled.some((existing) => overlaps(slot.start, new Date(slot.start.getTime() + item.durationMinutes * 60000), existing)),
      );
      if (open.length) {
        best = open.reduce((top, candidate) => (candidate.score > top.score ? candidate : top));
      }
    }

    if (best) {
      const updated: Commitment = { ...item, status: 'scheduled', scheduledAt: best.start.toISOString() };
      replacements.set(item.id, updated);
      scheduled.push(updated);
    }
  }

  return commitments.map((item) => replacements.get(item.id) ?? item);
}
