import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

function getEmailRedirectUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }

  return 'flowos://login';
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendMagicLink() {
    if (!email.trim() || sending || cooldown > 0) return;
    setSending(true);
    setMessage(null);
    setIsError(false);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: getEmailRedirectUrl() },
    });

    setSending(false);

    if (error) {
      setIsError(true);
      setMessage(error.message);
      if (Platform.OS !== 'web') Alert.alert('Accesso non riuscito', error.message);
      return;
    }

    setCooldown(60);
    setMessage('Magic link inviato. Apri il nuovo messaggio ricevuto per accedere a FlowOS.');
    if (Platform.OS !== 'web') {
      Alert.alert('Controlla la tua email', 'Apri il link ricevuto per accedere a FlowOS.', [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
    }
  }

  const disabled = sending || cooldown > 0;
  const buttonLabel = sending
    ? 'Invio…'
    : cooldown > 0
      ? `Puoi reinviare tra ${cooldown}s`
      : 'Invia link di accesso';

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>FLOWOS</Text>
      <Text style={styles.title}>Il tuo sistema operativo personale.</Text>
      <Text style={styles.subtitle}>Inserisci l’email: riceverai un link di accesso senza password.</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="nome@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <Pressable disabled={disabled} onPress={sendMagicLink} style={[styles.button, disabled && styles.buttonDisabled]}>
        <Text style={styles.buttonText}>{buttonLabel}</Text>
      </Pressable>
      {message ? <Text style={[styles.message, isError && styles.error]}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: '#F7F6F2' },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 14 },
  title: { fontSize: 36, lineHeight: 40, fontWeight: '800', color: '#111' },
  subtitle: { fontSize: 16, lineHeight: 23, color: '#5E5E5E', marginTop: 14, marginBottom: 28 },
  input: { backgroundColor: '#FFF', borderRadius: 16, padding: 17, fontSize: 16, borderWidth: 1, borderColor: '#E5E2D8' },
  button: { marginTop: 14, borderRadius: 16, padding: 17, backgroundColor: '#111', alignItems: 'center' },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  message: { marginTop: 16, fontSize: 14, lineHeight: 20, color: '#46624A' },
  error: { color: '#A12626' },
});
