const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function readPublic(relativePath) {
  return fs.readFileSync(path.join(root, 'public', relativePath), 'utf8');
}

test('public landing and legal pages exist and expose the required FlowOS identity', () => {
  const home = readPublic(path.join('about', 'index.html'));
  assert.ok(home.includes('<title>FlowOS — Make room for what matters</title>'));
  assert.match(home, /tasks, events and reminders/i);
  assert.ok(home.includes('href=\"/privacy-policy/\"'));
  assert.ok(home.includes('href=\"/delete-account/\"'));
  const privacy = readPublic(path.join('privacy-policy', 'index.html'));
  const privacyStatic = readPublic('privacy-policy-static.html');
  assert.equal(privacyStatic, privacy, 'The static fallback policy must match the canonical privacy page');
  const deletion = readPublic(path.join('delete-account', 'index.html'));
  const terms = readPublic(path.join('terms', 'index.html'));
  const italianPrivacy = readPublic(path.join('it', 'privacy-policy', 'index.html'));

  assert.match(privacy, /<title>FlowOS Privacy Policy<\/title>/i);
  assert.match(privacy, /Last updated:/i);
  assert.match(privacy, /support.flowos@gmail\.com/i);
  assert.match(privacy, /Delete account/i);

  assert.match(deletion, /<title>Delete your FlowOS account<\/title>/i);
  assert.match(deletion, /FlowOS/i);
  assert.match(deletion, /request deletion/i);
  assert.match(deletion, /mailto:support.flowos@gmail\.com/i);
  assert.match(deletion, /without.*app/i);
  assert.match(deletion, /Expo push tokens registered for your devices/i);

  assert.match(terms, /<title>FlowOS Terms of Service<\/title>/i);
  assert.match(terms, /FlowOS/i);
  assert.match(terms, /Privacy Policy/i);
  assert.match(terms, /Optional AI features/i);
  assert.match(terms, /own API key/i);
  const aboutAI = readPublic(path.join('about', 'index.html'));
  assert.match(aboutAI, /Optional AI tools/i);
  assert.match(aboutAI, /each operation requires confirmation/i);
});

test('privacy policy discloses the data categories used by the app', () => {
  const privacy = readPublic(path.join('privacy-policy', 'index.html'));
  for (const phrase of [
    'Google Sign-In',
    'Google Calendar',
    'Google Tasks',
    'OAuth',
    'Expo',
    'speech-recognition',
    'tasks',
    'commitments',
    'notifications',
    'retention',
    'deletion',
  ]) {
    assert.match(privacy, new RegExp(phrase, 'i'), `Privacy Policy should mention ${phrase}`);
  }

  assert.match(privacy, /optional FlowOS AI features and data sent to AI providers/i);
  assert.match(privacy, /voice transcript and titles of active FlowOS activities/i);
  assert.match(privacy, /professional messages/i);
  assert.match(privacy, /provider API key is stored in the operating system's secure storage/i);
  assert.match(privacy, /directly from your device to the provider/i);
  assert.match(privacy, /does not retain AI prompts or generated responses on its backend/i);
  assert.match(italianPrivacy, /Funzioni AI facoltative e dati inviati ai provider AI/i);
  assert.match(italianPrivacy, /API key del provider AI è conservata nell'archivio sicuro/i);

  assert.match(privacy, /Expo push token/i);
  assert.match(privacy, /Supabase/i);
  assert.match(privacy, /Netlify/i);
  assert.match(privacy, /system or browser speech-recognition service/i);

  const retiredTranslation = fs.readFileSync(path.join(root, 'supabase', 'functions', 'translate-activities', 'index.ts'), 'utf8');
  assert.match(retiredTranslation, /ENDPOINT_RETIRED/);
  assert.match(retiredTranslation, /status: 410/);
  assert.doesNotMatch(retiredTranslation, /OPENAI_API_KEY|api\.openai\.com|chat\/completions/);

  // Location/weather is explicitly disclosed as retired, but stale provider/history
  // disclosures must not return to the public policy.
  assert.doesNotMatch(privacy, /Open-Meteo|location history/i);
  assert.match(privacy, /does not request, collect, or transmit your phone's location/i);
});

test('optional live-site smoke test validates all legal URLs', async (t) => {
  if (process.env.FLOWOS_LIVE_SITE_TEST !== '1') {
    t.skip('Set FLOWOS_LIVE_SITE_TEST=1 to test the deployed Netlify site');
    return;
  }

  const base = (process.env.FLOWOS_SITE_URL || 'https://getflowos.netlify.app').replace(/\/$/, '');
  for (const route of ['/about/', '/privacy-policy/', '/delete-account/', '/terms/']) {
    const response = await fetch(`${base}${route}`, { redirect: 'follow' });
    assert.equal(response.status, 200, `${route} should return HTTP 200`);
    const html = await response.text();
    assert.match(html, /FlowOS/i, `${route} should contain FlowOS`);
  }
});
