import type { Commitment } from '../types';

function taskDateKey(item: Commitment): string {
  const value = item.scheduledAt ?? item.dueAt;
  if (!value) return '__undated__';
  const date = new Date(value);
  if (item.allDay) return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function taskItems(items: Commitment[]): Commitment[] {
  return items.filter(item => item.kind === 'task' && item.status !== 'done' && !item.deletedAt);
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

/** Keeps priorities optional. Only tasks that already have an explicit priority are renumbered. */
export function normalizeTaskPriorities(items: Commitment[]): Commitment[] {
  const groups = new Map<string, Commitment[]>();
  for (const item of taskItems(items)) {
    if (!Number.isFinite(item.priority) || (item.priority ?? 0) <= 0) continue;
    const key = taskDateKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  const priorityById = new Map<string, number>();
  for (const tasks of groups.values()) {
    for (const [index, item] of sortExplicitTasks(tasks).entries()) priorityById.set(item.id, index + 1);
  }
  return items.map(item => item.kind === 'task' && priorityById.has(item.id) ? { ...item, priority: priorityById.get(item.id) } : item);
}

export function reorderTaskPriorities(items: Commitment[], taskId: string, requestedPriority?: number): Commitment[] {
  const target = taskItems(items).find(item => item.id === taskId);
  if (!target) return items;
  const targetDate = taskDateKey(target);
  const sameDay = taskItems(items).filter(item => taskDateKey(item) === targetDate);
  if (!requestedPriority || requestedPriority < 1 || !Number.isFinite(requestedPriority)) {
    return normalizeTaskPriorities(items.map(item => item.id === taskId ? { ...item, priority: undefined } : item));
  }
  const prioritized = sortExplicitTasks(sameDay).filter(item => item.id !== taskId);
  const position = Math.min(Math.max(0, Math.round(requestedPriority) - 1), prioritized.length);
  prioritized.splice(position, 0, { ...target, priority: position + 1 });
  const byId = new Map(prioritized.map((item, index) => [item.id, index + 1]));
  return items.map(item =>
    item.kind === 'task' && taskDateKey(item) === targetDate && item.status !== 'done' && !item.deletedAt && byId.has(item.id)
      ? { ...item, priority: byId.get(item.id) }
      : item
  );
}

export function nextTaskPriority(items: Commitment[], forItem?: Commitment): number {
  const candidates = taskItems(items).filter(item => !forItem || taskDateKey(item) === taskDateKey(forItem));
  return explicitTasks(candidates).length + 1;
}
