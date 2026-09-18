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

export function buildDailySummary(commitments: Commitment[], now: Date = new Date(), targetDate: Date = now): DailySummary {
  const dateKey = toDateKey(targetDate);
  const active = commitments.filter((item) => item.status !== 'done' && !item.deletedAt);
  const scheduledToday = active
    .filter((item) => {
      const value = item.scheduledAt ?? item.dueAt;
      return Boolean(value && isSameCalendarDay(item, value, targetDate));
    })
    .sort((a, b) => {
      const av = a.scheduledAt ?? a.dueAt;
      const bv = b.scheduledAt ?? b.dueAt;
      if (!av) return 1;
      if (!bv) return -1;
      return new Date(av).getTime() - new Date(bv).getTime();
    });

  const overdue = targetDate.getTime() <= now.getTime()
    ? active.filter((item) => item.dueAt && isExpired(item, now))
    : [];

  const items: DailySummaryItem[] = scheduledToday.map((item) => {
    const value = item.scheduledAt ?? item.dueAt;
    return {
      id: item.id,
      title: item.title,
      time: value ? formatCommitmentTime(item, value) : undefined,
      kind: item.kind,
    };
  });

  const isTomorrow = dateKey !== toDateKey(now) && targetDate.getTime() > now.getTime();
  const prefix = isTomorrow ? 'Domani' : 'Oggi';
  const title = scheduledToday.length
    ? `${prefix} hai ${scheduledToday.length} impegn${scheduledToday.length === 1 ? 'o' : 'i'}`
    : `Nessun impegno pianificato per ${isTomorrow ? 'domani' : 'oggi'}`;

  const bodyParts: string[] = [];
  if (items.length) {
    bodyParts.push(items.map((item, index) => `${index + 1}. ${item.time ? `${item.time} · ` : ''}${item.title}`).join('\n'));
  }
  if (overdue.length) bodyParts.push(`${overdue.length} in ritardo da recuperare.`);
  if (!items.length && !overdue.length) bodyParts.push(isTomorrow ? 'Mattina libera.' : 'Giornata libera.');

  return { dateKey, title, body: bodyParts.join('\n'), scheduledCount: scheduledToday.length, overdueCount: overdue.length, items };
}
