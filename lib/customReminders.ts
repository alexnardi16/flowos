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
  if (minutesBefore === 0) return `All'inizio`;
  return `${minutesBefore} minuti prima`;
}

/**
 * Pure function: which reminder notifications should be pending right now,
 * for every commitment's own configured `reminders`.
 * All-day events are skipped because they have no meaningful reminder time; all-day tasks may still use their due date as the reminder anchor.
 */
export function buildCustomReminders(commitments: Commitment[], now: Date = new Date()): ScheduledReminder[] {
  const result: ScheduledReminder[] = [];
  for (const item of commitments) {
    if (item.status === 'done' || item.deletedAt || (item.allDay && item.kind === 'event')) continue;
    const base = baseTime(item);
    if (!base) continue;

    const configured = item.reminders && item.reminders.length ? item.reminders : [];
    const offsets = [...configured, { id: 'automatic-start', minutesBefore: 0, createdAt: undefined }];
    const dismissedAt = item.reminderDismissedAt ? new Date(item.reminderDismissedAt).getTime() : null;

    for (const offset of offsets) {
      // A "complete" action dismisses the reminders that existed at that moment.
      // A newly added reminder carries a later createdAt and is therefore eligible again.
      if (offset.id !== 'automatic-start' && dismissedAt !== null) {
        const createdAt = offset.createdAt ? new Date(offset.createdAt).getTime() : Number.NaN;
        if (!Number.isFinite(createdAt) || createdAt <= dismissedAt) continue;
      }
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
  return dedupeScheduledReminders(result);
}

/**
 * Guarantees one desired notification per logical reminder key.
 * Duplicate commitment rows can otherwise generate the same OS notification
 * more than once. The earliest trigger wins deterministically.
 */
export function dedupeScheduledReminders(reminders: ScheduledReminder[]): ScheduledReminder[] {
  const byId = new Map<string, ScheduledReminder>();
  for (const reminder of reminders) {
    const existing = byId.get(reminder.id);
    if (!existing || new Date(reminder.triggerAt).getTime() < new Date(existing.triggerAt).getTime()) {
      byId.set(reminder.id, reminder);
    }
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.triggerAt).getTime() - new Date(b.triggerAt).getTime(),
  );
}
