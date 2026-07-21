import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { completeOtpLogin } from '../lib/authFlow';
import { recordDiagnostic } from '../lib/diagnostics';
import { signInWithGoogle } from '../lib/googleWorkspace';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';

export default function LoginScreen() {
  const { setAuthenticatedSession } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => { recordDiagnostic('login-screen-mounted', { path: Platform.OS === 'web' ? window.location.pathname : 'native' }); }, []);
  useEffect(() => { if (cooldown <= 0) return; const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000); return () => clearTimeout(timer); }, [cooldown]);

  async function loginWithGoogle() {
    if (googleLoading) return;
    setGoogleLoading(true); setMessage(null); setIsError(false);
    try { await signInWithGoogle(); }
    catch (error) { const text = error instanceof Error ? error.message : 'Accesso Google non riuscito.'; setGoogleLoading(false); setMessage(text); setIsError(true); }
  }

  async function sendCode() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || sending || cooldown > 0) return;
    setSending(true); setMessage(null); setIsError(false); recordDiagnostic('otp-send-started');
    const { error } = await supabase.auth.signInWithOtp({ email: normalizedEmail, options: { shouldCreateUser: true } });
    setSending(false);
    if (error) { recordDiagnostic('otp-send-failed', error, 'error'); setIsError(true); setMessage(error.message); if (Platform.OS !== 'web') Alert.alert('Invio non riuscito', error.message); return; }
    recordDiagnostic('otp-send-succeeded'); setCodeSent(true); setCooldown(60); setMessage('Codice inviato. Inserisci qui il codice di 8 cifre ricevuto via email.');
  }

  async function verifyCode() {
    const normalizedEmail = email.trim().toLowerCase(); const normalizedOtp = otp.replace(/\D/g, '');
    if (!normalizedEmail || normalizedOtp.length !== 8 || verifying) return;
    setVerifying(true); setMessage(null); setIsError(false); recordDiagnostic('otp-verify-started');
    try {
      await completeOtpLogin({
        verify: async () => { const result = await supabase.auth.verifyOtp({ email: normalizedEmail, token: normalizedOtp, type: 'email' }); recordDiagnostic('otp-verify-returned', { hasSession: Boolean(result.data.session), hasUser: Boolean(result.data.user), error: result.error?.message ?? null }); return result; },
        commitSession: (session) => { recordDiagnostic('otp-session-commit-started', { userId: session.user.id }); setAuthenticatedSession(session); recordDiagnostic('otp-session-committed'); },
        navigate: (href) => { recordDiagnostic('otp-navigation-started', { href }); router.replace(href); recordDiagnostic('otp-navigation-dispatched', { href }); },
      });
    } catch (error) { const errorMessage = error instanceof Error ? error.message : 'Accesso non riuscito.'; recordDiagnostic('otp-login-failed', error, 'error'); setVerifying(false); setIsError(true); setMessage(errorMessage); if (Platform.OS !== 'web') Alert.alert('Accesso non riuscito', errorMessage); }
  }

  const sendDisabled = sending || cooldown > 0;
  const sendButtonLabel = sending ? 'Invio…' : cooldown > 0 ? `Puoi reinviare tra ${cooldown}s` : codeSent ? 'Invia un nuovo codice' : 'Invia codice di accesso';
  const verifyDisabled = verifying || otp.replace(/\D/g, '').length !== 8;

  return <View style={styles.container}>
    <Text style={styles.eyebrow}>FLOWOS</Text><Text style={styles.title}>Il tuo sistema operativo personale.</Text>
    <Text style={styles.subtitle}>Accedi con Google per sincronizzare automaticamente Calendar e Tasks.</Text>
    <Pressable disabled={googleLoading} onPress={() => { void loginWithGoogle(); }} style={[styles.googleButton, googleLoading && styles.buttonDisabled]}><Text style={styles.googleText}>{googleLoading ? 'Apertura Google…' : 'Continua con Google'}</Text></Pressable>
    <Text style={styles.permissions}>FlowOS chiederà accesso a profilo, calendari ed elenchi di attività. La password resta sempre su Google.</Text>
    <View style={styles.separator}><View style={styles.line}/><Text style={styles.or}>oppure</Text><View style={styles.line}/></View>
    <TextInput value={email} onChangeText={setEmail} editable={!verifying} placeholder="nome@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={styles.input}/>
    <Pressable disabled={sendDisabled} onPress={() => { void sendCode(); }} style={[styles.button, sendDisabled && styles.buttonDisabled]}><Text style={styles.buttonText}>{sendButtonLabel}</Text></Pressable>
    {codeSent ? <><TextInput value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 8))} placeholder="Codice a 8 cifre" keyboardType="number-pad" autoComplete="one-time-code" maxLength={8} style={[styles.input, styles.otpInput]}/><Pressable disabled={verifyDisabled} onPress={() => { void verifyCode(); }} style={[styles.button, verifyDisabled && styles.buttonDisabled]}><Text style={styles.buttonText}>{verifying ? 'Verifica…' : 'Accedi'}</Text></Pressable></> : null}
    {message ? <Text style={[styles.message, isError && styles.error]}>{message}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({container:{flex:1,justifyContent:'center',padding:28,backgroundColor:'#F7F6F2'},eyebrow:{fontSize:12,fontWeight:'800',letterSpacing:2,marginBottom:14},title:{fontSize:36,lineHeight:40,fontWeight:'800',color:'#111'},subtitle:{fontSize:16,lineHeight:23,color:'#5E5E5E',marginTop:14,marginBottom:22},googleButton:{borderRadius:16,padding:17,backgroundColor:'#fff',alignItems:'center',borderWidth:1,borderColor:'#D8D5CB'},googleText:{fontWeight:'800',fontSize:16,color:'#172033'},permissions:{fontSize:12,lineHeight:17,color:'#777',marginTop:10},separator:{flexDirection:'row',alignItems:'center',gap:10,marginVertical:22},line:{height:1,backgroundColor:'#DDD9CF',flex:1},or:{fontSize:12,color:'#777'},input:{backgroundColor:'#FFF',borderRadius:16,padding:17,fontSize:16,borderWidth:1,borderColor:'#E5E2D8'},otpInput:{marginTop:22,textAlign:'center',letterSpacing:8,fontSize:24,fontWeight:'700'},button:{marginTop:14,borderRadius:16,padding:17,backgroundColor:'#111',alignItems:'center'},buttonDisabled:{opacity:.55},buttonText:{color:'#FFF',fontWeight:'800',fontSize:16},message:{marginTop:16,fontSize:14,lineHeight:20,color:'#46624A'},error:{color:'#A12626'}});
