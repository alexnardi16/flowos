import type { Commitment } from '../types';
import { isExpired } from './itemTiming';

export function isOverdueTask(item: Commitment, now = new Date()): boolean {
  return item.kind === 'task' && item.status !== 'done' && !item.deletedAt && isExpired(item, now);
}

export function eventEnd(item: Commitment): Date | null {
  if (item.kind !== 'event' || !item.scheduledAt || !item.durationMinutes) return null;
  const end = new Date(new Date(item.scheduledAt).getTime() + Math.max(1, item.durationMinutes) * 60000);
  return Number.isFinite(end.getTime()) ? end : null;
}

/** True for every local calendar day intersected by an event's [start, end) interval. */
export function eventOccursOnDate(item: Commitment, date: Date): boolean {
  const end = eventEnd(item);
  if (!end || !item.scheduledAt || !Number.isFinite(date.getTime())) return false;
  const start = new Date(item.scheduledAt);
  if (!Number.isFinite(start.getTime())) return false;
  if (item.allDay) {
    const dayStart = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    return start.getTime() < dayEnd && end.getTime() > dayStart;
  }
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return start.getTime() < dayEnd.getTime() && end.getTime() > dayStart.getTime();
}

/** Returns each local calendar day touched by the event, without duplicating the event itself. */
export function eventDayDates(item: Commitment): Date[] {
  const end = eventEnd(item);
  if (!end || !item.scheduledAt) return [];
  const start = new Date(item.scheduledAt);
  if (!Number.isFinite(start.getTime())) return [];
  const day = item.allDay
    ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
    : new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const dates: Date[] = [];
  while (day.getTime() < end.getTime()) {
    dates.push(new Date(day));
    if (item.allDay) day.setUTCDate(day.getUTCDate() + 1);
    else day.setDate(day.getDate() + 1);
  }
  return dates;
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

/** A completed multi-day event remains part of its planned duration only if completed before its end. */
export function isCompletedMultiDayEvent(item: Commitment): boolean {
  if (item.kind !== 'event' || item.status !== 'done' || !item.completedAt || item.durationMinutes <= 24 * 60) return false;
  const end = eventEnd(item);
  const completed = new Date(item.completedAt);
  return Boolean(end && Number.isFinite(completed.getTime()) && dateKey(completed) < dateKey(end));
}

export function isCompletedMultiDayVisible(item: Commitment, now = new Date()): boolean {
  return isCompletedMultiDayEvent(item) && eventOccursOnDate(item, now);
}

export function isVisibleInToday(item: Commitment, now = new Date()): boolean {
  if (item.status !== 'done' && !item.deletedAt) {
    if (isOverdueTask(item, now)) return true;
    if (item.kind === 'event') return eventOccursOnDate(item, now);
    const value = item.scheduledAt ?? item.dueAt;
    if (!value) return false;
    const date = new Date(value);
    if (item.allDay) return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getMonth() && date.getUTCDate() === now.getDate();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  }
  return isCompletedMultiDayVisible(item, now);
}

export function isVisibleCompletedMultiDayForDate(item: Commitment, date: Date): boolean {
  if (item.kind !== 'event' || item.status !== 'done' || !item.completedAt) return false;
  const end = eventEnd(item);
  if (!end || item.durationMinutes <= 24 * 60) return false;
  const completed = new Date(item.completedAt);
  return dateKey(completed) < dateKey(end) && (dateKey(date) === dateKey(end) || eventOccursOnDate(item, date));
}
