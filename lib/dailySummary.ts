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
    .filter((item) => item.scheduledAt && isSameCalendarDay(item, item.scheduledAt, targetDate))
    .sort((a, b) => new Date(a.scheduledAt as string).getTime() - new Date(b.scheduledAt as string).getTime());
  const overdue = targetDate.getTime() <= now.getTime()
    ? active.filter((item) => item.dueAt && isExpired(item, now))
    : [];
  const items: DailySummaryItem[] = scheduledToday.map((item) => ({
    id: item.id,
    title: item.title,
    time: item.scheduledAt ? formatCommitmentTime(item, item.scheduledAt) : undefined,
    kind: item.kind,
  }));
  const isTomorrow = dateKey !== toDateKey(now) && targetDate.getTime() > now.getTime();
  const prefix = isTomorrow ? 'Domani' : 'Oggi';
  const title = scheduledToday.length
    ? `${prefix} hai ${scheduledToday.length} impegn${scheduledToday.length === 1 ? 'o' : 'i'}`
    : `Nessun impegno pianificato per ${isTomorrow ? 'domani' : 'oggi'}`;
  const bodyParts: string[] = [];
  if (scheduledToday.length) {
    const first = scheduledToday[0];
    const firstLabel = first.scheduledAt ? `${formatCommitmentTime(first, first.scheduledAt)} · ${first.title}` : first.title;
    bodyParts.push(`Il primo è ${firstLabel}.`);
  }
  if (overdue.length) bodyParts.push(`${overdue.length} in ritardo da recuperare.`);
  if (!scheduledToday.length && !overdue.length) bodyParts.push(isTomorrow ? 'Mattina libera: nessun impegno pianificato.' : 'Giornata libera: buon momento per pianificare.');
  return { dateKey, title, body: bodyParts.join(' '), scheduledCount: scheduledToday.length, overdueCount: overdue.length, items };
}
