const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPlanningSuggestions } = require('../.test-dist-notifications/lib/planningSuggestions.js');
const { DEFAULT_WEEKLY_AVAILABILITY } = require('../.test-dist-notifications/lib/scheduler.js');

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

const WEDNESDAY_MORNING = new Date(2026, 6, 22, 9, 0);

test('an empty schedule on an available day suggests the whole window as a gap', () => {
  const suggestions = buildPlanningSuggestions([], DEFAULT_WEEKLY_AVAILABILITY, WEDNESDAY_MORNING);
  assert.ok(suggestions.some((s) => s.id === 'free-gap'));
});

test('a gap suggestion names a short unscheduled task that fits in it', () => {
  const commitments = [commitment({ id: 'quick', kind: 'task', status: 'active', durationMinutes: 20 })];
  const suggestions = buildPlanningSuggestions(commitments, DEFAULT_WEEKLY_AVAILABILITY, WEDNESDAY_MORNING);
  const gap = suggestions.find((s) => s.id === 'free-gap');
  assert.ok(gap);
  assert.match(gap.text, /quick|Commitment/);
});

test('a fully booked day with more load than availability triggers the overbooked warning', () => {
  const commitments = [
    commitment({ id: 'a', status: 'scheduled', scheduledAt: new Date(2026, 6, 22, 9, 0).toISOString(), durationMinutes: 240 }),
    commitment({ id: 'b', status: 'scheduled', scheduledAt: new Date(2026, 6, 22, 14, 0).toISOString(), durationMinutes: 240 }),
    commitment({ id: 'c', status: 'scheduled', scheduledAt: new Date(2026, 6, 22, 18, 0).toISOString(), durationMinutes: 120 }),
  ];
  const suggestions = buildPlanningSuggestions(commitments, DEFAULT_WEEKLY_AVAILABILITY, WEDNESDAY_MORNING);
  assert.ok(suggestions.some((s) => s.id === 'overbooked'));
});

test('a day with no availability window produces no suggestions', () => {
  const sunday = new Date(2026, 6, 26, 9, 0);
  const suggestions = buildPlanningSuggestions([], DEFAULT_WEEKLY_AVAILABILITY, sunday);
  assert.equal(suggestions.length, 0);
});
