const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTaskPriorities, reorderTaskPriorities, nextTaskPriority } = require('../.test-dist-notifications/lib/taskPriority.js');

function task(id, title, priority, status='active') {
  return { id, title, kind:'task', status, priority, durationMinutes:60, energy:'medium', context:'Google Tasks', confidence:1 };
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
