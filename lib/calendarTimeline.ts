import type { Commitment } from '../types';

export type CalendarTimeline = { weeks: Date[][]; startDate: Date; endDate: Date };

function validTimestamp(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

/** Shared navigable range for the in-app Calendar and Android Calendar widget. */
export function buildCalendarTimeline(commitments: Commitment[], syncEndDate: Date, now: Date = new Date()): CalendarTimeline {
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const datedValues = commitments.filter((item) => !item.deletedAt).flatMap((item) => {
    const start = validTimestamp(item.scheduledAt ?? item.dueAt);
    if (start === undefined) return [];
    const values = [start];
    if (item.scheduledAt && item.durationMinutes > 0) values.push(start + item.durationMinutes * 60_000);
    return values;
  });
  const startDate = new Date(Math.min(yearStart.getTime(), ...(datedValues.length ? datedValues : [yearStart.getTime()])));
  const firstMonday = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  firstMonday.setDate(firstMonday.getDate() - ((firstMonday.getDay() + 6) % 7));
  const syncEnd = Number.isFinite(syncEndDate.getTime()) ? syncEndDate.getTime() : now.getTime();
  const latestTimestamp = Math.max(now.getTime(), syncEnd, ...(datedValues.length ? datedValues : [now.getTime()]));
  const endDate = new Date(latestTimestamp);
  const weeks: Date[][] = [];
  for (let index = 0; ; index += 1) {
    const monday = new Date(firstMonday);
    monday.setDate(firstMonday.getDate() + index * 7);
    if (monday.getTime() > endDate.getTime()) break;
    weeks.push(Array.from({ length: 7 }, (_, dayIndex) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + dayIndex);
      return day;
    }));
  }
  return { weeks, startDate, endDate };
}
