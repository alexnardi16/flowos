import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { recordDiagnostic } from './diagnostics';
import { GOOGLE_SCOPES } from './googleWorkspace';
import { supabase } from './supabase';

const NATIVE_REDIRECT_TO = 'flowos://today';

function getSingleQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function getGoogleNativeRedirectUri() {
  return NATIVE_REDIRECT_TO;
}

export async function finishNativeGoogleOAuth(callbackUrl: string) {
  const parsed = Linking.parse(callbackUrl);
  const queryParams = parsed.queryParams ?? {};
  const error = getSingleQueryParam(queryParams.error);
  const errorDescription = getSingleQueryParam(queryParams.error_description);
  const code = getSingleQueryParam(queryParams.code);

  recordDiagnostic('google-oauth-callback-received', {
    scheme: parsed.scheme ?? null,
    path: parsed.path ?? null,
    hasCode: Boolean(code),
    hasError: Boolean(error),
    queryKeys: Object.keys(queryParams),
  });

  if (error) {
    throw new Error(errorDescription || `Accesso Google non riuscito (${error}).`);
  }

  if (code) {
    recordDiagnostic('google-oauth-code-exchange-started');
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    recordDiagnostic('google-oauth-code-exchange-succeeded');
    return;
  }

  // Keep compatibility with an implicit-flow callback if Supabase returns
  // tokens in the URL fragment instead of a PKCE authorization code.
  const hash = callbackUrl.split('#')[1] ?? '';
  if (hash) {
    const hashParams = new URLSearchParams(hash);
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    if (accessToken && refreshToken) {
      recordDiagnostic('google-oauth-token-session-started');
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) throw sessionError;
      recordDiagnostic('google-oauth-token-session-succeeded');
      return;
    }
    const hashError = hashParams.get('error');
    const hashErrorDescription = hashParams.get('error_description');
    if (hashError) {
      throw new Error(hashErrorDescription || `Accesso Google non riuscito (${hashError}).`);
    }
  }

  throw new Error('Google non ha restituito un codice di accesso valido.');
}

export async function signInWithGoogleWithoutForcedConsent() {
  const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.origin}/today`
    : NATIVE_REDIRECT_TO;

  recordDiagnostic('google-oauth-started', { platform: Platform.OS, redirectTo });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
      scopes: GOOGLE_SCOPES,
      queryParams: {
        access_type: 'offline',
        include_granted_scopes: 'true',
      },
    },
  });
  if (error) {
    recordDiagnostic('google-oauth-signin-failed', error, 'error');
    throw error;
  }

  recordDiagnostic('google-oauth-url-created', { hasUrl: Boolean(data?.url), redirectTo });
  if (Platform.OS === 'web') return data;
  if (!data?.url) throw new Error('Google non ha restituito un URL di accesso.');

  // Do not await an auth session here. On Android openAuthSessionAsync can
  // remain pending until the deep-link callback arrives, which made the UI
  // look permanently stuck on "Apertura Google". The callback is handled by
  // the Linking listener in the login screen instead.
  recordDiagnostic('google-oauth-browser-opening');
  try {
    const result = await WebBrowser.openBrowserAsync(data.url);
    recordDiagnostic('google-oauth-browser-opened', { resultType: result.type });
  } catch (error) {
    recordDiagnostic('google-oauth-browser-open-failed', error, 'error');
    // Fallback to the system browser if Custom Tabs cannot be opened.
    await Linking.openURL(data.url);
    recordDiagnostic('google-oauth-system-browser-opened');
  }

  return data;
}
