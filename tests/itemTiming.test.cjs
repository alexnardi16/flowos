const test = require('node:test');
const assert = require('node:assert/strict');
const { getEndTime, isExpired, formatDurationLabel } = require('../.test-dist-notifications/lib/itemTiming.js');

function item(overrides) {
  return {
    id: 'i1', title: 'Item', kind: 'task', status: 'active',
    durationMinutes: 30, energy: 'medium', context: '', confidence: 1,
    ...overrides,
  };
}

test('getEndTime is start + duration, not just the start', () => {
  const start = new Date(2026, 6, 25, 10, 0);
  const it = item({ scheduledAt: start.toISOString(), durationMinutes: 45 });
  assert.equal(getEndTime(it), start.getTime() + 45 * 60000);
});

test('a timed item is not expired until its end time passes, even though its start already has', () => {
  const now = new Date(2026, 6, 25, 10, 20);
  const it = item({ scheduledAt: new Date(2026, 6, 25, 10, 0).toISOString(), durationMinutes: 30 });
  assert.equal(isExpired(it, now), false); // ends at 10:30, still ongoing at 10:20
});

test('a timed item is expired once its end time passes', () => {
  const now = new Date(2026, 6, 25, 10, 31);
  const it = item({ scheduledAt: new Date(2026, 6, 25, 10, 0).toISOString(), durationMinutes: 30 });
  assert.equal(isExpired(it, now), true);
});

test('a single all-day item only expires at midnight of the NEXT day, not during its own day', () => {
  const it = item({ kind: 'event', allDay: true, scheduledAt: '2026-07-25T00:00:00.000Z', durationMinutes: 1440 });
  const lateSameDay = new Date(Date.UTC(2026, 6, 25, 23, 59));
  const nextDay = new Date(Date.UTC(2026, 6, 26, 0, 1));
  assert.equal(isExpired(it, lateSameDay), false);
  assert.equal(isExpired(it, nextDay), true);
});

test('a multi-day all-day item only expires after its last day ends', () => {
  const it = item({ kind: 'event', allDay: true, scheduledAt: '2026-07-25T00:00:00.000Z', durationMinutes: 1440 * 6 }); // 6-day span
  const lastDay = new Date(Date.UTC(2026, 6, 30, 12, 0));
  const afterEnd = new Date(Date.UTC(2026, 6, 31, 0, 1));
  assert.equal(isExpired(it, lastDay), false);
  assert.equal(isExpired(it, afterEnd), true);
});

test('a date-only deadline (Google Tasks due date, always midnight UTC) only expires at the END of that day, not 30 minutes after midnight', () => {
  const it = item({ kind: 'task', dueAt: '2026-07-25T00:00:00.000Z', durationMinutes: 30 });
  const stillToday = new Date(Date.UTC(2026, 6, 25, 20, 0));
  const nextDay = new Date(Date.UTC(2026, 6, 26, 0, 30));
  assert.equal(isExpired(it, stillToday), false);
  assert.equal(isExpired(it, nextDay), true);
});

test('a task with an explicit scheduledAt time is NOT treated as a date-only deadline — its own duration still applies', () => {
  const it = item({ kind: 'task', scheduledAt: new Date(2026, 6, 25, 14, 0).toISOString(), durationMinutes: 30 });
  const justAfter = new Date(2026, 6, 25, 14, 31);
  assert.equal(isExpired(it, justAfter), true);
});

test('formatDurationLabel shows "1 d" for a single 24h all-day item, not "24 h"', () => {
  const it = item({ allDay: true, scheduledAt: '2026-07-25T00:00:00.000Z', durationMinutes: 1440 });
  assert.equal(formatDurationLabel(it), '1 d');
});

test('formatDurationLabel shows total days + which day we are on for a multi-day item', () => {
  const it = item({ allDay: true, scheduledAt: '2026-07-25T00:00:00.000Z', durationMinutes: 1440 * 6 });
  const fifthDay = new Date(2026, 6, 29); // 25,26,27,28,29 -> 5th day
  assert.equal(formatDurationLabel(it, fifthDay), '6 d (5° giorno)');
});

test('formatDurationLabel falls back to hours/minutes for normal timed items', () => {
  assert.equal(formatDurationLabel(item({ durationMinutes: 90 })), '1 h 30 min');
  assert.equal(formatDurationLabel(item({ durationMinutes: 45 })), '45 min');
  assert.equal(formatDurationLabel(item({ durationMinutes: 60 })), '1 h');
});
