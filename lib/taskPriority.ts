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

export function normalizeTaskPriorities(items: Commitment[]): Commitment[] {
  const activeTasks = taskItems(items)
    .slice()
    .sort((a, b) => {
      const ap = Number.isFinite(a.priority) && (a.priority ?? 0) > 0 ? a.priority! : Number.MAX_SAFE_INTEGER;
      const bp = Number.isFinite(b.priority) && (b.priority ?? 0) > 0 ? b.priority! : Number.MAX_SAFE_INTEGER;
      if (ap !== bp) return ap - bp;
      return a.title.localeCompare(b.title, 'it-IT', { sensitivity: 'base', numeric: true, ignorePunctuation: true }) || a.id.localeCompare(b.id);
    });
  const byId = new Map(activeTasks.map((item, index) => [item.id, index + 1]));
  return items.map(item => item.kind === 'task' && byId.has(item.id) ? { ...item, priority: byId.get(item.id) } : item);
}

export function reorderTaskPriorities(items: Commitment[], taskId: string, requestedPriority: number): Commitment[] {
  const activeTasks = taskItems(items).slice().sort((a, b) => {
    const ap = Number.isFinite(a.priority) && (a.priority ?? 0) > 0 ? a.priority! : Number.MAX_SAFE_INTEGER;
    const bp = Number.isFinite(b.priority) && (b.priority ?? 0) > 0 ? b.priority! : Number.MAX_SAFE_INTEGER;
    if (ap !== bp) return ap - bp;
    return a.title.localeCompare(b.title, 'it-IT', { sensitivity: 'base', numeric: true, ignorePunctuation: true }) || a.id.localeCompare(b.id);
  });
  const target = activeTasks.find(item => item.id === taskId);
  if (!target) return items;

  const withoutTarget = activeTasks.filter(item => item.id !== taskId);
  const position = Math.min(Math.max(0, Math.round(requestedPriority) - 1), withoutTarget.length);
  withoutTarget.splice(position, 0, { ...target, priority: position + 1 });
  const byId = new Map(withoutTarget.map((item, index) => [item.id, index + 1]));
  return items.map(item => item.kind === 'task' && byId.has(item.id) ? { ...item, priority: byId.get(item.id) } : item);
}

export function nextTaskPriority(items: Commitment[]): number {
  return taskItems(items).length + 1;
}
