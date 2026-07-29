import type { Commitment } from '../types';
import { toDateKey } from './dailySummary';
import { isExpired } from './itemTiming';

export const DUE_SOON_WINDOW_HOURS = 24;

export type DueTask = { id: string; title: string; dueAt: string };

export type ReminderPlan = {
  dateKey: string;
  dueSoon: DueTask[];
  overdue: DueTask[];
  badgeCount: number;
};

function isActive(item: Commitment): boolean {
  return item.status !== 'done' && !item.deletedAt;
}

/**
 * Pure function: given the current commitments and a reference instant,
 * decides which tasks count as "in scadenza" (due within the next 24h) and
 * which as "scadute" (past their end time). No I/O, no Expo/RN imports —
 * same testing approach as lib/dailySummary.ts. Per-item reminder
 * notifications (configurable, possibly several per item) are handled
 * separately by lib/customReminders.ts.
 */
export function buildReminderPlan(commitments: Commitment[], now: Date = new Date()): ReminderPlan {
  const active = commitments.filter(isActive);

  const dueTasks = active.filter((item) => item.kind === 'task' && item.dueAt);

  const dueSoon: DueTask[] = dueTasks
    .filter((item) => {
      const diffHours = (new Date(item.dueAt as string).getTime() - now.getTime()) / 3600000;
      return diffHours > 0 && diffHours <= DUE_SOON_WINDOW_HOURS;
    })
    .map((item) => ({ id: item.id, title: item.title, dueAt: item.dueAt as string }))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  const overdue: DueTask[] = dueTasks
    .filter((item) => isExpired(item, now))
    .map((item) => ({ id: item.id, title: item.title, dueAt: item.dueAt as string }))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  return {
    dateKey: toDateKey(now),
    dueSoon,
    overdue,
    badgeCount: dueSoon.length + overdue.length,
  };
}

/** Builds the grouped-notification body for a list of due/overdue tasks. */
export function summarizeTaskList(tasks: DueTask[], maxNamed = 3): string {
  if (!tasks.length) return '';
  const named = tasks.slice(0, maxNamed).map((task) => task.title);
  const remaining = tasks.length - named.length;
  return remaining > 0 ? `${named.join(', ')} e altri ${remaining}` : named.join(', ');
}
