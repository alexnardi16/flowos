import type { Commitment } from '../types';

export const TASK_ROLLOVER_STORAGE_KEY = 'flowos-task-rollover-date-v1';

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function utcDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function addLocalDay(value: string, days: number): string {
  const date = new Date(value);
  const next = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
  return next.toISOString();
}

function addUtcDay(value: string, days: number): string {
  const date = new Date(value);
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + days,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  ).toISOString();
}

function itemDateKey(item: Commitment): string | null {
  const value = item.dueAt ?? item.scheduledAt;
  if (!value) return null;
  return item.allDay ? utcDateKey(new Date(value)) : localDateKey(new Date(value));
}

export function rolloverIncompleteTasks(
  commitments: Commitment[],
  now: Date = new Date(),
): { commitments: Commitment[]; changed: Commitment[] } {
  const todayKey = localDateKey(now);
  const changed: Commitment[] = [];

  const next = commitments.map((item) => {
    if (item.kind !== 'task' || item.status === 'done' || item.deletedAt) return item;

    const value = item.dueAt ?? item.scheduledAt;
    const dateKey = itemDateKey(item);
    if (!value || !dateKey || dateKey >= todayKey) return item;

    const updated: Commitment = {
      ...item,
      ...(item.dueAt ? { dueAt: item.allDay ? addUtcDay(item.dueAt, 1) : addLocalDay(item.dueAt, 1) } : {}),
      ...(item.scheduledAt ? { scheduledAt: item.allDay ? addUtcDay(item.scheduledAt, 1) : addLocalDay(item.scheduledAt, 1) } : {}),
      syncStatus: item.externalId ? 'pending' : item.syncStatus,
    };
    changed.push(updated);
    return updated;
  });

  return { commitments: next, changed };
}

export function shouldRunTaskRollover(lastRunDateKey: string | null, now: Date = new Date()): boolean {
  return lastRunDateKey !== localDateKey(now);
}

export function getTaskRolloverDateKey(now: Date = new Date()): string {
  return localDateKey(now);
}
