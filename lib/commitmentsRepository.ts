import type { Commitment } from '../types';
import { toRRuleString } from './recurrence';
import { enqueueMutation, readQueue, reconcileFlushedQueue } from './offlineQueue';
import { logNotificationEvent } from './notificationLog';
import { recordDiagnostic } from './diagnostics';
import { isSupabaseConfigured, supabase } from './supabase';
import { normalizeTaskPriorities } from './taskPriority';
import { initialSyncStatus } from './commitmentSyncPolicy';

function googleDescription(item: Commitment) {
  const parts = [
    item.description,
    item.notes ? `Note: ${item.notes}` : undefined,
    item.location ? `Luogo: ${item.location}` : undefined,
    item.link ? `Link: ${item.link}` : undefined,
  ].filter(Boolean);
  return parts.join('\
\
') || undefined;
}

function toRow(item: Commitment, userId: string) {
  const kindMap: Record<Commitment['kind'], string> = { task: 'task', event: 'event' };
  const statusMap: Record<Commitment['status'], string> = { active: 'active', waiting: 'waiting', scheduled: 'scheduled', blocked: 'blocked', someday: 'someday', done: 'completed' };
  const resourceType = item.kind === 'event' ? 'calendar_event' : 'task';
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
    priority: item.kind === 'task' ? item.priority ?? null : null,
    energy: item.energy,
    context: item.context,
    confidence_score: item.confidence,
    ai_metadata: { fixed: item.fixed, outcome: item.outcome, originalDescription: item.description, notes: item.notes, location: item.location, link: item.link, allDay: item.allDay, flowosTimedTask: item.kind === 'task' && !item.allDay, recurrenceRule: item.recurrenceRule ? (item.kind === 'event' ? toRRuleString(item.recurrenceRule) : item.recurrenceRule) : undefined, recurrenceSeriesId: item.recurrenceSeriesId, recurrenceSeriesEndAt: item.recurrenceSeriesEndAt, reminders: item.reminders, reminderDismissedAt: item.reminderDismissedAt, dailyCompletedDates: item.dailyCompletedDates },
    external_provider: item.externalId ? 'google' : null,
    external_resource_type: item.externalId ? resourceType : null,
    google_calendar_id: item.googleCalendarId ?? null,
    google_task_list_id: item.googleTaskListId ?? null,
    external_id: item.externalId ?? null,
    external_etag: item.externalEtag ?? null,
    external_updated_at: item.externalUpdatedAt ?? null,
    last_sync_origin: 'flowos',
    // Completing a Calendar event is a FlowOS-only state. Google Calendar
    // events do not have a completed status, so never enqueue that transition
    // as a Google write. Tasks can still use pending because Google Tasks has
    // an explicit completed status.
    resolution_pending: item.resolutionPending ?? false,
    sync_status: initialSyncStatus(item),
    sync_error: null,
    completed_at: item.completedAt ?? null,
    deleted_at: item.deletedAt ?? null,
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: any): Commitment {
  const kindMap: Record<string, Commitment['kind']> = { task: 'task', event: 'event', reminder: 'task', habit: 'task', project: 'task', note: 'task' };
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
    priority: kind === 'task' && Number.isFinite(row.priority) ? Number(row.priority) : undefined,
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
    recurrenceSeriesEndAt: row.ai_metadata?.recurrenceSeriesEndAt ?? undefined,
    reminders: row.ai_metadata?.reminders ?? undefined,
    reminderDismissedAt: row.ai_metadata?.reminderDismissedAt ?? undefined,
    dailyCompletedDates: Array.isArray(row.ai_metadata?.dailyCompletedDates) ? row.ai_metadata.dailyCompletedDates : undefined,
    externalId: row.external_id ?? undefined,
    externalEtag: row.external_etag ?? undefined,
    externalUpdatedAt: row.external_updated_at ?? undefined,
    syncStatus: row.sync_status ?? undefined,
    resolutionPending: Boolean(row.resolution_pending),
    syncError: row.sync_error ?? undefined,
    completedAt: row.completed_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
  };
}

export async function loadCommitments(): Promise<Commitment[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('commitments').select('*').is('deleted_at', null).order('created_at', { ascending: false });
  if (error) throw error;
  return normalizeTaskPriorities((data ?? []).map(fromRow));
}

