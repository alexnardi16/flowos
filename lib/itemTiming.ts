import type { Commitment } from '../types';

const DAY_MS = 86400000;

function startTime(item: Commitment): number | null {
  const value = item.scheduledAt ?? item.dueAt;
  return value ? new Date(value).getTime() : null;
}

function isDateOnlyDeadline(item: Commitment): boolean {
  if (item.scheduledAt || !item.dueAt) return false;
  const d = new Date(item.dueAt);
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

/** All-day items are calendar-day commitments: they expire at the local midnight after their last day, never at the start of today. */
function allDayEndTime(item: Commitment): number | null {
  const value = item.scheduledAt ?? item.dueAt;
  if (!value) return null;
  const d = new Date(value);
  const totalDays = Math.max(1, Math.round(item.durationMinutes / 1440));
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + totalDays).getTime();
}

export function getEndTime(item: Commitment): number | null {
  if (item.allDay) return allDayEndTime(item);
  const start = startTime(item);
  if (start === null) return null;
  if (isDateOnlyDeadline(item)) return start + DAY_MS;
  return start + item.durationMinutes * 60000;
}

export function isExpired(item: Commitment, now: Date = new Date()): boolean {
  const end = getEndTime(item);
  if (end === null) return false;
  return end <= now.getTime();
}

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
