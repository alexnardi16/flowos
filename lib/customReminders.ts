import type { Commitment } from '../types';

export type ScheduledReminder = {
  /** Unique per reminder instance (item + offset), not just per item — one item can have several. */
  id: string;
  commitmentId: string;
  title: string;
  minutesBefore: number;
  triggerAt: string;
};

function baseTime(item: Commitment): string | undefined {
  return item.scheduledAt ?? item.dueAt;
}

/** "10 minuti prima" / "1 ora prima" / "1 giorno prima" / "3 giorni prima" — used both for notification copy and for the reminder-picker UI. */
export function formatReminderOffsetLabel(minutesBefore: number): string {
  if (minutesBefore % 1440 === 0 && minutesBefore >= 1440) {
    const days = minutesBefore / 1440;
    return `${days} giorn${days === 1 ? 'o' : 'i'} prima`;
  }
  if (minutesBefore % 60 === 0 && minutesBefore >= 60) {
    const hours = minutesBefore / 60;
    return `${hours} or${hours === 1 ? 'a' : 'e'} prima`;
  }
  return `${minutesBefore} minuti prima`;
}

/**
 * Pure function: which reminder notifications should be pending right now,
 * for every commitment's own configured `reminders` (or the historical
 * default — a single 10-minutes-before reminder — for events that haven't
 * configured any, so existing behavior doesn't silently disappear).
 * All-day items are skipped: "N minutes before midnight" isn't meaningful.
 */
export function buildCustomReminders(commitments: Commitment[], now: Date = new Date()): ScheduledReminder[] {
  const result: ScheduledReminder[] = [];
  for (const item of commitments) {
    if (item.status === 'done' || item.deletedAt || item.allDay) continue;
    const base = baseTime(item);
    if (!base) continue;

    const offsets = item.reminders && item.reminders.length
      ? item.reminders
      : (item.kind === 'event' ? [{ id: 'default', minutesBefore: 10 }] : []);

    for (const offset of offsets) {
      const triggerAt = new Date(new Date(base).getTime() - offset.minutesBefore * 60000);
      if (triggerAt.getTime() < now.getTime()) continue;
      result.push({
        id: `${item.id}:${offset.id}`,
        commitmentId: item.id,
        title: item.title,
        minutesBefore: offset.minutesBefore,
        triggerAt: triggerAt.toISOString(),
      });
    }
  }
  return result.sort((a, b) => new Date(a.triggerAt).getTime() - new Date(b.triggerAt).getTime());
}
