const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTaskPriorities, reorderTaskPriorities, nextTaskPriority } = require('../.test-dist-notifications/lib/taskPriority.js');

function task(id, title, priority, status='active', dueAt) {
  return { id, title, kind:'task', status, priority, durationMinutes:60, energy:'medium', context:'Google Tasks', confidence:1, dueAt };
}

test('leaves unprioritized tasks without a priority', () => {
  const items = [task('a','A',undefined), task('b','B',undefined), task('c','C',undefined)];
  assert.deepEqual(normalizeTaskPriorities(items).map(x => x.priority), [undefined,undefined,undefined]);
});

test('renumbers only tasks with an explicit priority', () => {
  const items = [task('a','A',8), task('b','B',2), task('c','C',undefined)];
  assert.deepEqual(normalizeTaskPriorities(items).map(x => x.priority), [2,1,undefined]);
});

test('moving a task to an occupied priority shifts all following tasks down', () => {
  const items = [task('a','A',1), task('b','B',2), task('c','C',3), task('d','D',undefined)];
  const next = reorderTaskPriorities(items, 'c', 1);
  assert.deepEqual(next.map(x => [x.id,x.priority]), [['a',2],['b',3],['c',1],['d',undefined]]);
});

test('priority changes are global across dates, including overdue tasks', () => {
  const items = [
    task('today','Today',1,'active','2026-10-30T10:00:00+01:00'),
    task('overdue','Overdue',2,'active','2026-10-29T10:00:00+01:00'),
    task('later','Later',3,'active','2026-11-01T10:00:00+01:00'),
  ];
  const next = reorderTaskPriorities(items, 'overdue', 1);
  assert.deepEqual(next.map(x => [x.id,x.priority]), [['today',2],['overdue',1],['later',3]]);
  assert.deepEqual(normalizeTaskPriorities(next).map(x => x.priority), [2,1,3]);
});

test('duplicate priorities are normalized globally, not separately by date', () => {
  const items = [
    task('a','A',1,'active','2026-10-30T10:00:00+01:00'),
    task('b','B',1,'active','2026-10-29T10:00:00+01:00'),
    task('c','C',3,'active','2026-11-01T10:00:00+01:00'),
  ];
  assert.deepEqual(normalizeTaskPriorities(items).map(x => x.priority), [1,2,3]);
});

test('clearing a priority makes the task unprioritized and renumbers the remaining prioritized tasks', () => {
  const items = [task('a','A',1), task('b','B',2), task('c','C',undefined)];
  const next = reorderTaskPriorities(items, 'a', undefined);
  assert.deepEqual(next.map(x => [x.id,x.priority]), [['a',undefined],['b',1],['c',undefined]]);
});

test('completed tasks are excluded from priority numbering', () => {
  const items = [task('a','A',1), task('b','B',2,'done')];
  assert.equal(nextTaskPriority(items), 2);
});

test('next priority is global regardless of the supplied task date', () => {
  const items = [
    task('a','A',1,'active','2026-09-24T10:00:00+02:00'),
    task('b','B',2,'active','2026-09-24T11:00:00+02:00'),
    task('c','C',3,'active','2026-09-25T10:00:00+02:00'),
  ];
  assert.equal(nextTaskPriority(items, items[2]), 4);
});
