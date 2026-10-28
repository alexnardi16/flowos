const test = require('node:test');
const assert = require('node:assert/strict');
const { redactLogDetails, redactSerializedLogDetails } = require('../.test-dist-notifications/lib/logRedaction.js');

test('redacts private activity content while retaining safe diagnostic fields', () => {
  const result = redactLogDetails({ event: 'activity-created', title: 'Medical appointment', description: 'Private details', location: '12 Rue Example', count: 3, kind: 'event' });
  assert.equal(result.title, '[REDACTED]');
  assert.equal(result.description, '[REDACTED]');
  assert.equal(result.location, '[REDACTED]');
  assert.equal(result.count, 3);
  assert.equal(result.kind, 'event');
});

test('redacts credential-like keys regardless of casing and separators', () => {
  const result = redactLogDetails({ access_token: 'access-secret', providerRefreshToken: 'refresh-secret', authorization: 'Bearer secret', api_key: 'key-secret' });
  assert.equal(result.access_token, '[REDACTED]');
  assert.equal(result.providerRefreshToken, '[REDACTED]');
  assert.equal(result.authorization, '[REDACTED]');
  assert.equal(result.api_key, '[REDACTED]');
});

test('redacts bearer tokens and secrets embedded in error text', () => {
  const result = redactLogDetails('request failed: Bearer abc.def.ghi access_token=abc123');
  assert.doesNotMatch(result, /abc\.def\.ghi|abc123/);
  assert.match(result, /Bearer \[REDACTED\]/);
  assert.match(result, /access_token=\[REDACTED\]/);
});

test('redacts nested arrays and objects and bounds recursion depth', () => {
  const result = redactLogDetails({ items: [{ userText: 'private command', ok: true }] });
  assert.equal(result.items[0].userText, '[REDACTED]');
  assert.equal(result.items[0].ok, true);
});

test('migrates historical JSON-serialized details by redacting sensitive fields', () => {
  const result = redactSerializedLogDetails('{"title":"old private title","status":"scheduled","access_token":"old-secret"}');
  assert.doesNotMatch(result, /old private title|old-secret/);
  assert.match(result, /"title":"\[REDACTED\]"/);
  assert.match(result, /"status":"scheduled"/);
});

test('redacts credentials embedded in historical plain-text details', () => {
  const result = redactSerializedLogDetails('request failed with Bearer old.secret.value');
  assert.doesNotMatch(result, /old\.secret\.value/);
  assert.match(result, /Bearer \[REDACTED\]/);
});
