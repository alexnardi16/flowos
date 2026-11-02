import type { Commitment } from '../types';
import { commitmentDateParts } from './allDayDate';

function taskItems(items: Commitment[]): Commitment[] {
  return items.filter(item => item.kind === 'task' && item.status !== 'done' && !item.deletedAt);
}

/** Priorities are independent for each calendar day. Undated tasks share their own bucket. */
function taskDayKey(item: Commitment): string {
  const date = item.scheduledAt ?? item.dueAt;
  if (!date) return 'undated';
  const parts = commitmentDateParts(item, date);
  return `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function explicitTasks(tasks: Commitment[]): Commitment[] {
  return tasks.filter(item => Number.isFinite(item.priority) && (item.priority ?? 0) > 0);
}
function sortExplicitTasks(tasks: Commitment[]): Commitment[] {
  return explicitTasks(tasks).slice().sort((a, b) => {
    const ap = a.priority ?? Number.MAX_SAFE_INTEGER;
    const bp = b.priority ?? Number.MAX_SAFE_INTEGER;
    if (ap !== bp) return ap - bp;
    return a.title.localeCompare(b.title, 'it-IT', { sensitivity: 'base', numeric: true, ignorePunctuation: true }) || a.id.localeCompare(b.id);
  });
}
function groupByDay(tasks: Commitment[]): Map<string, Commitment[]> {
  const groups = new Map<string, Commitment[]>();
  for (const item of tasks) {
    const key = taskDayKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

/** Keeps priorities optional while guaranteeing a gap-free sequence independently on every day. */
export function normalizeTaskPriorities(items: Commitment[]): Commitment[] {
  const priorityById = new Map<string, number>();
  for (const group of groupByDay(taskItems(items)).values()) {
    for (const [index, item] of sortExplicitTasks(group).entries()) {
      priorityById.set(item.id, index + 1);
    }
  }
  return items.map(item => priorityById.has(item.id) ? { ...item, priority: priorityById.get(item.id) } : item);
}

/** Inserts the selected task at the requested position within its day and shifts that day's occupied positions down. */
export function reorderTaskPriorities(items: Commitment[], taskId: string, requestedPriority?: number): Commitment[] {
  const target = taskItems(items).find(item => item.id === taskId);
  if (!target) return items;
  const targetDay = taskDayKey(target);
  const sameDay = taskItems(items).filter(item => taskDayKey(item) === targetDay);
  if (!requestedPriority || requestedPriority < 1 || !Number.isFinite(requestedPriority)) {
    return normalizeTaskPriorities(items.map(item => item.id === taskId ? { ...item, priority: undefined } : item));
  }
  const prioritized = sortExplicitTasks(sameDay).filter(item => item.id !== taskId);
  const position = Math.min(Math.max(0, Math.round(requestedPriority) - 1), prioritized.length);
  prioritized.splice(position, 0, target);
  const byId = new Map(prioritized.map((item, index) => [item.id, index + 1]));
  return normalizeTaskPriorities(items.map(item => byId.has(item.id) ? { ...item, priority: byId.get(item.id) } : item));
}

export function nextTaskPriority(items: Commitment[], forItem?: Commitment): number {
  const tasks = taskItems(items);
  const relevant = forItem ? tasks.filter(item => taskDayKey(item) === taskDayKey(forItem)) : tasks;
  return explicitTasks(relevant).length + 1;
}