export async function saveCommitment(item: Commitment): Promise<boolean> {
  const startedAt=Date.now();
  if(!isSupabaseConfigured){
    recordDiagnostic('commitment-save-skipped',{id:item.id,reason:'supabase-not-configured'},'error');
    return false;
  }

  let userId:string|undefined;
  try{
    const {data:auth,error:authError}=await supabase.auth.getSession();
    if(authError)throw authError;
    userId=auth.session?.user?.id;
  }catch(error){
    recordDiagnostic('commitment-auth-read-failed',{id:item.id,error},'warn');
    return false;
  }
  if(!userId){
    recordDiagnostic('commitment-save-skipped-no-session',{id:item.id},'warn');
    return false;
  }

  const row=toRow(item,userId);
  try{
    const {data:existing,error:existingError}=await supabase.from('commitments').select('*').eq('id',item.id).eq('user_id',userId).maybeSingle();
    if(existingError)recordDiagnostic('commitment-existing-read-failed',{id:item.id,error:existingError},'warn');
    else if(existing){
      const syncMetadataKeys=new Set(['updated_at','sync_status','sync_error','last_sync_origin','external_provider','external_resource_type','external_id','external_etag','external_updated_at','google_calendar_id','google_task_list_id']);
      const comparableKeys=Object.keys(row).filter(key=>!syncMetadataKeys.has(key)&&key!=='ai_metadata');
      const unchanged=comparableKeys.every(key=>JSON.stringify(existing[key])===JSON.stringify((row as Record<string,unknown>)[key]));
      const existingMetadata={...(existing.ai_metadata??{})};
      const nextMetadata={...(((row as Record<string,unknown>).ai_metadata as Record<string,unknown>)??{})};
      const previousDailyDates=existingMetadata.dailyCompletedDates;
      const nextDailyDates=nextMetadata.dailyCompletedDates;
      delete existingMetadata.dailyCompletedDates;
      delete nextMetadata.dailyCompletedDates;
      const onlyDailyCompletionChanged=unchanged
        &&JSON.stringify(existingMetadata)===JSON.stringify(nextMetadata)
        &&JSON.stringify(previousDailyDates??[])!==JSON.stringify(nextDailyDates??[]);
      if(onlyDailyCompletionChanged){
        const {error}=await supabase.from('commitments').update({ai_metadata:row.ai_metadata,updated_at:new Date().toISOString()}).eq('id',item.id).eq('user_id',userId);
        if(error)throw error;
        recordDiagnostic('commitment-daily-completion-saved',{id:item.id,elapsedMs:Date.now()-startedAt});
        return true;
      }
      if(unchanged&&JSON.stringify(existing.ai_metadata??{})===JSON.stringify((row as Record<string,unknown>).ai_metadata??{})){
        recordDiagnostic('commitment-save-no-change',{id:item.id,elapsedMs:Date.now()-startedAt});
        return true;
      }

      const mutableRow=row as Record<string,unknown>;
      for(const key of ['external_provider','external_resource_type','external_id','external_etag','external_updated_at','google_calendar_id','google_task_list_id']){
        if(existing[key]!==null&&existing[key]!==undefined)mutableRow[key]=existing[key];
      }
      mutableRow.sync_status='pending';
      mutableRow.sync_error=null;
      mutableRow.last_sync_origin='flowos';
      mutableRow.updated_at=new Date().toISOString();
    }

    const {data:persistedRows,error}=await supabase.from('commitments').upsert(row,{onConflict:'id'}).select('id,kind,status,sync_status,external_id,updated_at').limit(1);
    if(!error){
      const persisted=persistedRows?.[0];
      if(persisted?.id===item.id){
        recordDiagnostic('commitment-save-completed',{id:item.id,elapsedMs:Date.now()-startedAt});
        return true;
      }
      recordDiagnostic('commitment-save-readback-missing',{id:item.id,elapsedMs:Date.now()-startedAt},'error');
      return false;
    }

    await enqueueMutation({id:`${Date.now()}-${item.id}`,table:'commitments',action:'upsert',payload:row,createdAt:new Date().toISOString(),lastError:error.message});
    recordDiagnostic('commitment-save-queued',{id:item.id,elapsedMs:Date.now()-startedAt,error:error.message},'warn');
    return false;
  }catch(error){
    const message=error instanceof Error?error.message:'Persistenza non riuscita.';
    try{
      await enqueueMutation({id:`${Date.now()}-${item.id}`,table:'commitments',action:'upsert',payload:row,createdAt:new Date().toISOString(),lastError:message});
    }catch(queueError){
      recordDiagnostic('commitment-save-queue-failed',{id:item.id,error:queueError},'error');
    }
    recordDiagnostic('commitment-save-failed',{id:item.id,elapsedMs:Date.now()-startedAt,error},'warn');
    return false;
  }
}

