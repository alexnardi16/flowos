import type { Commitment } from '../types';

const DAY_MS = 86400000;

function startTime(item: Commitment): number | null {
  const value = item.scheduledAt ?? item.dueAt;
  return value ? new Date(value).getTime() : null;
}

/** The instant this item stops being "current" — start + duration, not just the start time. */
export function getEndTime(item: Commitment): number | null {
  const start = startTime(item);
  if (start === null) return null;
  return start + item.durationMinutes * 60000;
}

/**
 * "Scaduto" means past the END of the item, not its start. An all-day (or
 * multi-day all-day) item only expires at midnight of the day after its
 * last day — which falls out naturally from end = start + duration, since
 * an all-day item's durationMinutes already spans full calendar days.
 */
export function isExpired(item: Commitment, now: Date = new Date()): boolean {
  const end = getEndTime(item);
  if (end === null) return false;
  return end < now.getTime();
}

/**
 * "24 h" reads as "1 d" for a single all-day item. A multi-day all-day item
 * (a several-day trip, etc.) shows its total day count plus which day of
 * the span `now` falls on, e.g. "6 d (5° giorno)" — instead of repeating as
 * a plain "24 h" entry on every one of its days.
 */
export function formatDurationLabel(item: Commitment, now: Date = new Date()): string {
  if (item.allDay) {
    const totalDays = Math.max(1, Math.round(item.durationMinutes / 1440));
    if (totalDays <= 1) return '1 d';
    const start = startTime(item);
    if (start === null) return `${totalDays} d`;
    const startDate = new Date(start);
    const startDayUtc = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
    const nowDayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const dayIndex = Math.min(Math.max(Math.floor((nowDayUtc - startDayUtc) / DAY_MS) + 1, 1), totalDays);
    return `${totalDays} d (${dayIndex}° giorno)`;
  }
  const total = Math.max(0, Math.round(item.durationMinutes));
  const h = Math.floor(total / 60), m = total % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}
