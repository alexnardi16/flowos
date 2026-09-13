import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

export const supabase = createClient(url ?? 'https://placeholder.supabase.co', key ?? 'placeholder', {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    // Google OAuth returns the authenticated session in the browser URL.
    // It must be detected on web or the user is sent back to the login screen.
    detectSessionInUrl: Platform.OS === 'web',
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    try {
      if (state === 'active') {
        void supabase.auth.startAutoRefresh().catch((error: unknown) => {
          console.warn('[FlowOS] supabase-auto-refresh-start-failed', error);
        });
      } else {
        void supabase.auth.stopAutoRefresh().catch((error: unknown) => {
          console.warn('[FlowOS] supabase-auto-refresh-stop-failed', error);
        });
      }
    } catch (error) {
      console.warn('[FlowOS] supabase-auto-refresh-failed', error);
    }
  });
}
