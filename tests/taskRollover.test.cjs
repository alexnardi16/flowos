const test=require('node:test');const assert=require('node:assert/strict');const {rolloverIncompleteTasks}=require('../.test-dist-notifications/lib/taskRollover.js');

function task(overrides={}){return {id:'t1',title:'Task',kind:'task',status:'active',durationMinutes:30,energy:'medium',context:'test',confidence:1,dueAt:'2026-09-23T15:30:00.000Z',...overrides};}

test('rolls an incomplete timed task from yesterday to today and preserves its time',()=>{
  const result=rolloverIncompleteTasks([task()],new Date('2026-09-24T00:01:00'));
  assert.equal(result.changed.length,1);
  assert.equal(new Date(result.commitments[0].dueAt).getDate(),24);
  assert.equal(new Date(result.commitments[0].dueAt).getHours(),new Date('2026-09-23T15:30:00.000Z').getHours());
});

test('catches up tasks that were left behind for multiple days',()=>{
  const result=rolloverIncompleteTasks([task({dueAt:'2026-09-20T15:30:00.000Z'})],new Date('2026-09-24T08:00:00'));
  assert.equal(result.changed.length,1);
  assert.equal(new Date(result.commitments[0].dueAt).getDate(),24);
});

test('does not move tasks already scheduled for today, future tasks, completed tasks, or events',()=>{
  const result=rolloverIncompleteTasks([
    task({id:'today',dueAt:'2026-09-24T15:30:00.000Z'}),
    task({id:'future',dueAt:'2026-09-25T15:30:00.000Z'}),
    task({id:'done',status:'done',dueAt:'2026-09-23T15:30:00.000Z'}),
    task({id:'event',kind:'event',scheduledAt:'2026-09-23T15:30:00.000Z',dueAt:undefined}),
  ],new Date('2026-09-24T08:00:00'));
  assert.deepEqual(result.changed.map(item=>item.id),[]);
});

test('rolls all-day task dates by calendar day',()=>{
  const result=rolloverIncompleteTasks([task({allDay:true,dueAt:'2026-09-23T00:00:00.000Z'})],new Date('2026-09-24T08:00:00'));
  assert.equal(result.changed.length,1);
  assert.equal(result.commitments[0].dueAt,'2026-09-24T00:00:00.000Z');
});
