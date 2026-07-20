import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

function getEmailRedirectUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'flowos://login';
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  async function sendMagicLink() {
    if (!email.trim()) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: getEmailRedirectUrl() },
    });
    setSending(false);
    if (error) Alert.alert('Accesso non riuscito', error.message);
    else Alert.alert('Controlla la tua email', 'Apri il link ricevuto per accedere a FlowOS.', [{ text: 'OK', onPress: () => router.replace('/') }]);
  }

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
      <Pressable disabled={sending} onPress={sendMagicLink} style={styles.button}>
        <Text style={styles.buttonText}>{sending ? 'Invio…' : 'Invia link di accesso'}</Text>
      </Pressable>
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
  buttonText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
