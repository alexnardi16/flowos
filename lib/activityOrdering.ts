import type { Commitment } from '../types';

export type ActivitySourceKind = 'french-holidays' | 'italian-holidays' | 'alex' | 'alex-chiara' | 'priority-task' | 'unprioritized-task' | 'other';

function sourceKindFromName(name?: string): ActivitySourceKind {
  const n = (name ?? '').toLocaleLowerCase('it-IT').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/(jours? feries|fetes? francaises|fetes? en france|public holidays.*france|france.*holidays)/.test(n)) return 'french-holidays';
  if (/(festivita|feste italiane|italia.*fest|italian holidays|holidays.*italy)/.test(n)) return 'italian-holidays';
  if (/(alex[\s_-]*(?:&|e|and)[\s_-]*chiara|chiara[\s_-]*(?:&|e|and)[\s_-]*alex)/.test(n)) return 'alex-chiara';
  if (n === 'alex' || /^alex\b/.test(n)) return 'alex';
  return 'other';
}

export function activitySourceKind(item: Commitment, calendarName?: string): ActivitySourceKind {
  if (item.kind === 'task') return Number.isFinite(item.priority) && (item.priority ?? 0) > 0 ? 'priority-task' : 'unprioritized-task';
  return sourceKindFromName(calendarName);
}

const rank: Record<ActivitySourceKind, number> = {
  'french-holidays': 0,
  'italian-holidays': 1,
  'alex': 2,
  'alex-chiara': 3,
  'priority-task': 4,
  'unprioritized-task': 5,
  'other': 6,
};

export function compareCommitments(a: Commitment, b: Commitment, calendarNames?: Map<string, string>): number {
  const aName = a.googleCalendarId ? calendarNames?.get(a.googleCalendarId) : undefined;
  const bName = b.googleCalendarId ? calendarNames?.get(b.googleCalendarId) : undefined;
  const sourceCompare = rank[activitySourceKind(a, aName)] - rank[activitySourceKind(b, bName)];
  if (sourceCompare !== 0) return sourceCompare;
  if (activitySourceKind(a, aName) === 'priority-task' && activitySourceKind(b, bName) === 'priority-task') {
    const priorityCompare = (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER);
    if (priorityCompare !== 0) return priorityCompare;
  }
  const titleCompare = a.title.localeCompare(b.title, 'it-IT', { sensitivity: 'base', numeric: true, ignorePunctuation: true });
  if (titleCompare !== 0) return titleCompare;
  const aWhen = a.scheduledAt ?? a.dueAt ?? '';
  const bWhen = b.scheduledAt ?? b.dueAt ?? '';
  if (aWhen !== bWhen) return aWhen.localeCompare(bWhen);
  return a.id.localeCompare(b.id);
}
export function sortCommitments(items: Commitment[], calendarNames?: Map<string, string>): Commitment[] {
  return [...items].sort((a,b)=>compareCommitments(a,b,calendarNames));
}
export function sortCommitmentsAlphabetically(items: Commitment[]): Commitment[] {
  return sortCommitments(items);
}
