import type { Commitment } from '../types';
import { isSameCalendarDay, formatCommitmentTime } from './allDayDate';
import { isExpired } from './itemTiming';

export type DailySummaryItem = {
  id: string;
  title: string;
  time?: string;
  kind: Commitment['kind'];
};

export type DailySummary = {
  dateKey: string;
  title: string;
  body: string;
  scheduledCount: number;
  overdueCount: number;
  items: DailySummaryItem[];
};

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Pure function: given the current commitments and a reference instant, builds
 * the notification-ready daily summary. No I/O, no Expo/RN imports, so it can
 * be unit tested directly with node:test the same way lib/authFlow.ts is.
 */
export function buildDailySummary(commitments: Commitment[], now: Date = new Date()): DailySummary {
  const dateKey = toDateKey(now);
  const active = commitments.filter((item) => item.status !== 'done' && !item.deletedAt);

  const scheduledToday = active
    .filter((item) => item.scheduledAt && isSameCalendarDay(item, item.scheduledAt, now))
    .sort((a, b) => new Date(a.scheduledAt as string).getTime() - new Date(b.scheduledAt as string).getTime());

  const overdue = active.filter((item) => item.dueAt && isExpired(item, now));

  const items: DailySummaryItem[] = scheduledToday.map((item) => ({
    id: item.id,
    title: item.title,
    time: item.scheduledAt ? formatCommitmentTime(item, item.scheduledAt) : undefined,
    kind: item.kind,
  }));

  const title = scheduledToday.length
    ? `Oggi hai ${scheduledToday.length} impegn${scheduledToday.length === 1 ? 'o' : 'i'}`
    : 'Nessun impegno pianificato per oggi';

  const bodyParts: string[] = [];
  if (scheduledToday.length) {
    const first = scheduledToday[0];
    const firstLabel = first.scheduledAt ? `${formatCommitmentTime(first, first.scheduledAt)} · ${first.title}` : first.title;
    bodyParts.push(`Il primo è ${firstLabel}.`);
  }
  if (overdue.length) {
    bodyParts.push(`${overdue.length} in ritardo da recuperare.`);
  }
  if (!scheduledToday.length && !overdue.length) {
    bodyParts.push('Giornata libera: buon momento per pianificare.');
  }

  return {
    dateKey,
    title,
    body: bodyParts.join(' '),
    scheduledCount: scheduledToday.length,
    overdueCount: overdue.length,
    items,
  };
}
