import type { Commitment } from '../types';
import { toRRuleString } from './recurrence';
import { enqueueMutation, readQueue, replaceQueue } from './offlineQueue';
import { logNotificationEvent } from './notificationLog';
import { isSupabaseConfigured, supabase } from './supabase';

function googleDescription(item: Commitment) {
  const parts = [
    item.description,
    item.notes ? `Note: ${item.notes}` : undefined,
    item.location ? `Luogo: ${item.location}` : undefined,
    item.link ? `Link: ${item.link}` : undefined,
  ].filter(Boolean);
  return parts.join('\n\n') || undefined;
}

function toRow(item: Commitment, userId: string) {
  const kindMap: Record<Commitment['kind'], string> = { task: 'task', event: 'event', reminder: 'reminder', routine: 'habit', idea: 'note' };
  const statusMap: Record<Commitment['status'], string> = { active: 'active', waiting: 'waiting', scheduled: 'scheduled', blocked: 'blocked', someday: 'someday', done: 'completed' };
  const resourceType = item.kind === 'event' ? 'calendar_event' : ['task', 'reminder'].includes(item.kind) ? 'task' : null;
  const normalizedAllDayTask = item.kind === 'task' && item.allDay;
  return {
    id: item.id,
    user_id: userId,
    title: item.title,
    description: googleDescription(item) ?? null,
    kind: kindMap[item.kind],
    status: statusMap[item.status],
    starts_at: item.scheduledAt ?? (normalizedAllDayTask ? item.dueAt ?? null : null),
    deadline_at: item.dueAt ?? null,
    duration_minutes: normalizedAllDayTask ? 1440 : item.durationMinutes,
    energy: item.energy,
    context: item.context,
    confidence_score: item.confidence,
    ai_metadata: { fixed: item.fixed, outcome: item.outcome, originalDescription: item.description, notes: item.notes, location: item.location, link: item.link, allDay: item.allDay, recurrenceRule: item.recurrenceRule ? (item.kind === 'event' ? toRRuleString(item.recurrenceRule) : item.recurrenceRule) : undefined, recurrenceSeriesId: item.recurrenceSeriesId, reminders: item.reminders },
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
  const kind = kindMap[row.kind] ?? 'task';
  const allDay = row.ai_metadata?.allDay ?? false;
  const isGoogleAllDayTask = kind === 'task' && allDay && Boolean(row.deadline_at);
  const durationMinutes = isGoogleAllDayTask ? 1440 : (row.duration_minutes ?? 30);
  const scheduledAt = row.starts_at ?? (isGoogleAllDayTask ? row.deadline_at : undefined);
  return {
    id: row.id,
    title: row.title,
    description: row.ai_metadata?.originalDescription ?? row.description ?? undefined,
    notes: row.ai_metadata?.notes ?? undefined,
    location: row.ai_metadata?.location ?? undefined,
    link: row.ai_metadata?.link ?? undefined,
    kind,
    status: row.status === 'completed' ? 'done' : row.status,
    durationMinutes,
    energy: row.energy ?? 'medium',
    context: row.context ?? 'generale',
    dueAt: row.deadline_at ?? undefined,
    scheduledAt,
    fixed: row.ai_metadata?.fixed ?? false,
    allDay,
    outcome: row.ai_metadata?.outcome,
    confidence: Number(row.confidence_score ?? 0.5),
    googleCalendarId: row.google_calendar_id ?? undefined,
    googleTaskListId: row.google_task_list_id ?? undefined,
    googleRecurringEventId: row.ai_metadata?.googleRecurringEventId ?? undefined,
    googleEventType: row.ai_metadata?.googleEventType ?? undefined,
    recurrenceRule: row.kind === 'event' ? undefined : row.ai_metadata?.recurrenceRule ?? undefined,
    recurrenceSeriesId: row.ai_metadata?.recurrenceSeriesId ?? undefined,
    reminders: row.ai_metadata?.reminders ?? undefined,
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

/** Deletes an entire recurring Google Calendar series (the master event and every instance), not just this one occurrence. */
export async function deleteRecurringSeries(item: Commitment) {
  if (!item.googleRecurringEventId) throw new Error('Questo elemento non fa parte di una serie ricorrente.');
  const { data, error } = await supabase.functions.invoke('google-workspace', { body: { action: 'sync-delete-series', commitmentId: item.id } });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return Number(data?.deletedCount ?? 0);
}

/** Deletes every FlowOS commitment for this user directly (bypasses the Edge Function entirely, so no Google delete call is ever made). Google-sourced items reappear on the next sync within the configured date range; FlowOS-only items are gone for good. */
export async function deleteAllFlowOSOnlyData() {
  if (!isSupabaseConfigured) return;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { error } = await supabase.from('commitments').delete().eq('user_id', auth.user.id);
  if (error) throw error;
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

/** Forces an immediate push of any pending local changes to Google (saveCommitment already marks Google-syncable items as sync_status='pending'; this is what actually sends them). */
export async function pushPendingToGoogle() {
  if (!isSupabaseConfigured) return;
  const { data, error } = await supabase.functions.invoke('google-workspace', { body: { action: 'sync-push' } });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  await logAnyPushErrors();
  return data;
}

/** pushLocal (server-side) catches failures per item and marks that row sync_status='error' without failing the overall sync-push call — so without this, an individual item that can't be written to Google (e.g. a birthday from the read-only Contacts calendar) fails silently. This surfaces those into the notification log so they're diagnosable instead of just an unexplained warning badge. */
async function logAnyPushErrors() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { data: errored } = await supabase.from('commitments').select('title,sync_error').eq('user_id', auth.user.id).eq('sync_status', 'error').limit(10);
  if (!errored?.length) return;
  await logNotificationEvent('push-to-google-item-failed', { items: errored.map((item) => ({ title: item.title, error: item.sync_error })) }, 'warn');
}
