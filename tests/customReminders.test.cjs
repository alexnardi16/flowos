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

test('every event gets an automatic notification at its exact start', () => {
  const now = new Date(2026, 6, 23, 9, 0);
  const commitments = [commitment({ id: 'ev1', scheduledAt: new Date(2026, 6, 23, 9, 10).toISOString() })];
  assert.equal(buildCustomReminders(commitments, now).length, 1);
  assert.equal(buildCustomReminders(commitments, now)[0].minutesBefore, 0);
});

test('duplicate commitment rows produce only one logical reminder', () => {
  const now = new Date(2026, 6, 23, 9, 0);
  const event = commitment({
    id: 'ev-duplicate',
    scheduledAt: new Date(2026, 6, 23, 10, 0).toISOString(),
    reminders: [{ id: 'a', minutesBefore: 10 }],
  });
  const reminders = buildCustomReminders([event, { ...event }], now);
  assert.equal(reminders.length, 2);
  assert.deepEqual(reminders.map((r) => r.id).sort(), ['ev-duplicate:a','ev-duplicate:automatic-start'].sort());
});

test('a task with no configured reminders still gets the automatic start reminder', () => {
  const now = new Date(2026, 6, 23, 9, 0);
  const commitments = [commitment({ id: 't1', kind: 'task', dueAt: new Date(2026, 6, 23, 9, 10).toISOString() })];
  assert.equal(buildCustomReminders(commitments, now).length, 1);
  assert.equal(buildCustomReminders(commitments, now)[0].minutesBefore, 0);
});

test('an item can have several configured reminders at once', () => {
  const now = new Date(2026, 6, 23, 8, 0);
  const commitments = [commitment({
    id: 'ev1',
    scheduledAt: new Date(2026, 6, 24, 9, 0).toISOString(),
    reminders: [{ id: 'a', minutesBefore: 60 }, { id: 'b', minutesBefore: 1440 }],
  })];
  const reminders = buildCustomReminders(commitments, now);
  assert.equal(reminders.length, 3);
  assert.deepEqual(reminders.map((r) => r.id).sort(), ['ev1:a', 'ev1:b', 'ev1:automatic-start'].sort());
});

test('a reminder whose trigger time has already passed is not scheduled', () => {
  const now = new Date(2026, 6, 23, 9, 5);
  const commitments = [commitment({ id: 'ev1', scheduledAt: new Date(2026, 6, 23, 9, 10).toISOString(), reminders: [{ id: 'a', minutesBefore: 10 }] })];
  assert.equal(buildCustomReminders(commitments, now).length, 1);
});

test('all-day items never produce reminders (a "minutes before midnight" reminder is not meaningful)', () => {
  const now = new Date(2026, 6, 23, 8, 0);
  const commitments = [commitment({ id: 'ev1', allDay: true, scheduledAt: '2026-07-25T00:00:00.000Z', reminders: [{ id: 'a', minutesBefore: 60 }] })];
  assert.equal(buildCustomReminders(commitments, now).length, 0);
});

test('dismissed reminders suppress existing offsets but allow newly added reminders', () => {
  const now = new Date(2026, 6, 23, 8, 0);
  const dismissedAt = new Date(2026, 6, 23, 8, 30).toISOString();
  const commitments = [commitment({ id: 'ev1', scheduledAt: new Date(2026, 6, 24, 9, 0).toISOString(), reminderDismissedAt: dismissedAt, reminders: [
    { id: 'old', minutesBefore: 60, createdAt: new Date(2026, 6, 23, 8, 0).toISOString() },
    { id: 'new', minutesBefore: 30, createdAt: new Date(2026, 6, 23, 8, 31).toISOString() },
  ] })];
  const reminders = buildCustomReminders(commitments, now);
  assert.deepEqual(reminders.map((r) => r.id), ['ev1:new']);
});

test('all-day tasks can still have date-based reminders', () => {
  const now = new Date(2026, 6, 23, 8, 0);
  const task = commitment({ id: 'task-all-day', kind: 'task', allDay: true, dueAt: '2026-07-25T00:00:00.000Z', reminders: [{ id: 'a', minutesBefore: 1440 }] });
  assert.equal(buildCustomReminders([task], now).length, 2);
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
  assert.equal(formatReminderOffsetLabel(0), 'All\'inizio');
  assert.equal(formatReminderOffsetLabel(15), '15 minuti prima');
  assert.equal(formatReminderOffsetLabel(60), '1 ora prima');
  assert.equal(formatReminderOffsetLabel(120), '2 ore prima');
  assert.equal(formatReminderOffsetLabel(1440), '1 giorno prima');
  assert.equal(formatReminderOffsetLabel(2880), '2 giorni prima');
});
