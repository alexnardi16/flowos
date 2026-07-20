import type { Commitment, Energy } from '@/types';

const DAY_START_HOUR = 9;
const DAY_END_HOUR = 18;
const BUFFER_MINUTES = 10;

function startOfPlanningDay(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(DAY_START_HOUR, 0, 0, 0);
  return date;
}

function energyWeight(energy: Energy) {
  return energy === 'high' ? 3 : energy === 'medium' ? 2 : 1;
}

function priority(item: Commitment) {
  const due = item.dueAt ? new Date(item.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  const urgency = due === Number.MAX_SAFE_INTEGER ? 0 : Math.max(0, 10 - Math.floor((due - Date.now()) / 86400000));
  return urgency * 10 + energyWeight(item.energy) * 2 + item.confidence;
}

function overlaps(start: Date, end: Date, item: Commitment) {
  if (!item.scheduledAt) return false;
  const itemStart = new Date(item.scheduledAt);
  const itemEnd = new Date(itemStart.getTime() + item.durationMinutes * 60000);
  return start < itemEnd && end > itemStart;
}

export function createAutomaticPlan(commitments: Commitment[]): Commitment[] {
  const fixed = commitments.filter((item) => item.fixed && item.scheduledAt && item.status !== 'done');
  const flexible = commitments
    .filter((item) => !item.fixed && item.status !== 'done')
    .sort((a, b) => priority(b) - priority(a));

  const scheduled: Commitment[] = [...fixed];
  const replacements = new Map<string, Commitment>();

  for (const item of flexible) {
    let placed = false;

    for (let day = 0; day < 14 && !placed; day += 1) {
      let cursor = startOfPlanningDay(day);
      if (day === 0 && cursor.getTime() < Date.now()) {
        cursor = new Date(Date.now() + BUFFER_MINUTES * 60000);
        cursor.setMinutes(Math.ceil(cursor.getMinutes() / 10) * 10, 0, 0);
      }

      const endOfDay = startOfPlanningDay(day);
      endOfDay.setHours(DAY_END_HOUR, 0, 0, 0);

      while (cursor.getTime() + item.durationMinutes * 60000 <= endOfDay.getTime()) {
        const end = new Date(cursor.getTime() + item.durationMinutes * 60000);
        if (!scheduled.some((candidate) => overlaps(cursor, end, candidate))) {
          const updated: Commitment = {
            ...item,
            status: 'scheduled',
            scheduledAt: cursor.toISOString(),
          };
          replacements.set(item.id, updated);
          scheduled.push(updated);
          placed = true;
          break;
        }
        cursor = new Date(cursor.getTime() + 10 * 60000);
      }
    }
  }

  return commitments.map((item) => replacements.get(item.id) ?? item);
}
