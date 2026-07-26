const test = require('node:test');
const assert = require('node:assert/strict');
const { isSameCalendarDay, formatCommitmentTime, commitmentDateParts } = require('../.test-dist-notifications/lib/allDayDate.js');

function allDayItem(isoDate) {
  return { id: 'a', title: 'Compleanno', kind: 'event', status: 'scheduled', durationMinutes: 1440, energy: 'medium', context: '', confidence: 1, allDay: true, scheduledAt: isoDate };
}
function timedItem(isoDate) {
  return { id: 'b', title: 'Riunione', kind: 'event', status: 'scheduled', durationMinutes: 30, energy: 'medium', context: '', confidence: 1, scheduledAt: isoDate };
}

test('an all-day event stored as UTC midnight reads back as midnight, not shifted by the local offset', () => {
  const item = allDayItem('2026-07-25T00:00:00.000Z');
  const parts = commitmentDateParts(item, item.scheduledAt);
  assert.equal(parts.hours, 0);
  assert.equal(parts.minutes, 0);
  assert.equal(parts.day, 25);
});

test('formatCommitmentTime shows "Tutto il giorno" for all-day items regardless of viewer timezone', () => {
  const item = allDayItem('2026-07-25T00:00:00.000Z');
  assert.equal(formatCommitmentTime(item, item.scheduledAt), 'Tutto il giorno');
});

test('formatCommitmentTime shows a real clock time for timed items', () => {
  const item = timedItem(new Date(2026, 6, 25, 14, 30).toISOString());
  assert.equal(formatCommitmentTime(item, item.scheduledAt), '14:30');
});

test('isSameCalendarDay matches an all-day event to "today" using its UTC calendar day', () => {
  const item = allDayItem('2026-07-25T00:00:00.000Z');
  const today = new Date(2026, 6, 25, 9, 0); // local July 25, well inside the day either way
  assert.equal(isSameCalendarDay(item, item.scheduledAt, today), true);
});

test('isSameCalendarDay for a timed item still uses local calendar day as before', () => {
  const item = timedItem(new Date(2026, 6, 25, 23, 0).toISOString());
  const today = new Date(2026, 6, 25, 9, 0);
  assert.equal(isSameCalendarDay(item, item.scheduledAt, today), true);
});
