import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function AuthCallbackScreen() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function completeSignIn() {
      try {
        if (typeof window === 'undefined') return;

        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        const authError = url.searchParams.get('error_description') ?? hash.get('error_description');

        if (authError) throw new Error(authError);

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!data.session) throw new Error('Il link non contiene una sessione valida. Richiedi un nuovo magic link.');
        }

        window.history.replaceState({}, document.title, '/');
        if (active) router.replace('/');
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : 'Accesso non riuscito.');
        }
      }
    }

    void completeSignIn();
    return () => {
      active = false;
    };
  }, []);

  if (errorMessage) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Accesso non riuscito</Text>
        <Text style={styles.message}>{errorMessage}</Text>
        <Pressable style={styles.button} onPress={() => router.replace('/login')}>
          <Text style={styles.buttonText}>Torna al login</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
      <Text style={styles.message}>Completamento dell’accesso a FlowOS…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#F7F6F2',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#111', textAlign: 'center' },
  message: { marginTop: 16, fontSize: 16, lineHeight: 23, color: '#5E5E5E', textAlign: 'center' },
  button: { marginTop: 24, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 22, backgroundColor: '#111' },
  buttonText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
