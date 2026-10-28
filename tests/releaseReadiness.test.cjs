const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

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

test('create and edit persist locally before attempting an immediate Google push', () => {
  const store = read('lib/store.ts');
  const addStart = store.indexOf('addCommitment:async');
  const addEnd = store.indexOf('rolloverTodayTasks:async', addStart);
  const add = store.slice(addStart, addEnd);
  assert.ok(add.indexOf('await saveCommitment(changed)') >= 0);
  assert.ok(add.indexOf('await pushGoogleAndRefresh(commitment.id)') > add.indexOf('await saveCommitment(changed)'));

  const editStart = store.indexOf('updateCommitment:async');
  const editEnd = store.indexOf('removeOnlyFromFlowOS:async', editStart);
  const edit = store.slice(editStart, editEnd);
  assert.ok(edit.indexOf('await saveCommitment(changed)') >= 0);
  assert.ok(edit.indexOf('await pushGoogleAndRefresh()') > edit.indexOf('await saveCommitment(changed)'));
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

test('release checklist explicitly separates automated checks from physical-device acceptance', () => {
  const checklist = read('docs/RELEASE_1.0.0_CHECKLIST.md');
  assert.match(checklist, /Functional acceptance on a physical Android device/);
  assert.match(checklist, /Google Calendar \/ Tasks synchronization/);
  assert.match(checklist, /Offline recovery/);
  assert.match(checklist, /Timezone and daylight-saving transition/);
  assert.match(checklist, /Notifications and widgets/);
});
