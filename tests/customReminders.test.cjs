const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCustomReminders, formatReminderOffsetLabel } = require('../.test-dist-notifications/lib/customReminders.js');

function commitment(overrides) {
  return {
    id: 'c1', title: 'Commitment', kind: 'event', status: 'active',
    durationMinutes: 30, energy: 'medium', context: '', confidence: 1,
    ...overrides,
  };
}

test('an event with no configured reminders falls back to the historical single 10-minutes-before default', () => {
  const now = new Date(2026, 6, 23, 9, 0);
  const commitments = [commitment({ id: 'ev1', scheduledAt: new Date(2026, 6, 23, 9, 10).toISOString() })];
  const reminders = buildCustomReminders(commitments, now);
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].minutesBefore, 10);
  assert.equal(reminders[0].triggerAt, now.toISOString());
});

test('a task with no configured reminders gets none by default (unlike events)', () => {
  const now = new Date(2026, 6, 23, 9, 0);
  const commitments = [commitment({ id: 't1', kind: 'task', dueAt: new Date(2026, 6, 23, 9, 10).toISOString() })];
  assert.equal(buildCustomReminders(commitments, now).length, 0);
});

test('an item can have several configured reminders at once', () => {
  const now = new Date(2026, 6, 23, 8, 0);
  const commitments = [commitment({
    id: 'ev1',
    scheduledAt: new Date(2026, 6, 24, 9, 0).toISOString(),
    reminders: [{ id: 'a', minutesBefore: 60 }, { id: 'b', minutesBefore: 1440 }],
  })];
  const reminders = buildCustomReminders(commitments, now);
  assert.equal(reminders.length, 2);
  assert.deepEqual(reminders.map((r) => r.id).sort(), ['ev1:a', 'ev1:b']);
});

test('a reminder whose trigger time has already passed is not scheduled', () => {
  const now = new Date(2026, 6, 23, 9, 5);
  const commitments = [commitment({ id: 'ev1', scheduledAt: new Date(2026, 6, 23, 9, 10).toISOString(), reminders: [{ id: 'a', minutesBefore: 10 }] })];
  assert.equal(buildCustomReminders(commitments, now).length, 0);
});

test('all-day items never produce reminders (a "minutes before midnight" reminder is not meaningful)', () => {
  const now = new Date(2026, 6, 23, 8, 0);
  const commitments = [commitment({ id: 'ev1', allDay: true, scheduledAt: '2026-07-25T00:00:00.000Z', reminders: [{ id: 'a', minutesBefore: 60 }] })];
  assert.equal(buildCustomReminders(commitments, now).length, 0);
});

test('done and deleted items never produce reminders', () => {
  const now = new Date(2026, 6, 23, 8, 0);
  const commitments = [
    commitment({ id: 'done', status: 'done', scheduledAt: new Date(2026, 6, 24, 9, 0).toISOString() }),
    commitment({ id: 'deleted', deletedAt: new Date().toISOString(), scheduledAt: new Date(2026, 6, 24, 9, 0).toISOString() }),
  ];
  assert.equal(buildCustomReminders(commitments, now).length, 0);
});

test('formatReminderOffsetLabel renders minutes, hours, and days naturally', () => {
  assert.equal(formatReminderOffsetLabel(10), '10 minuti prima');
  assert.equal(formatReminderOffsetLabel(60), '1 ora prima');
  assert.equal(formatReminderOffsetLabel(120), '2 ore prima');
  assert.equal(formatReminderOffsetLabel(1440), '1 giorno prima');
  assert.equal(formatReminderOffsetLabel(2880), '2 giorni prima');
});
