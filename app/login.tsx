import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { BuildInfo } from '../components/BuildInfo';
import { type DiagnosticEntry, subscribeDiagnostics, recordDiagnostic } from '../lib/diagnostics';
import { finishNativeGoogleOAuth, signInWithGoogleWithoutForcedConsent } from '../lib/googleLogin';
import { useAuth } from '../providers/AuthProvider';

const GOOGLE_TIMEOUT_MS = 120_000;

export default function LoginScreen() {
  const { session, loading } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [oauthStatus, setOauthStatus] = useState('Pronto');
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);
  const googleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearGoogleTimeout() {
    if (googleTimeout.current) clearTimeout(googleTimeout.current);
    googleTimeout.current = null;
  }

  async function handleGoogleCallback(url: string) {
    if (!url.startsWith('flowos://')) return;
    recordDiagnostic('google-oauth-link-received', { hasCode: url.includes('code='), hasError: url.includes('error=') });
    setOauthStatus('Ricevuto callback Google, verifica sessione…');
    try {
      await finishNativeGoogleOAuth(url);
      clearGoogleTimeout();
      setGoogleLoading(false);
      setOauthStatus('Accesso Google completato');
      setMessage(null);
    } catch (error) {
      clearGoogleTimeout();
      setGoogleLoading(false);
      setOauthStatus('Errore callback Google');
      setMessage(error instanceof Error ? error.message : 'Accesso Google non riuscito.');
      recordDiagnostic('google-oauth-callback-failed', error, 'error');
    }
  }

  useEffect(() => {
    recordDiagnostic('login-screen-mounted', { path: Platform.OS === 'web' ? window.location.pathname : 'native' });
    const unsubscribe = subscribeDiagnostics(setDiagnostics);
    if (Platform.OS !== 'web') {
      const subscription = Linking.addEventListener('url', ({ url }) => { void handleGoogleCallback(url); });
      void Linking.getInitialURL().then((url) => {
        if (url) void handleGoogleCallback(url);
      }).catch((error) => recordDiagnostic('google-oauth-initial-url-failed', error, 'warn'));
      return () => {
        clearGoogleTimeout();
        subscription.remove();
        unsubscribe();
      };
    }
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (loading || !session) return;
    clearGoogleTimeout();
    setGoogleLoading(false);
    setOauthStatus('Sessione autenticata');
    recordDiagnostic('login-session-detected', { userId: session.user.id, provider: session.user.app_metadata?.provider ?? null });
    router.replace('/today');
  }, [loading, session]);

  async function loginWithGoogle() {
    if (googleLoading) return;
    setGoogleLoading(true);
    setMessage(null);
    setOauthStatus('Preparazione accesso Google…');
    recordDiagnostic('google-oauth-button-pressed');
    clearGoogleTimeout();
    googleTimeout.current = setTimeout(() => {
      setGoogleLoading(false);
      setOauthStatus('Timeout: nessun callback Google ricevuto');
      setMessage('Google non ha restituito il controllo a FlowOS entro 2 minuti. Controlla il log qui sotto.');
      recordDiagnostic('google-oauth-timeout', undefined, 'error');
    }, GOOGLE_TIMEOUT_MS);

    try {
      await signInWithGoogleWithoutForcedConsent();
      if (Platform.OS !== 'web') setOauthStatus('Google aperto: completa l’accesso nel browser…');
    } catch (error) {
      clearGoogleTimeout();
      setGoogleLoading(false);
      setOauthStatus('Apertura Google fallita');
      setMessage(error instanceof Error ? error.message : 'Accesso Google non riuscito.');
      recordDiagnostic('google-oauth-button-failed', error, 'error');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.main}>
        <Text style={styles.eyebrow}>FLOWOS</Text>
        <Text style={styles.title}>Il tuo sistema operativo personale.</Text>
        <Text style={styles.subtitle}>Accedi con Google per usare FlowOS e sincronizzare automaticamente Calendar e Tasks.</Text>
        <Pressable disabled={googleLoading} onPress={() => { void loginWithGoogle(); }} style={[styles.googleButton, googleLoading && styles.buttonDisabled]}>
          <Text style={styles.googleText}>{googleLoading ? 'Apertura Google…' : 'Continua con Google'}</Text>
        </Pressable>
        <Text style={styles.status}>STATO: {oauthStatus}</Text>
        <Text style={styles.permissions}>Dopo la prima autorizzazione, Google normalmente non richiede di nuovo il consenso finché non cambiano i permessi o non revochi l’accesso.</Text>
        {message ? <Text selectable style={styles.error}>{message}</Text> : null}

        <View style={styles.diagnosticsCard}>
          <Text style={styles.diagnosticsTitle}>DIAGNOSTICA ACCESSO</Text>
          <BuildInfo inline />
          <Text selectable style={styles.log}>
            {diagnostics.length
              ? diagnostics.map((entry) => `${entry.at} [${entry.level}] ${entry.event}${entry.details ? ` · ${entry.details}` : ''}`).join('\n')
              : 'Nessun evento diagnostico disponibile.'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#F7F6F2', padding: 28 },
  main: { flex: 1, justifyContent: 'center', minHeight: 760 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 14 },
  title: { fontSize: 36, lineHeight: 40, fontWeight: '800', color: '#111' },
  subtitle: { fontSize: 16, lineHeight: 23, color: '#5E5E5E', marginTop: 14, marginBottom: 22 },
  googleButton: { borderRadius: 16, padding: 17, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: '#D8D5CB' },
  googleText: { fontWeight: '800', fontSize: 16, color: '#172033' },
  status: { marginTop: 12, fontSize: 11, fontWeight: '800', color: '#555' },
  permissions: { fontSize: 12, lineHeight: 17, color: '#777', marginTop: 10 },
  buttonDisabled: { opacity: .55 },
  error: { marginTop: 16, fontSize: 14, lineHeight: 20, color: '#A12626' },
  diagnosticsCard: { marginTop: 24, padding: 14, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DDD9CF' },
  diagnosticsTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1, color: '#555', marginBottom: 4 },
  log: { marginTop: 8, fontFamily: 'monospace', fontSize: 9, lineHeight: 13, color: '#333' },
});
