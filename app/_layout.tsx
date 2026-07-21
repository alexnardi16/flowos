import type { ErrorBoundaryProps } from 'expo-router';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatDiagnostics, recordDiagnostic } from '../lib/diagnostics';
import { AuthProvider } from '../providers/AuthProvider';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    recordDiagnostic('react-error-boundary', error, 'error');
  }, [error]);

  const diagnostics = formatDiagnostics();

  return (
    <ScrollView contentContainerStyle={styles.errorContainer}>
      <Text style={styles.errorEyebrow}>FLOWOS — ERRORE DI AVVIO</Text>
      <Text style={styles.errorTitle}>L’app non è riuscita a caricare la schermata.</Text>
      <Text style={styles.errorMessage}>{error.message}</Text>
      <Pressable style={styles.retryButton} onPress={retry}>
        <Text style={styles.retryText}>Riprova</Text>
      </Pressable>
      <Text selectable style={styles.diagnostics}>{diagnostics || error.stack || 'Nessun dettaglio disponibile.'}</Text>
    </ScrollView>
  );
}

export default function Root() {
  useEffect(() => {
    recordDiagnostic('root-layout-mounted');
    if (typeof window === 'undefined') return;

    const onError = (event: ErrorEvent) => recordDiagnostic('window-error', event.error ?? event.message, 'error');
    const onUnhandledRejection = (event: PromiseRejectionEvent) => recordDiagnostic('unhandled-promise-rejection', event.reason, 'error');
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <View style={styles.root}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: '100%' },
  errorContainer: { flexGrow: 1, justifyContent: 'center', padding: 28, backgroundColor: '#F7F6F2' },
  errorEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: '#A12626', marginBottom: 12 },
  errorTitle: { fontSize: 28, lineHeight: 34, fontWeight: '900', color: '#111' },
  errorMessage: { marginTop: 14, fontSize: 16, lineHeight: 23, color: '#A12626' },
  retryButton: { alignSelf: 'flex-start', marginTop: 20, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13, backgroundColor: '#111' },
  retryText: { color: '#FFF', fontWeight: '800' },
  diagnostics: { marginTop: 24, padding: 14, borderRadius: 12, backgroundColor: '#FFF', fontFamily: 'monospace', fontSize: 11, lineHeight: 16, color: '#333' },
});