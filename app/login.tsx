import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { recordDiagnostic } from '../lib/diagnostics';
import { signInWithGoogleWithoutForcedConsent } from '../lib/googleLogin';
import { useAuth } from '../providers/AuthProvider';

export default function LoginScreen() {
  const { session, loading } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { recordDiagnostic('login-screen-mounted', { path: Platform.OS === 'web' ? window.location.pathname : 'native' }); }, []);
  useEffect(() => {
    if (loading || !session) return;
    recordDiagnostic('login-session-detected', { userId: session.user.id, provider: session.user.app_metadata?.provider ?? null });
    router.replace('/today');
  }, [loading, session]);

  async function loginWithGoogle() {
    if (googleLoading) return;
    setGoogleLoading(true); setMessage(null);
    try { await signInWithGoogleWithoutForcedConsent(); }
    catch (error) { setGoogleLoading(false); setMessage(error instanceof Error ? error.message : 'Accesso Google non riuscito.'); }
  }

  return <View style={styles.container}>
    <Text style={styles.eyebrow}>FLOWOS</Text>
    <Text style={styles.title}>Il tuo sistema operativo personale.</Text>
    <Text style={styles.subtitle}>Accedi con Google per usare FlowOS e sincronizzare automaticamente Calendar e Tasks.</Text>
    <Pressable disabled={googleLoading} onPress={() => { void loginWithGoogle(); }} style={[styles.googleButton, googleLoading && styles.buttonDisabled]}>
      <Text style={styles.googleText}>{googleLoading ? 'Apertura Google…' : 'Continua con Google'}</Text>
    </Pressable>
    <Text style={styles.permissions}>Dopo la prima autorizzazione, Google normalmente non richiede di nuovo il consenso finché non cambiano i permessi o non revochi l’accesso.</Text>
    {message ? <Text style={styles.error}>{message}</Text> : null}
  </View>;
}

const styles=StyleSheet.create({container:{flex:1,justifyContent:'center',padding:28,backgroundColor:'#F7F6F2'},eyebrow:{fontSize:12,fontWeight:'800',letterSpacing:2,marginBottom:14},title:{fontSize:36,lineHeight:40,fontWeight:'800',color:'#111'},subtitle:{fontSize:16,lineHeight:23,color:'#5E5E5E',marginTop:14,marginBottom:22},googleButton:{borderRadius:16,padding:17,backgroundColor:'#fff',alignItems:'center',borderWidth:1,borderColor:'#D8D5CB'},googleText:{fontWeight:'800',fontSize:16,color:'#172033'},permissions:{fontSize:12,lineHeight:17,color:'#777',marginTop:10},buttonDisabled:{opacity:.55},error:{marginTop:16,fontSize:14,lineHeight:20,color:'#A12626'}});
