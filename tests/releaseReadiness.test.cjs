const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('all macrosections use the exact FlowOS brand casing beside the logo', () => {
  const ui = read('components/ui.tsx');
  assert.match(ui, /<Text style=\{\[styles\.screenBrand,\{color:screenForeground\}\]\}>FlowOS<\/Text>/);
  assert.doesNotMatch(ui, /<Text style={styles\.screenBrand}>FLOWOS<\/Text>/);
});

test('release validation runs every critical regression suite in CI', () => {
  const pkg = JSON.parse(read('package.json'));
  const workflow = read('.github/workflows/ci.yml');
  for (const suite of ['test:auth', 'test:mutations', 'test:voice', 'test:widget', 'test:sync', 'test:notifications', 'test:public-site', 'test:release-readiness']) {
    assert.ok(pkg.scripts.test.includes(`npm run ${suite}`), `npm test must include ${suite}`);
  }
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /expo lint/);
  assert.match(workflow, /expo-doctor/);
  assert.match(workflow, /expo export --platform web/);
});

test('create and edit persist changes before immediately scheduling Google synchronization in the background', () => {
  const store = read('lib/store.ts');
  const addStart = store.indexOf('addCommitment:async');
  const addEnd = store.indexOf('rolloverTodayTasks:async', addStart);
  const add = store.slice(addStart, addEnd);
  assert.match(add,/await Promise\.all\(toSave\.map\(saveCommitment\)\)/);
  assert.match(add,/scheduleGooglePush\(normalized\.id\)/);
  assert.ok(add.indexOf('scheduleGooglePush(normalized.id)') > add.indexOf('await Promise.all(toSave.map(saveCommitment))'));

  const editStart = store.indexOf('updateCommitment:async');
  const editEnd = store.indexOf('removeOnlyFromFlowOS:async', editStart);
  const edit = store.slice(editStart, editEnd);
  assert.match(edit,/await Promise\.all\(toSave\.map\(saveCommitment\)\)/);
  assert.match(edit,/scheduleGooglePush\(updated\.id\)/);
  assert.ok(edit.indexOf('scheduleGooglePush(updated.id)') > edit.indexOf('await Promise.all(toSave.map(saveCommitment))'));
});

