import type { Commitment } from '../types';

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

/** Keeps priorities optional while guaranteeing one global, gap-free sequence among prioritized open tasks. */
export function normalizeTaskPriorities(items: Commitment[]): Commitment[] {
  const priorityById = new Map<string, number>();
  for (const [index, item] of sortExplicitTasks(taskItems(items)).entries()) {
    priorityById.set(item.id, index + 1);
  }
  return items.map(item => priorityById.has(item.id) ? { ...item, priority: priorityById.get(item.id) } : item);
}

/** Inserts the selected task at the requested global position and shifts every occupied position down. */
export function reorderTaskPriorities(items: Commitment[], taskId: string, requestedPriority?: number): Commitment[] {
  const target = taskItems(items).find(item => item.id === taskId);
  if (!target) return items;
  if (!requestedPriority || requestedPriority < 1 || !Number.isFinite(requestedPriority)) {
    return normalizeTaskPriorities(items.map(item => item.id === taskId ? { ...item, priority: undefined } : item));
  }
  const prioritized = sortExplicitTasks(taskItems(items)).filter(item => item.id !== taskId);
  const position = Math.min(Math.max(0, Math.round(requestedPriority) - 1), prioritized.length);
  prioritized.splice(position, 0, target);
  const byId = new Map(prioritized.map((item, index) => [item.id, index + 1]));
  return items.map(item => byId.has(item.id) ? { ...item, priority: byId.get(item.id) } : item);
}

export function nextTaskPriority(items: Commitment[], _forItem?: Commitment): number {
  return explicitTasks(taskItems(items)).length + 1;
}
