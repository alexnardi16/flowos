import { Platform } from 'react-native';
import { GOOGLE_SCOPES } from './googleWorkspace';
import { supabase } from './supabase';

export async function signInWithGoogleWithoutForcedConsent() {
  const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.origin}/today`
    : 'flowos://today';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      scopes: GOOGLE_SCOPES,
      queryParams: {
        access_type: 'offline',
        include_granted_scopes: 'true',
      },
    },
  });
  if (error) throw error;
  return data;
}
