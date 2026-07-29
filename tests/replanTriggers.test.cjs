const test = require('node:test');
const assert = require('node:assert/strict');
const { findItemsNeedingReplan } = require('../.test-dist-notifications/lib/replanTriggers.js');

function commitment(overrides) {
  return {
    id: 'c1',
    title: 'Commitment',
    kind: 'task',
    status: 'scheduled',
    durationMinutes: 30,
    energy: 'medium',
    context: 'lavoro',
    confidence: 0.5,
    ...overrides,
  };
}

test('a flexible item whose slot already ended and is not done needs replanning', () => {
  const now = new Date(2026, 6, 23, 12, 0);
  const commitments = [commitment({ id: 'missed', scheduledAt: new Date(2026, 6, 23, 9, 0).toISOString() })];
  const candidates = findItemsNeedingReplan(commitments, now);
  assert.deepEqual(candidates, [{ id: 'missed', reason: 'missed-slot' }]);
});

test('a completed item past its slot does not need replanning', () => {
  const now = new Date(2026, 6, 23, 12, 0);
  const commitments = [commitment({ id: 'done', status: 'done', scheduledAt: new Date(2026, 6, 23, 9, 0).toISOString() })];
  assert.equal(findItemsNeedingReplan(commitments, now).length, 0);
});

test('a flexible item overlapping a fixed event needs replanning', () => {
  const now = new Date(2026, 6, 23, 8, 0);
  const commitments = [
    commitment({ id: 'flex', scheduledAt: new Date(2026, 6, 23, 9, 0).toISOString(), durationMinutes: 60 }),
    commitment({ id: 'fixed', fixed: true, scheduledAt: new Date(2026, 6, 23, 9, 30).toISOString(), durationMinutes: 30 }),
  ];
  const candidates = findItemsNeedingReplan(commitments, now);
  assert.deepEqual(candidates, [{ id: 'flex', reason: 'conflict-with-fixed' }]);
});

test('fixed items are never returned as replan candidates themselves', () => {
  const now = new Date(2026, 6, 23, 8, 0);
  const commitments = [commitment({ id: 'fixed', fixed: true, scheduledAt: new Date(2026, 6, 23, 6, 0).toISOString() })];
  assert.equal(findItemsNeedingReplan(commitments, now).length, 0);
});

test('an active item with no scheduledAt at all is a never-scheduled candidate (no manual "genera piano" button anymore, so this is the only path that assigns it a slot)', () => {
  const now = new Date(2026, 6, 23, 8, 0);
  const commitments = [commitment({ id: 'unscheduled', status: 'active', scheduledAt: undefined })];
  const candidates = findItemsNeedingReplan(commitments, now);
  assert.deepEqual(candidates, [{ id: 'unscheduled', reason: 'never-scheduled' }]);
});

test('a done or someday item with no scheduledAt is not a never-scheduled candidate', () => {
  const now = new Date(2026, 6, 23, 8, 0);
  const commitments = [
    commitment({ id: 'someday', status: 'someday', scheduledAt: undefined }),
    commitment({ id: 'blocked', status: 'blocked', scheduledAt: undefined }),
  ];
  assert.equal(findItemsNeedingReplan(commitments, now).length, 0);
});
