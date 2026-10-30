const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');const assert=require('node:assert/strict');const{upsertCommitmentState,removeCommitmentState,mergeRemoteCommitments}=require('../.test-dist-mutations/lib/commitmentState.js');
const{initialSyncStatus,shouldPushToGoogle,shouldPreserveLocalTombstone}=require('../.test-dist-mutations/lib/commitmentSyncPolicy.js');
function item(id,kind,title=id){return{id,title,kind,status:kind==='event'?'scheduled':'active',durationMinutes:30,energy:'medium',context:kind==='event'?'Calendario':'Google Tasks',confidence:1};}
test('creates an event',()=>{const created=item('event-1','event','Visita');assert.deepEqual(upsertCommitmentState([],created),[created]);});
test('creates a task',()=>{const created=item('task-1','task','Telefonare');assert.deepEqual(upsertCommitmentState([],created),[created]);});
test('updates an event without duplication',()=>{const original=item('event-1','event','Vecchio');const updated={...original,title:'Nuovo',durationMinutes:60};const next=upsertCommitmentState([original],updated);assert.equal(next.length,1);assert.deepEqual(next[0],updated);});
test('updates a task without duplication',()=>{const original=item('task-1','task','Vecchio');const updated={...original,title:'Nuovo',status:'waiting'};const next=upsertCommitmentState([original],updated);assert.equal(next.length,1);assert.deepEqual(next[0],updated);});
test('deletes an event',()=>{const event=item('event-1','event');const task=item('task-1','task');assert.deepEqual(removeCommitmentState([event,task],event.id),[task]);});
test('deletes a task',()=>{const event=item('event-1','event');const task=item('task-1','task');assert.deepEqual(removeCommitmentState([event,task],task.id),[event]);});
test('preserves pending local data during a remote refresh',()=>{const pending=item('event-1','event','Nuovo evento');const remote=item('task-1','task');assert.deepEqual(mergeRemoteCommitments([remote],[pending,remote],[pending.id]),[pending,remote]);});
test('preserves a pending FlowOS completion over stale remote active state',()=>{const local={...item('task-1','task','Task completato'),status:'done',syncStatus:'pending'};const remote={...item('task-1','task','Task completato'),status:'active'};assert.equal(mergeRemoteCommitments([remote],[local],[])[0].status,'done');});

test('a newly created event is pending even when it is already completed',()=>{
  assert.equal(initialSyncStatus({kind:'event',status:'done'}),'pending');
});
test('a newly created task is pending even when it is already completed',()=>{
  assert.equal(initialSyncStatus({kind:'task',status:'done'}),'pending');
});
test('an existing Google-linked completed event does not require a Google completion write',()=>{
  assert.equal(initialSyncStatus({kind:'event',status:'done',externalId:'google-event-1'}),'synced');
});
test('a newly created commitment without a Google ID must always be pushed',()=>{
  assert.equal(initialSyncStatus({kind:'event',status:'scheduled'}),'pending');
  assert.equal(shouldPushToGoogle({}),true);
  assert.equal(shouldPushToGoogle({deletedAt:'2026-10-07T12:00:00.000Z'}),false);
});
test('a FlowOS-only deletion is represented as a tombstone and is preserved across Google pulls',()=>{
  assert.equal(shouldPreserveLocalTombstone({deletedAt:'2026-10-07T12:00:00.000Z',lastSyncOrigin:'flowos'}),true);
  assert.equal(shouldPreserveLocalTombstone({deletedAt:'2026-10-07T12:00:00.000Z',lastSyncOrigin:'google'}),false);
});

const repoSource=fs.readFileSync(path.join(__dirname,'..','lib','commitmentsRepository.ts'),'utf8');
const storeSource=fs.readFileSync(path.join(__dirname,'..','lib','store.ts'),'utf8');
const manageSource=fs.readFileSync(path.join(__dirname,'..','components','ManageSheet.tsx'),'utf8');
const serverSource=fs.readFileSync(path.join(__dirname,'..','supabase','functions','google-workspace','index.ts'),'utf8');

