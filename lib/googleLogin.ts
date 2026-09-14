import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { GOOGLE_SCOPES } from './googleWorkspace';
import { supabase } from './supabase';

const NATIVE_REDIRECT_TO = 'flowos://today';

function getSingleQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function finishNativeOAuth(callbackUrl: string) {
  const parsed = Linking.parse(callbackUrl);
  const queryParams = parsed.queryParams ?? {};
  const error = getSingleQueryParam(queryParams.error);
  const errorDescription = getSingleQueryParam(queryParams.error_description);
  if (error) {
    throw new Error(errorDescription || `Accesso Google non riuscito (${error}).`);
  }

  const code = getSingleQueryParam(queryParams.code);
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
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
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) throw sessionError;
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
  if (error) throw error;

  if (Platform.OS === 'web') return data;
  if (!data?.url) throw new Error('Google non ha restituito un URL di accesso.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') {
    await finishNativeOAuth(result.url);
    return data;
  }

  throw new Error('Accesso Google annullato o interrotto.');
}
