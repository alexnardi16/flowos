import type { Commitment } from '../types';

function taskDateKey(item: Commitment): string {
  const value = item.scheduledAt ?? item.dueAt;
  if (!value) return '__undated__';
  const date = new Date(value);
  if (item.allDay) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function taskItems(items: Commitment[]): Commitment[] {
  return items.filter(item => item.kind === 'task' && item.status !== 'done' && !item.deletedAt);
}

function sortTasks(tasks: Commitment[]): Commitment[] {
  return tasks.slice().sort((a, b) => {
    const ap = Number.isFinite(a.priority) && (a.priority ?? 0) > 0 ? a.priority! : Number.MAX_SAFE_INTEGER;
    const bp = Number.isFinite(b.priority) && (b.priority ?? 0) > 0 ? b.priority! : Number.MAX_SAFE_INTEGER;
    if (ap !== bp) return ap - bp;
    return a.title.localeCompare(b.title, 'it-IT', { sensitivity: 'base', numeric: true, ignorePunctuation: true }) || a.id.localeCompare(b.id);
  });
}

export function normalizeTaskPriorities(items: Commitment[]): Commitment[] {
  const groups = new Map<string, Commitment[]>();
  for (const item of taskItems(items)) {
    const key = taskDateKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  const priorityById = new Map<string, number>();
  for (const tasks of groups.values()) {
    for (const [index, item] of sortTasks(tasks).entries()) {
      priorityById.set(item.id, index + 1);
    }
  }

  return items.map(item => item.kind === 'task' && priorityById.has(item.id)
    ? { ...item, priority: priorityById.get(item.id) }
    : item);
}

export function reorderTaskPriorities(items: Commitment[], taskId: string, requestedPriority: number): Commitment[] {
  const target = taskItems(items).find(item => item.id === taskId);
  if (!target) return items;

  const targetDate = taskDateKey(target);
  const sameDay = taskItems(items).filter(item => taskDateKey(item) === targetDate);
  const withoutTarget = sortTasks(sameDay).filter(item => item.id !== taskId);
  const position = Math.min(Math.max(0, Math.round(requestedPriority) - 1), withoutTarget.length);
  withoutTarget.splice(position, 0, { ...target, priority: position + 1 });
  const byId = new Map(withoutTarget.map((item, index) => [item.id, index + 1]));

  return items.map(item => item.kind === 'task' && taskDateKey(item) === targetDate && item.status !== 'done' && !item.deletedAt
    ? { ...item, priority: byId.get(item.id) }
    : item);
}

export function nextTaskPriority(items: Commitment[], forItem?: Commitment): number {
  const candidates = taskItems(items).filter(item => !forItem || taskDateKey(item) === taskDateKey(forItem));
  return candidates.length + 1;
}
