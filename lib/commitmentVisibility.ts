import type { Commitment } from '../types';

export function eventEnd(item: Commitment): Date | null {
  if (item.kind !== 'event' || !item.scheduledAt || !item.durationMinutes) return null;
  return new Date(new Date(item.scheduledAt).getTime() + Math.max(1, item.durationMinutes) * 60000);
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

/** A completed multi-day event remains visible on its final calendar day only when it was completed before that day. */
export function isCompletedMultiDayVisible(item: Commitment, now = new Date()): boolean {
  if (item.kind !== 'event' || item.status !== 'done' || !item.completedAt) return false;
  const end = eventEnd(item);
  if (!end || item.durationMinutes <= 24 * 60) return false;
  const completed = new Date(item.completedAt);
  const todayKey = dateKey(now);
  const endKey = dateKey(end);
  const completedKey = dateKey(completed);
  return completedKey < endKey && todayKey === endKey;
}

export function isVisibleInToday(item: Commitment, now = new Date()): boolean {
  if (item.status !== 'done' && !item.deletedAt) {
    const value = item.scheduledAt ?? item.dueAt;
    if (!value) return false;
    const date = new Date(value);
    if (item.allDay) return date.getUTCFullYear() === now.getFullYear() && date.getUTCMonth() === now.getMonth() && date.getUTCDate() === now.getDate();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  }
  return isCompletedMultiDayVisible(item, now);
}

export function isVisibleCompletedMultiDayForDate(item: Commitment, date: Date): boolean {
  if (item.kind !== 'event' || item.status !== 'done' || !item.completedAt) return false;
  const end = eventEnd(item);
  if (!end || item.durationMinutes <= 24 * 60) return false;
  const completed = new Date(item.completedAt);
  return dateKey(completed) < dateKey(end) && dateKey(date) === dateKey(end);
}
