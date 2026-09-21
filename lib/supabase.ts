import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? Constants.expoConfig?.extra?.supabaseUrl;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? Constants.expoConfig?.extra?.supabasePublishableKey;

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
    // Native OAuth uses the authorization-code + PKCE flow. This is important
    // for Android deep links because the callback returns a `code` query
    // parameter instead of relying on a URL fragment that can be lost when the
    // browser hands control back to the native app.
    flowType: 'pkce',
    // The native callback is handled explicitly by app/_layout.tsx. On web,
    // Supabase can process the callback URL itself.
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
