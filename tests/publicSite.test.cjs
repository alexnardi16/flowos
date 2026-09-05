const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function readPublic(relativePath) {
  return fs.readFileSync(path.join(root, 'public', relativePath), 'utf8');
}

test('public legal pages exist and expose the required FlowOS identity', () => {
  const privacy = readPublic(path.join('privacy-policy', 'index.html'));
  const deletion = readPublic(path.join('delete-account', 'index.html'));
  const terms = readPublic(path.join('terms', 'index.html'));

  assert.match(privacy, /<title>FlowOS Privacy Policy<\/title>/i);
  assert.match(privacy, /Last updated:/i);
  assert.match(privacy, /alex16nardi@gmail\.com/i);
  assert.match(privacy, /Delete account/i);

  assert.match(deletion, /<title>Delete your FlowOS account<\/title>/i);
  assert.match(deletion, /FlowOS/i);
  assert.match(deletion, /request deletion/i);
  assert.match(deletion, /mailto:alex16nardi@gmail\.com/i);
  assert.match(deletion, /without.*app/i);

  assert.match(terms, /<title>FlowOS Terms of Service<\/title>/i);
  assert.match(terms, /FlowOS/i);
  assert.match(terms, /Privacy Policy/i);
});

test('privacy policy discloses the data categories used by the app', () => {
  const privacy = readPublic(path.join('privacy-policy', 'index.html'));
  for (const phrase of [
    'Google Sign-In',
    'Google Calendar',
    'Google Tasks',
    'OAuth',
    'OpenAI',
    'Open-Meteo',
    'location',
    'tasks',
    'commitments',
    'notifications',
    'retention',
    'deletion',
  ]) {
    assert.match(privacy, new RegExp(phrase, 'i'), `Privacy Policy should mention ${phrase}`);
  }
});

test('optional live-site smoke test validates all legal URLs', async (t) => {
  if (process.env.FLOWOS_LIVE_SITE_TEST !== '1') {
    t.skip('Set FLOWOS_LIVE_SITE_TEST=1 to test the deployed Netlify site');
    return;
  }

  const base = (process.env.FLOWOS_SITE_URL || 'https://getflowos.netlify.app').replace(/\/$/, '');
  for (const route of ['/privacy-policy/', '/delete-account/', '/terms/']) {
    const response = await fetch(`${base}${route}`, { redirect: 'follow' });
    assert.equal(response.status, 200, `${route} should return HTTP 200`);
    const html = await response.text();
    assert.match(html, /FlowOS/i, `${route} should contain FlowOS`);
  }
});
