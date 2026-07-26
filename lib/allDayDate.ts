import type { Commitment } from '../types';

/**
 * All-day events are stored as UTC midnight for the calendar day Google
 * reports (e.g. "2026-07-25T00:00:00.000Z"), because that's what an all-day
 * event actually is: a calendar day, not an instant in time. Reading that
 * value with local getters shifts it by the viewer's UTC offset — in
 * Europe/Paris during CEST (UTC+2) it displays as 02:00 instead of
 * midnight, which is exactly the bug this fixes. All-day items must always
 * be read with UTC getters; everything else keeps using local time as
 * before.
 */
export function commitmentDateParts(item: Commitment, isoDate: string) {
  const date = new Date(isoDate);
  if (item.allDay) {
    return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate(), hours: 0, minutes: 0 };
  }
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate(), hours: date.getHours(), minutes: date.getMinutes() };
}

export function isSameCalendarDay(item: Commitment, isoDate: string, reference: Date): boolean {
  const parts = commitmentDateParts(item, isoDate);
  return parts.year === reference.getFullYear() && parts.month === reference.getMonth() && parts.day === reference.getDate();
}

export function formatCommitmentTime(item: Commitment, isoDate: string): string {
  if (item.allDay) return 'Tutto il giorno';
  const parts = commitmentDateParts(item, isoDate);
  return `${String(parts.hours).padStart(2, '0')}:${String(parts.minutes).padStart(2, '0')}`;
}
