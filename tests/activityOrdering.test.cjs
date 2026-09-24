const test=require('node:test');const assert=require('node:assert/strict');const {sortCommitmentsAlphabetically}=require('../.test-dist-notifications/lib/activityOrdering.js');

function item(id,title){return {id,title,kind:'task',status:'active',durationMinutes:30,energy:'medium',context:'test',confidence:1,dueAt:'2026-09-24T10:00:00.000Z'};}

test('sorts activities alphabetically, ignoring case, accents, and punctuation',()=>{
  const result=sortCommitmentsAlphabetically([
    item('1','Zaino'),
    item('2','Àlbero'),
    item('3','appuntamento'),
    item('4','Casa'),
  ]);
  assert.deepEqual(result.map(x=>x.title),['Àlbero','appuntamento','Casa','Zaino']);
});

test('uses time and id only as stable tie breakers',()=>{
  const result=sortCommitmentsAlphabetically([
    {...item('late','Casa'),dueAt:'2026-09-24T15:00:00.000Z'},
    {...item('early','Casa'),dueAt:'2026-09-24T10:00:00.000Z'},
  ]);
  assert.deepEqual(result.map(x=>x.id),['early','late']);
});


test('orders prioritized tasks before unprioritized tasks and by priority number',()=>{
  const result=sortCommitmentsAlphabetically([
    {...item('u','Unprioritized')},
    {...item('p2','Second',),priority:2},
    {...item('p1','First',),priority:1},
  ]);
  assert.deepEqual(result.map(x=>x.id),['p1','p2','u']);
});