test('Google deletion and FlowOS-only tombstones are separate, explicit operations', () => {
  const store = read('lib/store.ts');
  const repository = read('lib/commitmentsRepository.ts');
  const server = read('supabase/functions/google-workspace/index.ts');
  assert.match(store, /removeAlsoFromGoogle:async/);
  assert.match(store, /await deleteCommitmentAlsoFromGoogle\(item\)/);
  assert.match(repository, /action:\s*['"]hide-from-flowos['"]/);
  assert.match(server, /last_sync_origin:"flowos"/);
  assert.match(server, /deleted_at:now\(\)/);
});

test('offline mutations are serialized and reconciled without dropping concurrent edits', () => {
  const queue = read('lib/offlineQueue.ts');
  const state = read('lib/offlineQueueState.ts');
  assert.match(queue, /function withQueueLock/);
  assert.match(queue, /reconcileQueueAfterFlush/);
  assert.match(state, /reconcileQueueAfterFlush/);
  assert.match(state, /parsePendingQueue/);
});

test('app calendar and Today/widget views use shared timeline and visibility rules', () => {
  const calendar = read('app/(tabs)/calendar.tsx');
  const today = read('app/(tabs)/today.tsx');
  const widgetData = read('widget-task-handler.tsx');
  assert.match(calendar, /buildCalendarTimeline/);
  assert.match(today, /isVisibleInToday/);
  assert.match(widgetData, /todayData/);
  assert.match(widgetData, /refreshFromGoogle/);
});

test('account exit clears the diagnostic session and auth subscriptions are cleaned up', () => {
  const auth = read('providers/AuthProvider.tsx');
  assert.match(auth, /await supabase\.auth\.signOut\(\)/);
  assert.match(auth, /endDiagnosticSession\(\)/);
  assert.match(auth, /subscription\?\.unsubscribe\(\)/);
  assert.match(auth, /supabase\.removeChannel\(channel\)/);
});

test('sign-out unregisters the current device push token from the active FlowOS account', () => {
  const auth = read('providers/AuthProvider.tsx');
  const push = read('lib/googlePushSync.ts');
  assert.match(auth, /unregisterGooglePushToken\(session\.user\.id\)/);
  assert.match(push, /device_push_tokens/);
  assert.match(push, /\.delete\(\).*user_id.*expo_push_token/);
});

test('account deletion removes Expo push tokens as well as Google and FlowOS account data', () => {
  const deletion = read('supabase/functions/delete-account/index.ts');
  assert.match(deletion, /device_push_tokens/);
  assert.match(deletion, /google_oauth_tokens/);
  assert.match(deletion, /admin\.auth\.admin\.deleteUser\(user\.id\)/);
});

test('release checklist explicitly separates automated checks from physical-device acceptance', () => {
  const checklist = read('docs/RELEASE_1.0.0_CHECKLIST.md');
  assert.match(checklist, /Functional acceptance on a physical Android device/);
  assert.match(checklist, /Google Calendar \/ Tasks synchronization/);
  assert.match(checklist, /Offline recovery/);
  assert.match(checklist, /Timezone and daylight-saving transition/);
  assert.match(checklist, /Notifications and widgets/);
});


test('initial cloud hydration is not blocked by Google connection discovery or synchronization',()=>{
  const auth=read('providers/AuthProvider.tsx');
  assert.ok(auth.indexOf("initial-cloud-hydration-failed")<auth.indexOf("google-auto-sync-started"));
  assert.match(auth,/void hydrateFromCloud\(\)/);
  assert.match(auth,/syncGoogleWorkspace\(/);
});

test('commitment persistence avoids serial notification-log writes on the critical save path',()=>{
  const repository=read('lib/commitmentsRepository.ts');
  const start=repository.indexOf('export async function saveCommitment');
  const end=repository.indexOf('export async function loadCommitmentById',start);
  const save=repository.slice(start,end);
  assert.doesNotMatch(save,/await logNotificationEvent/);
  assert.match(save,/recordDiagnostic\('commitment-save-completed'/);
});


test('offline queue flushes independent mutations concurrently with a bounded worker pool',()=>{
  const repository=read('lib/commitmentsRepository.ts');
  const start=repository.indexOf('export async function flushOfflineQueue');
  const end=repository.indexOf('export async function pushPendingToGoogle',start);
  const flush=repository.slice(start,end);
  assert.match(flush,/const worker=async\(\)=>/);
  assert.match(flush,/Math\.min\(5,queue\.length\)/);
  assert.match(flush,/await Promise\.all\(Array\.from/);
  assert.match(flush,/reconcileFlushedQueue\(queue,failed\)/);
});


test('voice mutations reuse the store immediate-push path instead of starting a second full Google sync',()=>{
  const capture=read('app/(tabs)/capture.tsx');
  const start=capture.indexOf('async function executeVoice');
  const end=capture.indexOf('async function startVoice',start);
  const voice=capture.slice(start,end);
  assert.doesNotMatch(voice,/await syncGoogleWorkspace\(\)/);
  assert.match(voice,/await addCommitment\(/);
  assert.match(voice,/await useFlowStore\.getState\(\)\.complete/);
  assert.match(voice,/await postpone\(item\.id\)/);
  assert.match(voice,/await updateCommitment\(/);
});


test('multi-item persistence uses a bounded worker pool instead of an unbounded request burst',()=>{
  const helper=read('lib/asyncBatch.ts');
  const store=read('lib/store.ts');
  const widget=read('widget-task-handler.tsx');
  assert.match(helper,/Math\.min\(items\.length,Math\.max\(1,Math\.floor\(concurrency\)\|\|1\)\)/);
  assert.match(helper,/await Promise\.all\(Array\.from/);
  assert.match(store,/runWithConcurrency\(toSave,saveCommitment\)/);
  assert.match(widget,/runWithConcurrency\(toSave,saveCommitment\)/);
});
