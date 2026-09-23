const test=require('node:test');const assert=require('node:assert/strict');const{changedSince,bothChangedSince,bothCreatedSince,localChangedAndRemoteDeleted}=require('../.test-dist-mutations/lib/syncConflictPolicy.js');
const baseline='2026-09-23T10:00:00.000Z';
const localAfter='2026-09-23T10:05:00.000Z';
const remoteAfter='2026-09-23T10:06:00.000Z';
const before='2026-09-23T09:59:00.000Z';

test('only FlowOS changed: no conflict',()=>assert.equal(bothChangedSince(localAfter,before,baseline),false));
test('only Google changed: no conflict',()=>assert.equal(bothChangedSince(before,remoteAfter,baseline),false));
test('both sides changed after last sync: conflict',()=>assert.equal(bothChangedSince(localAfter,remoteAfter,baseline),true));
test('neither side changed after last sync: no conflict',()=>assert.equal(bothChangedSince(before,before,baseline),false));
test('both sides created after last sync: possible duplicate conflict',()=>assert.equal(bothCreatedSince(localAfter,remoteAfter,baseline),true));
test('remote deletion plus local change after last sync: conflict',()=>assert.equal(localChangedAndRemoteDeleted(localAfter,false,baseline),true));
test('remote deletion alone after last sync: no two-way conflict',()=>assert.equal(localChangedAndRemoteDeleted(before,false,baseline),false));
test('resolved conflict baseline prevents immediate reappearance',()=>assert.equal(bothChangedSince(localAfter,remoteAfter,'2026-09-23T10:10:00.000Z'),false));
test('missing baseline does not manufacture a conflict on initial sync',()=>assert.equal(bothChangedSince(localAfter,remoteAfter,null),false));
