const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');

test('Google Tasks sync imports completed and deleted tasks, including tasks without due dates',()=>{
  const source=fs.readFileSync('supabase/functions/google-sync-worker/index.ts','utf8');
  assert.match(source,/showCompleted:"true"/);
  assert.match(source,/showDeleted:"true"/);
  assert.match(source,/const rows=items\.map\(\(t:any\)=>/);
  assert.match(source,/status:t\.status==="completed"\?"completed":"active"/);
  assert.match(source,/deleted_at:t\.deleted\?now\(\):null/);
});

test('normal foreground Google sync does not run the conflict guard on every sync',()=>{
  const source=fs.readFileSync('lib/googleWorkspace.ts','utf8');
  const start=source.indexOf('async function syncGoogleWorkspaceInternal');
  const end=source.indexOf('let taskIncrementalInFlight',start);
  const body=source.slice(start,end);
  assert.doesNotMatch(body,/invokeSyncGuard\(\)/);
});

test('foreground remote sync is continuously refreshed while the app is active',()=>{
  const source=fs.readFileSync('providers/AuthProvider.tsx','utf8');
  assert.match(source,/syncGoogleRemote\(\)/);
  assert.match(source,/setInterval\(\(\)\s*=>\s*\{/);
});


test('Google pulls preserve FlowOS-only metadata such as custom reminders',()=>{
  const source=fs.readFileSync('supabase/functions/google-sync-worker/index.ts','utf8');
  assert.match(source,/select\("id,external_id,external_resource_type,google_calendar_id,google_task_list_id,updated_at,external_updated_at,last_sync_origin,sync_status,status,kind,ai_metadata"\)/);
  assert.match(source,/ai_metadata:\{\.\.\.\(found\?\.ai_metadata\?\?\{\}\),\.\.\.\(row\.ai_metadata\?\?\{\}\)\}/);
});

test('background sync refreshes both Google Calendar and Google Tasks and replans local reminders',()=>{
  const source=fs.readFileSync('lib/backgroundSyncService.ts','utf8');
  const start=source.indexOf('TaskManager.defineTask(GOOGLE_TASKS_BACKGROUND_TASK');
  const end=source.indexOf('TaskManager.defineTask(DAILY_SUMMARY_TASK',start);
  const body=source.slice(start,end);
  assert.match(body,/syncGoogleWorkspace\(\)/);
  assert.match(body,/safeRunReminderEngine\(commitments, now\)/);
  assert.doesNotMatch(body,/syncGoogleTasksIncremental\(\)/);
});

test('scheduled custom reminders are sticky and not auto-dismissed on Android',()=>{
  const source=fs.readFileSync('lib/reminderEngine.ts','utf8');
  assert.match(source,/sticky: Platform\.OS === 'android',[\s\S]*?autoDismiss: false/);
  assert.match(source,/priority: Platform\.OS === 'android' \? Notifications\.AndroidNotificationPriority\.MAX/);
});

test('Google push background delivery also refreshes locally scheduled reminders',()=>{
  const source=fs.readFileSync('lib/googlePushSync.ts','utf8');
  assert.match(source,/await runReminderEngine\(commitments,now\)/);
  assert.match(source,/remindersRefreshed:true/);
});


test('Google updates newer than the last synced remote version override a stale local FlowOS copy',()=>{
  const source=fs.readFileSync('supabase/functions/google-sync-worker/index.ts','utf8');
  assert.ok(source.includes('select("id,external_id,external_resource_type,google_calendar_id,google_task_list_id,updated_at,external_updated_at,last_sync_origin,sync_status,status,kind,ai_metadata")'));
  assert.ok(source.includes('remoteChangedSinceLastSync=Boolean(found?.external_updated_at&&row.external_updated_at&&new Date(row.external_updated_at).getTime()>new Date(found.external_updated_at).getTime())'));
  assert.ok(source.includes('&&!remoteChangedSinceLastSync)return[]'));
});

test('foreground sync imports Google changes before attempting a push',()=>{
  const source=fs.readFileSync('lib/googleWorkspace.ts','utf8');
  const start=source.indexOf('async function syncGoogleWorkspaceInternal');
  const end=source.indexOf('let taskIncrementalInFlight',start);
  const body=source.slice(start,end);
  assert.ok(body.indexOf("invoke({action:'sync-incremental'})") < body.indexOf("invoke({action:'sync-push'})"));
});


test('Google change pushes request high-priority background delivery',()=>{
  const source=fs.readFileSync('supabase/functions/google-sync-worker/index.ts','utf8');
  assert.ok(source.includes('priority:"high",ttl:60,_contentAvailable:true'));
});

test('Manage sheet matches Add time inputs and keeps a zero-minute reminder option',()=>{
  const source=fs.readFileSync('components/ManageSheet.tsx','utf8');
  assert.ok(source.includes("const REMINDER_PRESETS = [0, 15, 60, 1440]"));
  assert.ok(source.includes("label={t('Orario di inizio')} value={timeStr} onChangeText={updateStartTime} placeholder=\"HH:MM\""));
  assert.ok(source.includes("label={t('Orario di fine')} value={endTime} onChangeText={updateEndTime} placeholder=\"HH:MM\""));

});


test('expired events are auto-completed globally while the app is active, not only on Today',()=>{
  const source=fs.readFileSync('providers/AuthProvider.tsx','utf8');
  assert.match(source,/autoCompleteExpiredEvents\(\)/);
  assert.match(source,/eventCompletionInterval = setInterval/);
  assert.match(source,/runAutoComplete\(\)/);
  const today=fs.readFileSync('app\/(tabs)\/today.tsx','utf8');
  assert.doesNotMatch(today,/autoCompleteExpiredEvents/);
});

test('background refresh and maintenance also complete expired events and refresh the widget',()=>{
  const source=fs.readFileSync('lib/backgroundSyncService.ts','utf8');
  assert.match(source,/autoCompleteExpiredEvents\(loaded, now\)/);
  assert.match(source,/autoCompleteExpiredEvents\(loaded, new Date\(\)\)/);
  assert.match(source,/syncTodayWidget\(commitments, now\)/);
});


test('Google pushes atomically claim each commitment so foreground, background and webhook workers cannot POST it twice',()=>{
  const migration=fs.readFileSync('supabase/migrations/20261105090000_google_push_idempotency.sql','utf8');
  const workspace=fs.readFileSync('supabase/functions/google-workspace/index.ts','utf8');
  const worker=fs.readFileSync('supabase/functions/google-sync-worker/index.ts','utf8');
  assert.match(migration,/add column if not exists sync_claimed_at timestamptz/i);
  assert.match(migration,/create or replace function public\.claim_flowos_google_push/i);
  assert.match(migration,/update public\.commitments/i);
  assert.match(migration,/interval '5 minutes'/i);
  assert.match(migration,/grant execute .*service_role/i);
  assert.match(workspace,/rpc\("claim_flowos_google_push"/);
  assert.match(worker,/rpc\("claim_flowos_google_push"/);
  assert.match(workspace,/sync_claimed_at:null/);
  assert.match(worker,/sync_claimed_at:null/);
});

test('Calendar create retries recover the original event by its stable FlowOS commitment ID and clean prior duplicates',()=>{
  const workspace=fs.readFileSync('supabase/functions/google-workspace/index.ts','utf8');
  const worker=fs.readFileSync('supabase/functions/google-sync-worker/index.ts','utf8');
  assert.match(workspace,/privateExtendedProperty:"flowosCommitmentId="/);
  assert.match(workspace,/matches\[0\]\?\?await gfetch\(base,token/);
  assert.match(workspace,/duplicate-calendar-event-cleaned/);
  assert.match(worker,/extendedProperties:\{private:\{flowosCommitmentId:c\.id\}\}/);
});

test('Google imports match external resources by resource type and calendar or task list, not external ID alone',()=>{
  const workspace=fs.readFileSync('supabase/functions/google-workspace/index.ts','utf8');
  const worker=fs.readFileSync('supabase/functions/google-sync-worker/index.ts','utf8');
  assert.match(workspace,/function externalIdentity\(row:any\)/);
  assert.match(worker,/function externalIdentity\(row:any\)/);
  assert.match(workspace,/map\.get\(externalIdentity\(row\)\)/);
  assert.match(worker,/map\.get\(externalIdentity\(row\)\)/);
});

test('Google push worker does not reclaim a live lease and can recover abandoned syncing rows',()=>{
  const workspace=fs.readFileSync('supabase/functions/google-workspace/index.ts','utf8');
  const worker=fs.readFileSync('supabase/functions/google-sync-worker/index.ts','utf8');
  assert.match(workspace,/\["pending","error","syncing"\]/);
  assert.match(worker,/\["pending","syncing"\]/);
  assert.match(workspace,/item-push-skipped-already-claimed/);
});


test('task writes release the atomic lease after success and the worker recovers Calendar POST retries',()=>{
  const workspace=fs.readFileSync('supabase/functions/google-workspace/index.ts','utf8');
  const worker=fs.readFileSync('supabase/functions/google-sync-worker/index.ts','utf8');
  assert.match(workspace,/google_task_list_id:listId,[\s\S]*?sync_status:"synced",sync_claimed_at:null/);
  assert.match(worker,/createOrRecoverCalendarEvent\(userId,c\.google_calendar_id,c\)/);
  assert.match(worker,/privateExtendedProperty:"flowosCommitmentId="/);
});


test('Add form serializes rapid create taps before the first asynchronous operation',()=>{
  const capture=fs.readFileSync('app/(tabs)/capture.tsx','utf8');
  assert.match(capture,/const createInFlightRef=useRef\(false\)/);
  assert.match(capture,/async function create\(\)\{if\(createInFlightRef\.current\)return;createInFlightRef\.current=true;try\{await createOnce\(\);\}finally\{createInFlightRef\.current=false;\}\}/);
  const start=capture.indexOf('async function create(){');
  const end=capture.indexOf('function findVoiceItem',start);
  const guard=capture.slice(start,end);
  assert.ok(guard.indexOf('createInFlightRef.current=true')<guard.indexOf('await createOnce()'));
});
