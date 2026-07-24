const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWeatherSummary } = require('../.test-dist-notifications/lib/weatherSummary.js');

test('a known WMO code maps to its Italian label', () => {
  const summary = buildWeatherSummary({ weatherCode: 0, tempMaxC: 28.4, tempMinC: 18.1, precipitationProbability: 5 });
  assert.equal(summary.label, 'cielo sereno');
  assert.equal(summary.tempMinC, 18);
  assert.equal(summary.tempMaxC, 28);
});

test('an unknown WMO code falls back to a generic label instead of throwing', () => {
  const summary = buildWeatherSummary({ weatherCode: 9999, tempMaxC: 20, tempMinC: 10, precipitationProbability: 0 });
  assert.equal(summary.label, 'condizioni variabili');
});

test('high precipitation probability is mentioned in the text, low probability is not', () => {
  const rainy = buildWeatherSummary({ weatherCode: 61, tempMaxC: 15, tempMinC: 10, precipitationProbability: 70 });
  const dry = buildWeatherSummary({ weatherCode: 0, tempMaxC: 25, tempMinC: 15, precipitationProbability: 10 });
  assert.match(rainy.text, /probabilità di pioggia/);
  assert.doesNotMatch(dry.text, /probabilità di pioggia/);
});

test('temperatures are rounded to whole degrees in the text', () => {
  const summary = buildWeatherSummary({ weatherCode: 2, tempMaxC: 21.6, tempMinC: 14.4, precipitationProbability: 0 });
  assert.equal(summary.text, 'parzialmente nuvoloso, 14–22°C');
});
