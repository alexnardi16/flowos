const test = require('node:test');
const assert = require('node:assert/strict');
const { hasRecoveredToday } = require('../.test-dist-notifications/lib/notificationDedup.js');

test('no prior recovery means today has not been recovered yet', () => {
  assert.equal(hasRecoveredToday(null, '2026-07-23'), false);
});

test('a recovery recorded for a previous day does not block today', () => {
  assert.equal(hasRecoveredToday('2026-07-22', '2026-07-23'), false);
});

test('a recovery already recorded for today blocks a second one (prevents duplicates)', () => {
  assert.equal(hasRecoveredToday('2026-07-23', '2026-07-23'), true);
});
