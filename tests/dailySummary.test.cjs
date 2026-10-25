const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDailySummary, toDateKey } = require('../.test-dist-notifications/lib/dailySummary.js');

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

test('toDateKey formats using local calendar date, not UTC', () => {
  const date = new Date(2026, 6, 23, 23, 45); // 23 luglio 2026, 23:45 locale
  assert.equal(toDateKey(date), '2026-07-23');
});

test('an empty list of commitments produces a free-day summary with no items', () => {
  const now = new Date(2026, 6, 23, 7, 30);
  const summary = buildDailySummary([], now);
  assert.equal(summary.scheduledCount, 0);
  assert.equal(summary.overdueCount, 0);
  assert.equal(summary.items.length, 0);
  assert.match(summary.body, /Giornata libera/);
});

test('items scheduled today are included and sorted chronologically', () => {
  const now = new Date(2026, 6, 23, 7, 30);
  const commitments = [
    commitment({ id: 'a', title: 'Riunione', scheduledAt: new Date(2026, 6, 23, 15, 0).toISOString() }),
    commitment({ id: 'b', title: 'Palestra', scheduledAt: new Date(2026, 6, 23, 9, 0).toISOString() }),
    commitment({ id: 'c', title: 'Domani', scheduledAt: new Date(2026, 6, 24, 9, 0).toISOString() }),
  ];
  const summary = buildDailySummary(commitments, now);
  assert.equal(summary.scheduledCount, 2);
  assert.deepEqual(summary.items.map((item) => item.id), ['b', 'a']);
  assert.match(summary.body, /09:00 · Palestra/);
});

test('completed and deleted commitments never appear in the summary', () => {
  const now = new Date(2026, 6, 23, 7, 30);
  const commitments = [
    commitment({ id: 'done', status: 'done', scheduledAt: new Date(2026, 6, 23, 9, 0).toISOString() }),
    commitment({ id: 'deleted', deletedAt: new Date().toISOString(), scheduledAt: new Date(2026, 6, 23, 10, 0).toISOString() }),
  ];
  const summary = buildDailySummary(commitments, now);
  assert.equal(summary.scheduledCount, 0);
});

test('overdue items (past due date, not today) are counted but not listed as scheduled', () => {
  const now = new Date(2026, 6, 23, 7, 30);
  const commitments = [
    commitment({ id: 'late', dueAt: new Date(2026, 6, 20, 12, 0).toISOString() }),
  ];
  const summary = buildDailySummary(commitments, now);
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.scheduledCount, 0);
  assert.match(summary.body, /1 in ritardo/);
});

test('a due date later today does not count as overdue', () => {
  const now = new Date(2026, 6, 23, 7, 30);
  const commitments = [
    commitment({ id: 'today-due', dueAt: new Date(2026, 6, 23, 18, 0).toISOString() }),
  ];
  const summary = buildDailySummary(commitments, now);
  assert.equal(summary.overdueCount, 0);
});


test('all-day commitments are listed without the phrase "Tutto il giorno"', () => {
  const now = new Date(2026, 6, 23, 7, 30);
  const summary = buildDailySummary([
    commitment({
      id: 'all-day',
      title: 'Festa nazionale',
      kind: 'event',
      allDay: true,
      scheduledAt: '2026-07-23T00:00:00.000Z',
      durationMinutes: 1440,
    }),
  ], now);
  assert.equal(summary.items[0].time, undefined);
  assert.match(summary.body, /Festa nazionale/);
  assert.doesNotMatch(summary.body, /Tutto il giorno/);
});

test('timed commitments show start and end times based on duration', () => {
  const now = new Date(2026, 6, 23, 7, 30);
  const summary = buildDailySummary([
    commitment({
      id: 'timed',
      title: 'Riunione',
      kind: 'event',
      scheduledAt: new Date(2026, 6, 23, 9, 15).toISOString(),
      durationMinutes: 45,
    }),
  ], now);
  assert.match(summary.body, /09:15 - 10:00 · Riunione/);
});
