export type PendingMutation = { id: string; table: 'commitments'; action: 'upsert' | 'delete'; payload: Record<string, unknown>; createdAt: string; attempts?: number; lastError?: string };
function targetId(mutation: PendingMutation): string { return String(mutation.payload.id ?? mutation.id); }
function mutationKey(mutation: PendingMutation): string { return JSON.stringify([mutation.id, mutation.createdAt, mutation.action, mutation.payload]); }
export function parsePendingQueue(raw: string): PendingMutation[] {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('La coda offline di FlowOS è danneggiata: i dati originali sono stati conservati e non verranno sovrascritti.'); }
  if (!Array.isArray(parsed)) throw new Error('La coda offline di FlowOS ha un formato non valido: i dati originali sono stati conservati e non verranno sovrascritti.');
  const valid = parsed.every((item): item is PendingMutation => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const candidate = item as Record<string, unknown>;
    return typeof candidate.id === 'string' && candidate.table === 'commitments'
      && (candidate.action === 'upsert' || candidate.action === 'delete')
      && Boolean(candidate.payload) && typeof candidate.payload === 'object' && !Array.isArray(candidate.payload)
      && typeof candidate.createdAt === 'string'
      && (candidate.attempts === undefined || typeof candidate.attempts === 'number')
      && (candidate.lastError === undefined || typeof candidate.lastError === 'string');
  });
  if (!valid) throw new Error('La coda offline di FlowOS contiene una mutazione non valida: i dati originali sono stati conservati e non verranno sovrascritti.');
  return parsed;
}
/** Reconcile a flushed snapshot without overwriting mutations added in-flight. */
export function reconcileQueueAfterFlush(snapshot: PendingMutation[], failed: PendingMutation[], current: PendingMutation[]): PendingMutation[] {
  const snapshotKeys = new Set(snapshot.map(mutationKey));
  const next = current.filter((item) => !snapshotKeys.has(mutationKey(item)));
  const currentTargets = new Set(next.map((item) => `${item.table}:${targetId(item)}`));
  for (const mutation of failed) {
    const target = `${mutation.table}:${targetId(mutation)}`;
    if (currentTargets.has(target)) continue; // A newer mutation supersedes the failed snapshot.
    next.push(mutation);
    currentTargets.add(target);
  }
  return next;
}
