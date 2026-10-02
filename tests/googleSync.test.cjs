const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');

test('Google Tasks sync imports completed and deleted tasks, including tasks without due dates',()=>{
  const source=fs.readFileSync('supabase/functions/google-sync-worker/index.ts','utf8');
  assert.match(source,/showCompleted:"true"/);
  assert.match(source,/showDeleted:"true"/);
  assert.match(source,/const rows=items\.map\(\(t:any\)=>/);
  assert.match(source,/status:t\.status==="completed"\?"done":"active"/);
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
  assert.match(source,/setInterval\(\(\)=>\{/);
});
