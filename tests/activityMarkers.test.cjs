const test = require('node:test');
const assert = require('node:assert/strict');
const { parseActivityTitle, formatActivityTitle, EMPTY_ACTIVITY_MARKERS } = require('../.test-dist-notifications/lib/activityMarkers.js');

test('activity markers are stored as a compact title prefix and parsed separately', () => {
  const markers = { people: 'together', place: 'home', online: true, travel: false };
  const formatted = formatActivityTitle('Preparare il report', markers);
  assert.equal(formatted, '👥 🏠 💻 Preparare il report');
  assert.deepEqual(parseActivityTitle(formatted), { title: 'Preparare il report', markers });
});

test('unmarked legacy titles remain unchanged and receive neutral marker defaults', () => {
  assert.deepEqual(parseActivityTitle('Chiamare Marco'), {
    title: 'Chiamare Marco',
    markers: EMPTY_ACTIVITY_MARKERS,
  });
  assert.equal(formatActivityTitle('Chiamare Marco', EMPTY_ACTIVITY_MARKERS), 'Chiamare Marco');
});

test('marker formatting replaces old marker choices instead of accumulating conflicts', () => {
  const old = formatActivityTitle('Fare la spesa', { people: 'solo', place: 'anywhere', online: false, travel: false });
  const parsed = parseActivityTitle(old);
  assert.equal(formatActivityTitle(parsed.title, { ...parsed.markers, people: 'together', place: 'home' }), '👥 🏠 Fare la spesa');
});

test('leading whitespace and multiple markers are parsed consistently', () => {
  assert.deepEqual(parseActivityTitle(' 👤  🌍  💻  Studiare'), {
    title: 'Studiare',
    markers: { people: 'solo', place: 'anywhere', online: true, travel: false },
  });
});