export async function loadCommitmentById(id:string):Promise<Commitment|null>{
  if(!isSupabaseConfigured)return null;
  const {data,error}=await supabase.from('commitments').select('*').eq('id',id).is('deleted_at',null).maybeSingle();
  if(error)throw error;
  return data?fromRow(data):null;
}

export async function removeCommitmentOnlyFromFlowOS(id: string) {
  if (!isSupabaseConfigured) return;
  const { data, error } = await supabase.functions.invoke('google-workspace', {
    body: { action: 'hide-from-flowos', commitmentId: id },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  if (!data?.ok || data.commitmentId !== id) {
    throw new Error('Attività non trovata o non eliminabile da FlowOS.');
  }
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
  if(!isSupabaseConfigured)return [];
  const queue=await readQueue();
  if(!queue.length)return [];
  const failed:typeof queue=[];
  let cursor=0;
  const worker=async()=>{
    while(cursor<queue.length){
      const index=cursor++;
      const mutation=queue[index];
      try{
        const result=mutation.action==='upsert'
          ?await supabase.from(mutation.table).upsert(mutation.payload)
          :await supabase.from(mutation.table).delete().eq('id',mutation.payload.id);
        if(result.error)failed.push(mutation);
      }catch{
        failed.push(mutation);
      }
    }
  };
  await Promise.all(Array.from({length:Math.min(5,queue.length)},()=>worker()));
  await reconcileFlushedQueue(queue,failed);
  return failed;
}

/** Forces an immediate push of one specific local change when an id is supplied, or all pending changes otherwise. */
export async function pushPendingToGoogle(commitmentId?:string) {
  const startedAt=Date.now();
  if(!isSupabaseConfigured){
    void logNotificationEvent('google-push-stage-client-aborted',{commitmentId:commitmentId??null,reason:'supabase-not-configured'},'error');
    throw new Error('Supabase non è configurato: impossibile sincronizzare con Google.');
  }
  const body=commitmentId?{action:'sync-push',commitmentId}:{action:'sync-push'};
  // Diagnostic persistence must not sit in front of the actual Google request.
  void logNotificationEvent('google-push-stage-client-start',{commitmentId:commitmentId??null,supabaseConfigured:isSupabaseConfigured});
  void logNotificationEvent('google-push-stage-function-invoke',{commitmentId:commitmentId??null,action:body.action});
  const {data,error}=await supabase.functions.invoke('google-workspace',{body});
  if(error){
    void logNotificationEvent('google-push-stage-function-error',{commitmentId:commitmentId??null,elapsedMs:Date.now()-startedAt,error:{name:error.name,message:error.message,context:(error as any).context??null}},'error');
    throw error;
  }
  void logNotificationEvent('google-push-stage-function-response',{commitmentId:commitmentId??null,elapsedMs:Date.now()-startedAt,responseOk:data?.ok??null,pushed:data?.pushed??null,responseCommitmentId:data?.commitmentId??null,responseError:data?.error??null},data?.ok===false?'error':'info');
  if(data?.error)throw new Error(String(data.error));
  void logAnyPushErrors().catch(error=>recordDiagnostic('google-push-error-audit-failed',error,'warn'));
  return data;
}

/** pushLocal (server-side) catches failures per item and marks that row sync_status='error' without failing the overall sync-push call — so without this, an individual item that can't be written to Google (e.g. a birthday from the read-only Contacts calendar) fails silently. This surfaces those into the notification log so they're diagnosable instead of just an unexplained warning badge. */
async function logAnyPushErrors() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { data: errored } = await supabase.from('commitments').select('title,sync_error').eq('user_id', auth.user.id).eq('sync_status', 'error').is('deleted_at', null).limit(10);
  if (!errored?.length) return;
  await logNotificationEvent('push-to-google-item-failed', { items: errored.map((item) => ({ title: item.title, error: item.sync_error })) }, 'warn');
}
