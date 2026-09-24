const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTaskPriorities, reorderTaskPriorities, nextTaskPriority } = require('../.test-dist-notifications/lib/taskPriority.js');

function task(id, title, priority, status='active', dueAt) {
  return { id, title, kind:'task', status, priority, durationMinutes:60, energy:'medium', context:'Google Tasks', confidence:1, dueAt };
}

test('leaves unprioritized tasks without a priority', () => {
  const items = [task('a','A',undefined), task('b','B',undefined), task('c','C',undefined)];
  const next = normalizeTaskPriorities(items);
  assert.deepEqual(next.map(x => x.priority), [undefined,undefined,undefined]);
});

test('renumbers only tasks with an explicit priority', () => {
  const items = [task('a','A',8), task('b','B',2), task('c','C',undefined)];
  const next = normalizeTaskPriorities(items);
  assert.deepEqual(next.map(x => x.priority), [2,1,undefined]);
});

test('moving a prioritized task to priority 1 shifts the other prioritized tasks down', () => {
  const items = [task('a','A',1), task('b','B',2), task('c','C',3), task('d','D',undefined)];
  const next = reorderTaskPriorities(items, 'c', 1);
  assert.deepEqual(next.map(x => [x.id,x.priority]), [['a',2],['b',3],['c',1],['d',undefined]]);
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
