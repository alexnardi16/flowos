import type { Commitment } from '@/types';
import { isExpired } from './itemTiming';
import { materializeNextOccurrence } from './recurrence';
import { saveCommitment } from './commitmentsRepository';

export type AutoCompletedEventsResult = {
  commitments: Commitment[];
  completedCount: number;
};

/**
 * Marks every active event whose end time has passed as completed.
 * Calendar events are intentionally treated as FlowOS-only completion:
 * Google Calendar has no completed state.
 */
export async function autoCompleteExpiredEvents(
  commitments: Commitment[],
  now: Date = new Date(),
): Promise<AutoCompletedEventsResult> {
  let nextCommitments = commitments;
  let completedCount = 0;

  for (const item of commitments) {
    if (item.kind !== 'event' || item.status === 'done' || item.deletedAt || !isExpired(item, now)) continue;

    const updated: Commitment = { ...item, status: 'done' };
    // Google Calendar already owns recurring event expansion; do not create a duplicate
    // local occurrence when an event is auto-completed after its end time.
    const next = item.kind === 'event' ? null : materializeNextOccurrence(updated);

    nextCommitments = next
      ? [next, ...nextCommitments.map((current) => current.id === item.id ? updated : current)]
      : nextCommitments.map((current) => current.id === item.id ? updated : current);

    await saveCommitment(updated);
    if (next) await saveCommitment(next);
    completedCount += 1;
  }

  return { commitments: nextCommitments, completedCount };
}
