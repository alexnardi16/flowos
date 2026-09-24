const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTaskPriorities, reorderTaskPriorities, nextTaskPriority } = require('../.test-dist-notifications/lib/taskPriority.js');

function task(id, title, priority, status='active', dueAt) {
  return { id, title, kind:'task', status, priority, durationMinutes:60, energy:'medium', context:'Google Tasks', confidence:1, dueAt };
}

test('normalizes task priorities to a contiguous 1..N sequence', () => {
  const items = [task('a','A',8), task('b','B',2), task('c','C',undefined)];
  const next = normalizeTaskPriorities(items);
  assert.deepEqual(next.map(x => x.priority), [2,1,3]);
});

test('moving a task to priority 1 shifts the others down', () => {
  const items = [task('a','A',1), task('b','B',2), task('c','C',3)];
  const next = reorderTaskPriorities(items, 'c', 1);
  assert.deepEqual(next.map(x => [x.id,x.priority]), [['a',2],['b',3],['c',1]]);
});

test('completed tasks are excluded and the next new task gets the next number', () => {
  const items = [task('a','A',1), task('b','B',2,'done')];
  assert.equal(nextTaskPriority(items), 2);
});

test('priorities restart at 1 on each day', () => {
  const items = [
    task('a','A',4,'active','2026-09-24T10:00:00+02:00'),
    task('b','B',2,'active','2026-09-24T11:00:00+02:00'),
    task('c','C',1,'active','2026-09-25T10:00:00+02:00'),
  ];
  const next = normalizeTaskPriorities(items);
  assert.deepEqual(next.map(x => [x.id,x.priority]), [['a',2],['b',1],['c',1]]);
  assert.equal(nextTaskPriority(next, items[2]), 2);
});

test('moving a task only renumbers tasks on the same day', () => {
  const items = [
    task('a','A',1,'active','2026-09-24T10:00:00+02:00'),
    task('b','B',2,'active','2026-09-24T11:00:00+02:00'),
    task('c','C',1,'active','2026-09-25T10:00:00+02:00'),
  ];
  const next = reorderTaskPriorities(items, 'b', 1);
  assert.deepEqual(next.map(x => [x.id,x.priority]), [['a',2],['b',1],['c',1]]);
});
