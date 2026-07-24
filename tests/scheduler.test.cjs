const test = require('node:test');
const assert = require('node:assert/strict');
const { createAutomaticPlan, DEFAULT_WEEKLY_AVAILABILITY } = require('../.test-dist-notifications/lib/scheduler.js');

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

// A Wednesday, well inside the default 09:00-13:00 / 14:00-18:00 windows.
const WEDNESDAY_MORNING = new Date(2026, 6, 22, 8, 0);

test('a high-energy task is placed in the morning window when both are free', () => {
  const commitments = [commitment({ id: 'high', energy: 'high' })];
  const plan = createAutomaticPlan(commitments, DEFAULT_WEEKLY_AVAILABILITY, WEDNESDAY_MORNING);
  const placed = plan.find((item) => item.id === 'high');
  assert.ok(placed.scheduledAt);
  assert.ok(new Date(placed.scheduledAt).getHours() < 13);
});

test('a low-energy task is placed in the afternoon window when both are free', () => {
  const commitments = [commitment({ id: 'low', energy: 'low' })];
  const plan = createAutomaticPlan(commitments, DEFAULT_WEEKLY_AVAILABILITY, WEDNESDAY_MORNING);
  const placed = plan.find((item) => item.id === 'low');
  assert.ok(placed.scheduledAt);
  assert.ok(new Date(placed.scheduledAt).getHours() >= 13);
});

test('fixed events are never moved and block overlapping flexible slots', () => {
  const fixedStart = new Date(2026, 6, 22, 9, 0).toISOString();
  const commitments = [
    commitment({ id: 'meeting', fixed: true, status: 'scheduled', scheduledAt: fixedStart, durationMinutes: 240 }),
    commitment({ id: 'task', energy: 'high' }),
  ];
  const plan = createAutomaticPlan(commitments, DEFAULT_WEEKLY_AVAILABILITY, WEDNESDAY_MORNING);
  const meeting = plan.find((item) => item.id === 'meeting');
  const task = plan.find((item) => item.id === 'task');
  assert.equal(meeting.scheduledAt, fixedStart);
  assert.ok(new Date(task.scheduledAt).getTime() >= new Date(fixedStart).getTime() + 240 * 60000);
});

test('a day with no availability window (Sunday) is skipped entirely', () => {
  const sunday = new Date(2026, 6, 26, 8, 0); // a Sunday
  const commitments = [commitment({ id: 'task' })];
  const plan = createAutomaticPlan(commitments, DEFAULT_WEEKLY_AVAILABILITY, sunday);
  const placed = plan.find((item) => item.id === 'task');
  assert.notEqual(new Date(placed.scheduledAt).getDay(), 0);
});

test('done items are never rescheduled', () => {
  const commitments = [commitment({ id: 'done', status: 'done' })];
  const plan = createAutomaticPlan(commitments, DEFAULT_WEEKLY_AVAILABILITY, WEDNESDAY_MORNING);
  assert.equal(plan.find((item) => item.id === 'done').scheduledAt, undefined);
});
