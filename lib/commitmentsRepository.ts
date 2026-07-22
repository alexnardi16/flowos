import type { Commitment } from '../types';
import { enqueueMutation, readQueue, replaceQueue } from './offlineQueue';
import { isSupabaseConfigured, supabase } from './supabase';

function toRow(item: Commitment, userId: string) {
  const kindMap: Record<Commitment['kind'], string> = { task: 'task', event: 'event', reminder: 'reminder', routine: 'habit', idea: 'note' };
  const statusMap: Record<Commitment['status'], string> = { active: 'active', waiting: 'waiting', scheduled: 'scheduled', blocked: 'blocked', someday: 'someday', done: 'completed' };
  const resourceType = item.kind === 'event' ? 'calendar_event' : ['task', 'reminder'].includes(item.kind) ? 'task' : null;
  return {
    id: item.id,
    user_id: userId,
    title: item.title,
    description: item.description ?? null,
    kind: kindMap[item.kind],
    status: statusMap[item.status],
    starts_at: item.scheduledAt ?? null,
    deadline_at: item.dueAt ?? null,
    duration_minutes: item.durationMinutes,
    energy: item.energy,
    context: item.context,
    confidence_score: item.confidence,
    ai_metadata: { fixed: item.fixed, outcome: item.outcome },
    external_provider: resourceType ? 'google' : null,
    external_resource_type: resourceType,
    google_calendar_id: item.googleCalendarId ?? null,
    google_task_list_id: item.googleTaskListId ?? null,
    external_id: item.externalId ?? null,
    external_etag: item.externalEtag ?? null,
    external_updated_at: item.externalUpdatedAt ?? null,
    last_sync_origin: 'flowos',
    sync_status: resourceType ? 'pending' : 'local_only',
    sync_error: null,
    deleted_at: item.deletedAt ?? null,
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: any): Commitment {
  const kindMap: Record<string, Commitment['kind']> = { task: 'task', event: 'event', reminder: 'reminder', habit: 'routine', project: 'task', note: 'idea' };
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
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
    googleCalendarId: row.google_calendar_id ?? undefined,
    googleTaskListId: row.google_task_list_id ?? undefined,
    externalId: row.external_id ?? undefined,
    externalEtag: row.external_etag ?? undefined,
    externalUpdatedAt: row.external_updated_at ?? undefined,
    syncStatus: row.sync_status ?? undefined,
    syncError: row.sync_error ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
  };
}

export async function loadCommitments(): Promise<Commitment[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('commitments').select('*').is('deleted_at', null).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function saveCommitment(item: Commitment) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!isSupabaseConfigured || !userId) return;
  const row = toRow(item, userId);
  const { error } = await supabase.from('commitments').upsert(row);
  if (error) await enqueueMutation({ id: `${Date.now()}-${item.id}`, table: 'commitments', action: 'upsert', payload: row, createdAt: new Date().toISOString() });
}

export async function removeCommitmentOnlyFromFlowOS(id: string) {
  const { error } = await supabase.from('commitments').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteCommitmentAlsoFromGoogle(item: Commitment) {
  if (!item.externalId) {
    await removeCommitmentOnlyFromFlowOS(item.id);
    return;
  }
  const { data, error } = await supabase.functions.invoke('google-delete-item', { body: { commitmentId: item.id } });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
}

export async function flushOfflineQueue() {
  if (!isSupabaseConfigured) return;
  const queue = await readQueue();
  const failed = [];
  for (const mutation of queue) {
    const result = mutation.action === 'upsert' ? await supabase.from(mutation.table).upsert(mutation.payload) : await supabase.from(mutation.table).delete().eq('id', mutation.payload.id);
    if (result.error) failed.push(mutation);
  }
  await replaceQueue(failed);
}
