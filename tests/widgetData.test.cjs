const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTodayGlance } = require('../.test-dist-notifications/lib/widgetData.js');

function commitment(overrides) {
  return {
    id: 'c1',
    title: 'Commitment',
    kind: 'task',
    status: 'active',
    durationMinutes: 30,
    energy: 'medium',
    context: 'lavoro',
    confidence: 0.5,
    ...overrides,
  };
}

test('no upcoming events means nextEventTitle is null', () => {
  const glance = buildTodayGlance([], new Date(2026, 6, 23, 9, 0));
  assert.equal(glance.nextEventTitle, null);
  assert.equal(glance.nextEventTime, null);
});

test('picks the soonest future event, ignores past ones', () => {
  const now = new Date(2026, 6, 23, 9, 0);
  const commitments = [
    commitment({ id: 'past', kind: 'event', title: 'Passato', scheduledAt: new Date(2026, 6, 23, 8, 0).toISOString() }),
    commitment({ id: 'later', kind: 'event', title: 'Più tardi', scheduledAt: new Date(2026, 6, 23, 15, 0).toISOString() }),
    commitment({ id: 'soon', kind: 'event', title: 'Prossimo', scheduledAt: new Date(2026, 6, 23, 10, 0).toISOString() }),
  ];
  const glance = buildTodayGlance(commitments, now);
  assert.equal(glance.nextEventTitle, 'Prossimo');
  assert.equal(glance.nextEventTime, '10:00');
});

test('dueSoonCount and overdueCount mirror the reminder engine thresholds', () => {
  const now = new Date(2026, 6, 23, 9, 0);
  const commitments = [
    commitment({ id: 'soon', dueAt: new Date(2026, 6, 23, 20, 0).toISOString() }),
    commitment({ id: 'late', dueAt: new Date(2026, 6, 22, 9, 0).toISOString() }),
  ];
  const glance = buildTodayGlance(commitments, now);
  assert.equal(glance.dueSoonCount, 1);
  assert.equal(glance.overdueCount, 1);
});

test('Today widget includes a multi-day event that started before today and is still ongoing',()=>{
  const now=new Date(2026,8,21,12,0);
  const event=commitment({id:'multi-event',kind:'event',title:'Multi-day event',status:'scheduled',scheduledAt:new Date(2026,8,20,10,0).toISOString(),durationMinutes:72*60});
  const glance=buildTodayGlance([event],now);
  assert.equal(glance.items.some(item=>item.id==='multi-event'),true);
});

test('Today widget includes a multi-day task on days after its start date',()=>{
  const now=new Date(2026,8,21,12,0);
  const task=commitment({id:'multi-task',kind:'task',title:'Multi-day task',status:'active',dueAt:new Date(2026,8,20,10,0).toISOString(),durationMinutes:72*60});
  const glance=buildTodayGlance([task],now);
  assert.equal(glance.items.some(item=>item.id==='multi-task'),true);
});


test('Today widget exposes the time range and explicit duration of a timed task',()=>{
  const now=new Date(2026,6,23,8,0);
  const task=commitment({id:'timed-task',title:'Timed task',kind:'task',status:'active',allDay:false,dueAt:new Date(2026,6,23,10,0).toISOString(),durationMinutes:90});
  const glance=buildTodayGlance([task],now);
  const item=glance.items.find(entry=>entry.id==='timed-task');
  assert.equal(item.time,'10:00 - 11:30');
  assert.equal(item.duration,'Durata: 1 h 30 min');
});
