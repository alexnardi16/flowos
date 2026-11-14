const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
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
  assert.match(summary.body, /09:00 - 09:30 · Palestra/);
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

test('all-day and timed commitments keep their intended local date around the Europe/Paris DST transition', () => {
  const { spawnSync } = require('node:child_process');
  const script = String.raw`
    const assert = require('node:assert/strict');
    const { buildDailySummary } = require('./.test-dist-notifications/lib/dailySummary.js');
    const commitment = (overrides) => ({
      id: 'c1', title: 'Commitment', kind: 'event', status: 'active',
      durationMinutes: 30, energy: 'medium', context: 'work', confidence: 0.5, ...overrides,
    });
    // 29 March 2026 is the spring DST transition in Europe/Paris.
    const now = new Date(2026, 2, 29, 8, 0);
    const allDay = commitment({
      id: 'all-day', title: 'All-day event', allDay: true,
      scheduledAt: '2026-03-29T00:00:00.000Z', durationMinutes: 1440,
    });
    const timed = commitment({
      id: 'timed', title: 'Timed event',
      scheduledAt: new Date(2026, 2, 29, 9, 15).toISOString(), durationMinutes: 45,
    });
    const summary = buildDailySummary([allDay, timed], now);
    assert.deepEqual(summary.items.map((item) => item.id), ['all-day', 'timed']);
    assert.equal(summary.items[0].time, undefined);
    assert.match(summary.body, /All-day event/);
    assert.doesNotMatch(summary.body, /Tutto il giorno/);
    assert.match(summary.body, /09:15 - 10:00 · Timed event/);
    console.log('timezone-dst-ok');
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    env: { ...process.env, TZ: 'Europe/Paris' },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /timezone-dst-ok/);
});


test('daily summaries use the selected app language for title, copy and time formatting', () => {
  const now = new Date(2026, 6, 23, 7, 30);
  const item = commitment({ id: 'meeting', title: 'Meeting', scheduledAt: new Date(2026, 6, 23, 9, 0).toISOString(), durationMinutes: 30 });
  const english = buildDailySummary([item], now, now, 'en');
  const french = buildDailySummary([item], now, now, 'fr');
  const spanish = buildDailySummary([], now, now, 'es');
  assert.match(english.title, /Today/);
  assert.match(english.body, /09:00 - 09:30/);
  assert.match(french.title, /Aujourd’hui/);
  assert.match(french.body, /09:00 - 09:30/);
  assert.match(spanish.title, /Hoy|No hay compromisos/);
  assert.match(spanish.body, /Día libre/);
});


test('legacy tomorrow notifications in every locale are recognized for cancellation', () => {
  const source = fs.readFileSync('lib/notificationService.ts', 'utf8');
  assert.match(source, /Mañana por la mañana/);
  assert.match(source, /Tomorrow morning/);
  assert.match(source, /Demain matin/);
  assert.match(source, /requestedLanguage\\s*\\?\\?\\s*await getLanguage\\(\\)/);
  const background = fs.readFileSync('lib/backgroundSyncService.ts', 'utf8');
  assert.match(background, /scheduleTomorrowMorningSummary\(tomorrowSummary, now, language\)/);
});

test('Google synchronization and destination settings appear before widget customization', () => {
  const source = fs.readFileSync('app/(tabs)/me.tsx', 'utf8');
  const google = source.indexOf("t('Sincronizzazione con Google')");
  const calendars = source.indexOf("t('Calendari sincronizzati')");
  const taskLists = source.indexOf("t('Liste Google Tasks sincronizzate')");
  const widgets = source.indexOf("t('Personalizzazione widget')");
  assert.ok(google >= 0 && calendars > google && taskLists > calendars && widgets > taskLists);
  assert.match(source, /refreshNotificationsForLanguage\(commitments,option\.code\)/);
});
