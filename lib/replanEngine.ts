import type { Commitment } from '../types';
import { saveCommitment } from './commitmentsRepository';
import { logNotificationEvent } from './notificationLog';
import { findItemsNeedingReplan } from './replanTriggers';
import { createAutomaticPlan, DEFAULT_WEEKLY_AVAILABILITY, type WeeklyAvailability } from './scheduler';

/**
 * Automatic version of what the "Ripianifica" button in Plan already does
 * manually: detects commitments that need a new slot (missed, or now
 * conflicting with a fixed/calendar event) and re-runs the PlanningEngine
 * for just those, persisting the result. Returns the updated list so
 * callers can update in-memory state (e.g. the zustand store) without a
 * second fetch.
 */
export async function runIntelligentReplan(
  commitments: Commitment[],
  availability: WeeklyAvailability = DEFAULT_WEEKLY_AVAILABILITY,
  now: Date = new Date(),
): Promise<Commitment[] | null> {
  const candidates = findItemsNeedingReplan(commitments, now);
  if (!candidates.length) return null;

  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  // Clear the stale slot so the PlanningEngine treats these as flexible
  // items to re-place, rather than leaving them "stuck" at a slot that has
  // already passed or now collides with a fixed event.
  const reset = commitments.map((item) =>
    candidateIds.has(item.id) ? { ...item, status: 'active' as const, scheduledAt: undefined } : item,
  );

  const replanned = createAutomaticPlan(reset, availability, now);
  const changed = replanned.filter((item) => candidateIds.has(item.id));

  await Promise.all(changed.map((item) => saveCommitment(item)));
  await logNotificationEvent('intelligent-replan-completed', {
    count: changed.length,
    reasons: candidates.map((candidate) => candidate.reason),
  });

  return replanned;
}
