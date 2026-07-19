import type { Commitment } from '../types';
import { enqueueMutation, readQueue, replaceQueue } from './offlineQueue';
import { isSupabaseConfigured, supabase } from './supabase';

function toRow(item: Commitment, userId: string) {
  const kindMap: Record<Commitment['kind'], string> = {
    task: 'task', event: 'event', reminder: 'reminder', routine: 'habit', idea: 'note',
  };
  const statusMap: Record<Commitment['status'], string> = {
    active: 'active', waiting: 'waiting', scheduled: 'scheduled', blocked: 'blocked', someday: 'someday', done: 'completed',
  };
  return {
    id: item.id,
    user_id: userId,
    title: item.title,
    kind: kindMap[item.kind],
    status: statusMap[item.status],
    starts_at: item.scheduledAt ?? null,
    deadline_at: item.dueAt ?? null,
    duration_minutes: item.durationMinutes,
    energy: item.energy,
    context: item.context,
    confidence_score: item.confidence,
    ai_metadata: { fixed: item.fixed, outcome: item.outcome },
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: any): Commitment {
  const kindMap: Record<string, Commitment['kind']> = {
    task: 'task', event: 'event', reminder: 'reminder', habit: 'routine', project: 'task', note: 'idea',
  };
  return {
    id: row.id,
    title: row.title,
    kind: kindMap[row.kind] ?? 'task',
    status: row.status === 'completed' ? 'done' : row.status,
    durationMinutes: row.duration_minutes ?? 30,
    energy: row.energy ?? 'medium',
    context: row.context ?? 'generale',
    dueAt: row.deadline_at ?? undefined,
    scheduledAt: row.starts_at ?? undefined,
    fixed: row.ai_metadata?.fixed ?? false,
    outcome: row.ai_metadata?.outcome,
    confidence: Number(row.confidence_score ?? 0.5),
  };
}

export async function loadCommitments(): Promise<Commitment[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('commitments').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function saveCommitment(item: Commitment) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!isSupabaseConfigured || !userId) return;
  const row = toRow(item, userId);
  const { error } = await supabase.from('commitments').upsert(row);
  if (error) {
    await enqueueMutation({ id: `${Date.now()}-${item.id}`, table: 'commitments', action: 'upsert', payload: row, createdAt: new Date().toISOString() });
  }
}

export async function flushOfflineQueue() {
  if (!isSupabaseConfigured) return;
  const queue = await readQueue();
  const failed = [];
  for (const mutation of queue) {
    const result = mutation.action === 'upsert'
      ? await supabase.from(mutation.table).upsert(mutation.payload)
      : await supabase.from(mutation.table).delete().eq('id', mutation.payload.id);
    if (result.error) failed.push(mutation);
  }
  await replaceQueue(failed);
}
