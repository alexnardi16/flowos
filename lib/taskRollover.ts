import type { Commitment } from '../types';

export const TASK_ROLLOVER_STORAGE_KEY = 'flowos-task-rollover-date-v1';

/** Compatibility shim: overdue tasks are displayed in today's views; persisted dates are never shifted. */
export function rolloverIncompleteTasks(commitments: Commitment[], _now: Date = new Date()): { commitments: Commitment[]; changed: Commitment[] } {
  return { commitments, changed: [] };
}

export function shouldRunTaskRollover(lastRunDateKey: string | null, now: Date = new Date()): boolean {
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return lastRunDateKey !== key;
}

export function getTaskRolloverDateKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
