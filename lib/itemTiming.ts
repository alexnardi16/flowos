import type { Commitment } from '../types';

const DAY_MS = 86400000;

function startTime(item: Commitment): number | null {
  const value = item.scheduledAt ?? item.dueAt;
  return value ? new Date(value).getTime() : null;
}

/** Google Tasks' `due` field is always exactly midnight UTC — it has no time-of-day component at all, by design of Google's API. A dueAt at exactly :00:00.000 UTC with no scheduledAt is that kind of date-only deadline. */
function isDateOnlyDeadline(item: Commitment): boolean {
  if (item.scheduledAt || !item.dueAt) return false;
  const d = new Date(item.dueAt);
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

/**
 * The instant this item stops being "current". For a normal timed item,
 * that's start + duration. For a date-only deadline (a Google Tasks due
 * date, which never carries a time — see isDateOnlyDeadline), the item's
 * own durationMinutes (how long the task takes to do, e.g. 30 minutes)
 * says nothing about when in the day it's still relevant, so the deadline
 * is treated as lasting the whole day: it only expires at midnight of the
 * NEXT day. Without this, a task due "today" reads as overdue by ~00:30,
 * even though "due today" normally means "due by the end of today".
 */
export function getEndTime(item: Commitment): number | null {
  const start = startTime(item);
  if (start === null) return null;
  if (isDateOnlyDeadline(item)) return start + DAY_MS;
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
