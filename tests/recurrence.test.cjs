const test = require('node:test');
const assert = require('node:assert/strict');
const { computeNextOccurrence, materializeNextOccurrence, toRRuleString } = require('../.test-dist-notifications/lib/recurrence.js');

function task(overrides) {
  return {
    id: 't1',
    title: 'Annaffiare le piante',
    kind: 'task',
    status: 'done',
    durationMinutes: 10,
    energy: 'low',
    context: 'casa',
    confidence: 1,
    ...overrides,
  };
}

test('daily recurrence advances by N days', () => {
  const next = computeNextOccurrence(new Date(2026, 6, 25), { frequency: 'daily', interval: 3 });
  assert.equal(next.getDate(), 28);
});

test('weekly recurrence advances by N weeks', () => {
  const next = computeNextOccurrence(new Date(2026, 6, 25), { frequency: 'weekly', interval: 2 });
  assert.equal(next.getDate(), 8); // 25 Jul + 14 days = 8 Aug
  assert.equal(next.getMonth(), 7);
});

test('monthly recurrence advances by N months', () => {
  const next = computeNextOccurrence(new Date(2026, 6, 25), { frequency: 'monthly', interval: 1 });
  assert.equal(next.getMonth(), 7);
  assert.equal(next.getDate(), 25);
});

test('a completed recurring task with no recurrenceRule produces no next occurrence', () => {
  const completed = task({ dueAt: new Date(2026, 6, 25).toISOString() });
  assert.equal(materializeNextOccurrence(completed), null);
});

test('a completed recurring task produces the next occurrence, reset to active', () => {
  const completed = task({ dueAt: new Date(2026, 6, 25).toISOString(), recurrenceRule: { frequency: 'weekly', interval: 1 } });
  const next = materializeNextOccurrence(completed);
  assert.ok(next);
  assert.equal(next.status, 'active');
  assert.equal(new Date(next.dueAt).getDate(), 1); // 25 Jul + 7 days = 1 Aug
  assert.equal(next.recurrenceSeriesId, completed.id);
});

test('a series with a count limit stops producing occurrences once exhausted', () => {
  const completed = task({ dueAt: new Date(2026, 6, 25).toISOString(), recurrenceRule: { frequency: 'daily', interval: 1, count: 1 } });
  const next = materializeNextOccurrence(completed);
  assert.equal(next, null);
});

test('a series with an until date stops once the next occurrence would be past it', () => {
  const completed = task({
    dueAt: new Date(2026, 6, 25).toISOString(),
    recurrenceRule: { frequency: 'daily', interval: 1, until: new Date(2026, 6, 25).toISOString() },
  });
  assert.equal(materializeNextOccurrence(completed), null);
});

test('successive occurrences chain through the same recurrenceSeriesId', () => {
  const first = task({ id: 'series-root', dueAt: new Date(2026, 6, 25).toISOString(), recurrenceRule: { frequency: 'daily', interval: 1 } });
  const second = materializeNextOccurrence(first);
  const secondCompleted = { ...second, status: 'done' };
  const third = materializeNextOccurrence(secondCompleted);
  assert.equal(second.recurrenceSeriesId, 'series-root');
  assert.equal(third.recurrenceSeriesId, 'series-root');
});

test('toRRuleString builds a valid weekly RRULE for Google Calendar', () => {
  assert.equal(toRRuleString({ frequency: 'weekly', interval: 1 }), 'RRULE:FREQ=WEEKLY;INTERVAL=1');
});

test('toRRuleString includes COUNT when a count limit is set', () => {
  assert.equal(toRRuleString({ frequency: 'daily', interval: 1, count: 5 }), 'RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5');
});

test('toRRuleString includes UNTIL (preferring it over count when both would apply) when an end date is set', () => {
  assert.equal(toRRuleString({ frequency: 'monthly', interval: 2, until: '2026-12-31T00:00:00.000Z' }), 'RRULE:FREQ=MONTHLY;INTERVAL=2;UNTIL=20261231T000000Z');
});
