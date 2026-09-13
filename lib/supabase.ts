import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

// Keep the React Native storage boundary explicit. This avoids relying on
// module interop when supabase-js calls storage methods from Hermes.
const nativeStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export const supabase = createClient(url ?? 'https://placeholder.supabase.co', key ?? 'placeholder', {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: nativeStorage } : {}),
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
      const result = state === 'active'
        ? supabase.auth.startAutoRefresh()
        : supabase.auth.stopAutoRefresh();
      void Promise.resolve(result).catch((error: unknown) => {
        console.warn('[FlowOS] supabase-auto-refresh-failed', error);
      });
    } catch (error) {
      console.warn('[FlowOS] supabase-auto-refresh-threw', error);
    }
  });
}
