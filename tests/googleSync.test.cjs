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
  assert.match(source,/select\("id,external_id,updated_at,external_updated_at,last_sync_origin,sync_status,status,kind,ai_metadata"\)/);
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
  assert.ok(source.includes('select("id,external_id,updated_at,external_updated_at,last_sync_origin,sync_status,status,kind,ai_metadata")'));
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
