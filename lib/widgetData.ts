import type { Commitment } from '../types';
import { toDateKey } from './dailySummary';

export type TodayGlance = {
  dateKey: string;
  nextEventTitle: string | null;
  nextEventTime: string | null;
  dueSoonCount: number;
  overdueCount: number;
  generatedAt: string;
};

function isActive(item: Commitment): boolean {
  return item.status !== 'done' && !item.deletedAt;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Pure function: the small snapshot a home-screen widget needs — next
 * upcoming event and how many tasks are due-soon/overdue. No I/O, no
 * Expo/RN imports, same approach as lib/dailySummary.ts and lib/reminderPlan.ts.
 */
export function buildTodayGlance(commitments: Commitment[], now: Date = new Date()): TodayGlance {
  const active = commitments.filter(isActive);

  const nextEvent = active
    .filter((item) => item.kind === 'event' && item.scheduledAt && new Date(item.scheduledAt).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.scheduledAt as string).getTime() - new Date(b.scheduledAt as string).getTime())[0];

  const dueTasks = active.filter((item) => item.kind === 'task' && item.dueAt);
  const dueSoonCount = dueTasks.filter((item) => {
    const diffHours = (new Date(item.dueAt as string).getTime() - now.getTime()) / 3600000;
    return diffHours > 0 && diffHours <= 24;
  }).length;
  const overdueCount = dueTasks.filter((item) => new Date(item.dueAt as string).getTime() < now.getTime()).length;

  return {
    dateKey: toDateKey(now),
    nextEventTitle: nextEvent ? nextEvent.title : null,
    nextEventTime: nextEvent?.scheduledAt ? formatTime(new Date(nextEvent.scheduledAt)) : null,
    dueSoonCount,
    overdueCount,
    generatedAt: now.toISOString(),
  };
}
