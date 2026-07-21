const test = require('node:test');
const assert = require('node:assert/strict');
const { AUTHENTICATED_HOME, completeOtpLogin } = require('../.test-dist/authFlow.js');

const session = {
  access_token: 'access',
  refresh_token: 'refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'user-1' },
};

test('uses a public authenticated URL rather than an Expo Router group', () => {
  assert.equal(AUTHENTICATED_HOME, '/today');
  assert.equal(AUTHENTICATED_HOME.includes('('), false);
});

test('commits the verified session before navigating to authenticated home', async () => {
  const calls = [];
  await completeOtpLogin({
    verify: async () => ({ data: { session }, error: null }),
    commitSession: value => calls.push(['session', value]),
    navigate: href => calls.push(['navigate', href]),
  });

  assert.deepEqual(calls, [
    ['session', session],
    ['navigate', '/today'],
  ]);
});

test('does not navigate when Supabase returns an OTP error', async () => {
  let navigated = false;
  await assert.rejects(
    completeOtpLogin({
      verify: async () => ({ data: { session: null }, error: { message: 'Invalid token' } }),
      commitSession: () => assert.fail('session must not be committed'),
      navigate: () => { navigated = true; },
    }),
    /Invalid token/,
  );
  assert.equal(navigated, false);
});

test('does not navigate when verification succeeds without a session', async () => {
  let navigated = false;
  await assert.rejects(
    completeOtpLogin({
      verify: async () => ({ data: { session: null }, error: null }),
      commitSession: () => assert.fail('session must not be committed'),
      navigate: () => { navigated = true; },
    }),
    /sessione valida/,
  );
  assert.equal(navigated, false);
});
