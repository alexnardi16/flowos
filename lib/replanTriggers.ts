import type { Commitment } from '../types';

export type ReplanReason = 'missed-slot' | 'conflict-with-fixed' | 'never-scheduled';
export type ReplanCandidate = { id: string; reason: ReplanReason };

function isActive(item: Commitment): boolean {
  return item.status !== 'done' && !item.deletedAt;
}

function overlaps(a: Commitment, b: Commitment): boolean {
  if (!a.scheduledAt || !b.scheduledAt) return false;
  const aStart = new Date(a.scheduledAt).getTime();
  const aEnd = aStart + a.durationMinutes * 60000;
  const bStart = new Date(b.scheduledAt).getTime();
  const bEnd = bStart + b.durationMinutes * 60000;
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Pure function: which flexible commitments need to be re-slotted right
 * now. Three triggers:
 *  - "se una task non viene completata, propone un nuovo orario": its
 *    scheduled slot has already ended and it's still not done.
 *  - "se una riunione si prolunga, sposta le task compatibili": it overlaps
 *    a fixed event (which — since fixed events come from synced calendar
 *    data — is how a moved/extended meeting shows up).
 *  - a flexible item that has never been given a slot at all (a task or
 *    reminder just created, with only a due date and no scheduledAt yet).
 *    Without this, nothing would ever place it — the PlanningEngine only
 *    fills in commitments it's actually asked to via this candidate list,
 *    and there's no separate "assign a first slot" path anymore now that
 *    replanning is fully automatic (no manual "Genera piano" button).
 * Fixed items themselves are never candidates: they represent externally
 * owned time (calendar events), not something FlowOS should move.
 */
export function findItemsNeedingReplan(commitments: Commitment[], now: Date = new Date()): ReplanCandidate[] {
  const active = commitments.filter(isActive);
  const fixed = active.filter((item) => item.fixed && item.scheduledAt);
  const flexible = active.filter((item) => !item.fixed);

  const candidates: ReplanCandidate[] = [];
  for (const item of flexible) {
    if (!item.scheduledAt) {
      if (item.status === 'active' || item.status === 'scheduled') candidates.push({ id: item.id, reason: 'never-scheduled' });
      continue;
    }
    const end = new Date(item.scheduledAt).getTime() + item.durationMinutes * 60000;
    if (end < now.getTime()) {
      candidates.push({ id: item.id, reason: 'missed-slot' });
      continue;
    }
    if (fixed.some((fixedItem) => overlaps(item, fixedItem))) {
      candidates.push({ id: item.id, reason: 'conflict-with-fixed' });
    }
  }
  return candidates;
}
