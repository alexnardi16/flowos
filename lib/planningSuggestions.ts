import type { Commitment } from '../types';
import { DEFAULT_WEEKLY_AVAILABILITY, type WeeklyAvailability } from './scheduler';

export type PlanningSuggestion = { id: string; text: string };

function isActive(item: Commitment): boolean {
  return item.status !== 'done' && !item.deletedAt;
}

function todaysWindows(availability: WeeklyAvailability, now: Date) {
  return (availability[now.getDay()] ?? []).map((window) => {
    const start = new Date(now);
    start.setHours(window.startHour, 0, 0, 0);
    const end = new Date(now);
    end.setHours(window.endHour, 0, 0, 0);
    return { start: start.getTime() < now.getTime() ? now.getTime() : start.getTime(), end: end.getTime() };
  });
}

function formatTime(ms: number): string {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Heuristic, rule-based suggestions — deliberately not an LLM call. Wiring
 * this to a real model would need a new Supabase Edge Function (similar to
 * interpret-commitment) that this environment has no way to deploy or test
 * end-to-end; see docs/IMPLEMENTATION_STATUS.md. This still delivers the
 * two concrete behaviours originally asked for: surfacing free gaps with a
 * task that fits, and flagging days that don't have enough room.
 */
export function buildPlanningSuggestions(
  commitments: Commitment[],
  availability: WeeklyAvailability = DEFAULT_WEEKLY_AVAILABILITY,
  now: Date = new Date(),
): PlanningSuggestion[] {
  const active = commitments.filter(isActive);
  const todayScheduled = active
    .filter((item) => item.scheduledAt && new Date(item.scheduledAt).toDateString() === now.toDateString())
    .sort((a, b) => new Date(a.scheduledAt as string).getTime() - new Date(b.scheduledAt as string).getTime());

  const busyIntervals = todayScheduled.map((item) => {
    const start = new Date(item.scheduledAt as string).getTime();
    return { start, end: start + item.durationMinutes * 60000 };
  });

  const suggestions: PlanningSuggestion[] = [];

  // Largest free gap today, and the best-fitting unscheduled task for it.
  let bestGap = { start: 0, end: 0, minutes: 0 };
  for (const window of todaysWindows(availability, now)) {
    let cursor = window.start;
    const relevant = busyIntervals.filter((b) => b.end > window.start && b.start < window.end).sort((a, b) => a.start - b.start);
    for (const busy of relevant) {
      if (busy.start > cursor) {
        const minutes = (busy.start - cursor) / 60000;
        if (minutes > bestGap.minutes) bestGap = { start: cursor, end: busy.start, minutes };
      }
      cursor = Math.max(cursor, busy.end);
    }
    if (window.end > cursor) {
      const minutes = (window.end - cursor) / 60000;
      if (minutes > bestGap.minutes) bestGap = { start: cursor, end: window.end, minutes };
    }
  }

  if (bestGap.minutes >= 15) {
    const unscheduled = active
      .filter((item) => !item.fixed && item.kind === 'task' && item.status !== 'scheduled' && item.durationMinutes <= bestGap.minutes)
      .sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
    const gapLabel = `${formatTime(bestGap.start)}–${formatTime(bestGap.end)}`;
    suggestions.push({
      id: 'free-gap',
      text: unscheduled
        ? `Hai ${Math.round(bestGap.minutes)} minuti liberi alle ${gapLabel}: potresti inserire "${unscheduled.title}".`
        : `Hai ${Math.round(bestGap.minutes)} minuti liberi alle ${gapLabel} e nessuna task abbastanza breve da starci.`,
    });
  }

  // Overbooked warning: scheduled-today load exceeds today's total availability.
  const totalAvailableMinutes = todaysWindows(availability, now).reduce((sum, window) => sum + Math.max(0, (window.end - window.start) / 60000), 0);
  const totalBusyMinutes = busyIntervals.reduce((sum, interval) => sum + (interval.end - interval.start) / 60000, 0);
  if (totalAvailableMinutes > 0 && totalBusyMinutes > totalAvailableMinutes) {
    suggestions.push({
      id: 'overbooked',
      text: `Oggi hai più impegni di quanti ne entrino nel tuo orario disponibile (${Math.round(totalBusyMinutes)} contro ${Math.round(totalAvailableMinutes)} minuti). Valuta di spostarne qualcuno a domani.`,
    });
  }

  return suggestions;
}
