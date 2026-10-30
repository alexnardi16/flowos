const test=require('node:test');
const assert=require('node:assert/strict');
const {rolloverIncompleteTasks}=require('../.test-dist-notifications/lib/taskRollover.js');

function task(overrides={}){return {id:'t1',title:'Task',kind:'task',status:'active',durationMinutes:30,energy:'medium',context:'test',confidence:1,dueAt:'2026-09-23T15:30:00.000Z',...overrides};}

test('keeps overdue task dates unchanged instead of rolling them to today',()=>{
  const original=task();
  const result=rolloverIncompleteTasks([original],new Date('2026-09-24T00:01:00'));
  assert.equal(result.changed.length,0);
  assert.equal(result.commitments[0].dueAt,original.dueAt);
});

test('preserves dates for overdue tasks left behind for multiple days',()=>{
  const original=task({dueAt:'2026-09-20T15:30:00.000Z'});
  const result=rolloverIncompleteTasks([original],new Date('2026-09-24T08:00:00'));
  assert.equal(result.changed.length,0);
  assert.equal(result.commitments[0].dueAt,original.dueAt);
});

test('does not modify any task or event dates',()=>{
  const items=[task({id:'today',dueAt:'2026-09-24T15:30:00.000Z'}),task({id:'future',dueAt:'2026-09-25T15:30:00.000Z'}),task({id:'done',status:'done'}),task({id:'event',kind:'event',scheduledAt:'2026-09-23T15:30:00.000Z',dueAt:undefined}),task({id:'all-day',allDay:true,dueAt:'2026-09-23T00:00:00.000Z'})];
  const result=rolloverIncompleteTasks(items,new Date('2026-09-24T08:00:00'));
  assert.deepEqual(result.changed,[]);
  assert.deepEqual(result.commitments,items);
});