test('local-only deletion uses the server-side FlowOS tombstone action',()=>{
  assert.match(repoSource,/action:\s*['"]hide-from-flowos['"]/);
  assert.match(serverSource,/action===["']hide-from-flowos["']/);
  assert.match(serverSource,/deleted_at:now\(\)/);
  assert.match(serverSource,/last_sync_origin:"flowos"/);
});

test('Google pull loads deleted_at before applying FlowOS tombstone protection',()=>{
  assert.match(serverSource,/select\(["']id,external_id,updated_at,last_sync_origin,status,kind,ai_metadata,priority,deleted_at["']\)/);
  assert.match(serverSource,/found\?\.deleted_at&&found\.last_sync_origin===["']flowos["']/);
});

test('manual sync from Manage is targeted to the exact commitment',()=>{
  assert.match(storeSource,/syncItemToGoogleNow:\(id:string\)=>/);
  assert.match(manageSource,/syncItemToGoogleNow\(item\.id\)/);
});


test('creating an activity immediately persists it and starts a targeted Google push',()=>{
  const add=storeSource.slice(storeSource.indexOf('addCommitment:async'),storeSource.indexOf('rolloverTodayTasks:async'));
  assert.ok(add.indexOf('await saveCommitment(changed)')>=0);
  assert.ok(add.indexOf('await pushGoogleAndRefresh(commitment.id)')>add.indexOf('await saveCommitment(changed)'));
  assert.match(add,/store-add-commitment-google-push-start/);
  assert.match(add,/store-add-commitment-google-push-success/);
  assert.match(add,/store-add-commitment-google-push-failed/);
});
test('editing an activity immediately persists the edit and triggers Google push',()=>{
  const start=storeSource.indexOf('updateCommitment:async');
  const end=storeSource.indexOf('removeOnlyFromFlowOS:async',start);
  const edit=storeSource.slice(start,end);
  assert.ok(edit.indexOf('await saveCommitment(changed)')>=0);
  assert.ok(edit.indexOf('await pushGoogleAndRefresh()')>edit.indexOf('await saveCommitment(changed)'));
});
test('deleting an activity from both FlowOS and Google invokes the Google deletion repository',()=>{
  const start=storeSource.indexOf('removeAlsoFromGoogle:async');
  const end=storeSource.indexOf('removeSeriesFromGoogle:async',start);
  const remove=storeSource.slice(start,end);
  assert.match(remove,/await deleteCommitmentAlsoFromGoogle\(item\)/);
  assert.ok(remove.indexOf('await deleteCommitmentAlsoFromGoogle(item)')<remove.indexOf('set({commitments:next})'));
});
test('FlowOS-only deletion keeps a tombstone so Google refresh cannot recreate the item',()=>{
  const start=storeSource.indexOf('removeOnlyFromFlowOS:async');
  const end=storeSource.indexOf('removeAlsoFromGoogle:async',start);
  const remove=storeSource.slice(start,end);
  assert.match(remove,/await removeCommitmentOnlyFromFlowOS\(id\)/);
  assert.match(repoSource,/action:\s*['"]hide-from-flowos['"]/);
  assert.match(serverSource,/last_sync_origin:"flowos"/);
});

const { parsePendingQueue, reconcileQueueAfterFlush } = require('../.test-dist-mutations/lib/offlineQueueState.js');
function queueMutation(mutationId, commitmentId, title = commitmentId, createdAt = '2026-10-27T10:00:00.000Z') {
  return { id: mutationId, table: 'commitments', action: 'upsert', payload: { id: commitmentId, title }, createdAt };
}
test('offline queue rejects corrupt JSON instead of silently treating it as empty', () => {
  assert.throws(() => parsePendingQueue('{broken'), /danneggiata/);
});
test('offline queue rejects malformed entries without discarding stored data', () => {
  assert.throws(() => parsePendingQueue(JSON.stringify([{ id: 7, action: 'upsert' }])), /non valida/);
});
test('offline queue accepts an empty queue and valid mutations', () => {
  assert.deepEqual(parsePendingQueue('[]'), []);
  const pending = queueMutation('mutation-1', 'task-1');
  assert.deepEqual(parsePendingQueue(JSON.stringify([pending])), [pending]);
});
test('flush reconciliation preserves a mutation enqueued while network requests were running', () => {
  const snapshot = [queueMutation('old', 'task-1')];
  const concurrent = queueMutation('new', 'task-2');
  assert.deepEqual(reconcileQueueAfterFlush(snapshot, [], [...snapshot, concurrent]), [concurrent]);
});
test('flush reconciliation keeps the newest edit when an older edit fails', () => {
  const oldEdit = queueMutation('old', 'task-1', 'Old');
  const newEdit = queueMutation('new', 'task-1', 'New', '2026-10-27T10:01:00.000Z');
  assert.deepEqual(reconcileQueueAfterFlush([oldEdit], [oldEdit], [newEdit]), [newEdit]);
});
test('flush reconciliation retains failed mutations that have not been superseded', () => {
  const failed = queueMutation('failed', 'task-1');
  const unrelated = queueMutation('other', 'task-2');
  assert.deepEqual(reconcileQueueAfterFlush([failed], [failed], [failed, unrelated]), [unrelated, failed]);
});
test('flush reconciliation removes successful snapshot entries but keeps unrelated current entries', () => {
  const succeeded = queueMutation('successful', 'task-1');
  const concurrent = queueMutation('concurrent', 'task-2');
  assert.deepEqual(reconcileQueueAfterFlush([succeeded], [], [succeeded, concurrent]), [concurrent]);
});


test('recurring completion offers occurrence or series while widget completion remains occurrence-only',()=>{
  const prompt=fs.readFileSync(path.join(__dirname,'..','lib','completePrompt.ts'),'utf8');
  const widget=fs.readFileSync(path.join(__dirname,'..','widget-task-handler.tsx'),'utf8');
  const complete=storeSource.slice(storeSource.indexOf('  complete:async'),storeSource.indexOf('  postpone:async'));
  assert.match(prompt,/item\.recurrenceRule \|\| item\.recurrenceSeriesId \|\| item\.googleRecurringEventId/);
  assert.match(prompt,/Solo questa occorrenza/);
  assert.match(prompt,/Tutta la serie/);
  assert.match(complete,/scope==='series'/);
  assert.match(complete,/candidate\.recurrenceSeriesId===seriesId/);
  assert.match(widget,/materializeNextOccurrence\(updated,items\)/);
  assert.doesNotMatch(widget,/requestComplete|Alert\.alert/);
});
