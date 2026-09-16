import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { recordDiagnostic } from './diagnostics';
import { connectGoogleFromSession, GOOGLE_SCOPES } from './googleWorkspace';
import { supabase } from './supabase';

const NATIVE_REDIRECT_TO = 'flowos://today';
const handledNativeCallbacks = new Set<string>();

function getSingleQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function getGoogleNativeRedirectUri() {
  return NATIVE_REDIRECT_TO;
}

async function persistGoogleProviderConnection() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error('La sessione FlowOS non è stata creata dopo l’accesso Google.');
  recordDiagnostic('google-oauth-session-ready', {
    userId: data.session.user.id,
    hasProviderToken: Boolean(data.session.provider_token),
    hasProviderRefreshToken: Boolean(data.session.provider_refresh_token),
  });
  if (!data.session.provider_token) {
    throw new Error('Google ha completato l’accesso, ma non ha restituito il token necessario per collegare Calendar e Tasks. Riprova l’accesso Google.');
  }
  await connectGoogleFromSession(data.session, true);
  recordDiagnostic('google-workspace-connection-established', { userId: data.session.user.id });
  return data.session;
}

export async function finishNativeGoogleOAuth(callbackUrl: string) {
  if (handledNativeCallbacks.has(callbackUrl)) {
    recordDiagnostic('google-oauth-callback-duplicate-ignored');
    return;
  }
  handledNativeCallbacks.add(callbackUrl);

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

  if (error) throw new Error(errorDescription || `Accesso Google non riuscito (${error}).`);

  if (code) {
    recordDiagnostic('google-oauth-code-exchange-started');
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    recordDiagnostic('google-oauth-code-exchange-succeeded');
    await persistGoogleProviderConnection();
    return;
  }

  const hash = callbackUrl.split('#')[1] ?? '';
  if (hash) {
    const hashParams = new URLSearchParams(hash);
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    if (accessToken && refreshToken) {
      recordDiagnostic('google-oauth-token-session-started');
      const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (sessionError) throw sessionError;
      recordDiagnostic('google-oauth-token-session-succeeded');
      await persistGoogleProviderConnection();
      return;
    }
    const hashError = hashParams.get('error');
    if (hashError) throw new Error(hashParams.get('error_description') || `Accesso Google non riuscito (${hashError}).`);
  }

  throw new Error('Google non ha restituito un codice di accesso valido.');
}

export async function signInWithGoogleWithoutForcedConsent() {
  const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/today` : NATIVE_REDIRECT_TO;
  recordDiagnostic('google-oauth-started', { platform: Platform.OS, redirectTo });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
      scopes: GOOGLE_SCOPES,
      queryParams: { access_type: 'offline', include_granted_scopes: 'true' },
    },
  });
  if (error) {
    recordDiagnostic('google-oauth-signin-failed', error, 'error');
    throw error;
  }
  recordDiagnostic('google-oauth-url-created', { hasUrl: Boolean(data?.url), redirectTo });
  if (Platform.OS === 'web') return data;
  if (!data?.url) throw new Error('Google non ha restituito un URL di accesso.');
  recordDiagnostic('google-oauth-browser-opening');
  try {
    const result = await WebBrowser.openBrowserAsync(data.url);
    recordDiagnostic('google-oauth-browser-opened', { resultType: result.type });
  } catch (error) {
    recordDiagnostic('google-oauth-browser-open-failed', error, 'error');
    await Linking.openURL(data.url);
    recordDiagnostic('google-oauth-system-browser-opened');
  }
  return data;
}
