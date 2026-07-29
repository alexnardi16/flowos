const test = require('node:test');
const assert = require('node:assert/strict');
const { buildReminderPlan, summarizeTaskList } = require('../.test-dist-notifications/lib/reminderPlan.js');

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

test('a task due within 24h is due-soon, one due in 30h is not', () => {
  const now = new Date(2026, 6, 23, 9, 0);
  const commitments = [
    commitment({ id: 'soon', dueAt: new Date(2026, 6, 24, 8, 0).toISOString() }),
    commitment({ id: 'later', dueAt: new Date(2026, 6, 24, 15, 0).toISOString() }),
  ];
  const plan = buildReminderPlan(commitments, now);
  assert.deepEqual(plan.dueSoon.map((t) => t.id), ['soon']);
});

test('a task whose due date already passed is overdue, not due-soon', () => {
  const now = new Date(2026, 6, 23, 9, 0);
  const commitments = [
    commitment({ id: 'late', dueAt: new Date(2026, 6, 22, 9, 0).toISOString() }),
  ];
  const plan = buildReminderPlan(commitments, now);
  assert.deepEqual(plan.overdue.map((t) => t.id), ['late']);
  assert.equal(plan.dueSoon.length, 0);
});

test('done and deleted tasks never appear in due-soon or overdue', () => {
  const now = new Date(2026, 6, 23, 9, 0);
  const commitments = [
    commitment({ id: 'done', status: 'done', dueAt: new Date(2026, 6, 22, 9, 0).toISOString() }),
    commitment({ id: 'deleted', deletedAt: new Date().toISOString(), dueAt: new Date(2026, 6, 22, 9, 0).toISOString() }),
  ];
  const plan = buildReminderPlan(commitments, now);
  assert.equal(plan.overdue.length, 0);
});

test('badgeCount is the sum of due-soon and overdue', () => {
  const now = new Date(2026, 6, 23, 9, 0);
  const commitments = [
    commitment({ id: 'soon', dueAt: new Date(2026, 6, 23, 20, 0).toISOString() }),
    commitment({ id: 'late', dueAt: new Date(2026, 6, 22, 9, 0).toISOString() }),
  ];
  const plan = buildReminderPlan(commitments, now);
  assert.equal(plan.badgeCount, 2);
});

test('summarizeTaskList names up to 3 tasks and counts the rest', () => {
  const tasks = ['A', 'B', 'C', 'D', 'E'].map((title, index) => ({ id: String(index), title, dueAt: new Date().toISOString() }));
  assert.equal(summarizeTaskList(tasks), 'A, B, C e altri 2');
});

test('summarizeTaskList with 3 or fewer tasks lists them all with no "e altri"', () => {
  const tasks = ['A', 'B'].map((title, index) => ({ id: String(index), title, dueAt: new Date().toISOString() }));
  assert.equal(summarizeTaskList(tasks), 'A, B');
});

test('summarizeTaskList of an empty list is an empty string', () => {
  assert.equal(summarizeTaskList([]), '');
});
