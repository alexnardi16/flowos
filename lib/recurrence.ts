import type { Commitment, RecurrenceRule } from '../types';

/** Converts our local recurrence shape into a Google Calendar RRULE string (used only for kind='event', which Google itself expands — see lib/recurrence.ts's other exports for the separate local-only engine used by tasks/reminders). */
export function toRRuleString(rule: RecurrenceRule): string {
  const freqMap: Record<RecurrenceRule['frequency'], string> = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY' };
  const parts = [`FREQ=${freqMap[rule.frequency]}`, `INTERVAL=${Math.max(1, rule.interval)}`];
  if (rule.count) parts.push(`COUNT=${rule.count}`);
  else if (rule.until) parts.push(`UNTIL=${rule.until.replace(/[-:]/g, '').split('.')[0]}Z`);
  return `RRULE:${parts.join(';')}`;
}

export function computeNextOccurrence(fromDate: Date, rule: RecurrenceRule): Date {
  const next = new Date(fromDate);
  switch (rule.frequency) {
    case 'daily':
      next.setDate(next.getDate() + rule.interval);
      break;
    case 'weekly':
      next.setDate(next.getDate() + rule.interval * 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + rule.interval);
      break;
  }
  return next;
}

/**
 * When a recurring, locally-managed commitment (task/reminder — Google Tasks
 * has no native recurrence, so this never touches the Google sync path) is
 * marked done, produces the next occurrence to insert, or null once the
 * series has finished (via `until` or `count`).
 */
export function materializeNextOccurrence(completed: Commitment): Commitment | null {
  if (!completed.recurrenceRule) return null;
  const rule = completed.recurrenceRule;
  const baseDateStr = completed.dueAt ?? completed.scheduledAt;
  if (!baseDateStr) return null;

  const next = computeNextOccurrence(new Date(baseDateStr), rule);
  if (rule.until && next.getTime() > new Date(rule.until).getTime()) return null;

  const nextRule: RecurrenceRule = rule.count !== undefined ? { ...rule, count: rule.count - 1 } : rule;
  if (nextRule.count !== undefined && nextRule.count <= 0) return null;

  const nextIso = next.toISOString();
  const seriesId = completed.recurrenceSeriesId ?? completed.id;
  return {
    ...completed,
    id: `${seriesId}-${next.getTime()}`,
    recurrenceSeriesId: seriesId,
    recurrenceRule: nextRule,
    status: completed.kind === 'event' ? 'scheduled' : 'active',
    dueAt: completed.dueAt ? nextIso : undefined,
    scheduledAt: completed.scheduledAt ? nextIso : undefined,
    externalId: undefined,
    externalEtag: undefined,
    externalUpdatedAt: undefined,
    syncStatus: undefined,
  };
}
