import { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, palette, showAlert, showConfirm } from '@/components/ui';
import { deleteFlowOSAccount } from '@/lib/account';

export default function DeleteAccount() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleDelete() {
    const confirmed = await showConfirm(
      'Eliminare definitivamente l\'account?',
      'Questa operazione elimina irreversibilmente i dati FlowOS, le connessioni Google, i token Google e l\'account di autenticazione. I dati non possono essere recuperati.',
      'Elimina definitivamente',
    );
    if (!confirmed || busy) return;
    setBusy(true);
    try {
      await deleteFlowOSAccount();
      setDone(true);
    } catch (error) {
      showAlert('FlowOS', error instanceof Error ? error.message : 'Eliminazione dell\'account non riuscita.');
    } finally {
      setBusy(false);
    }
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.wrap}>
    <Text style={styles.eyebrow}>FLOWOS</Text>
    <Text style={styles.title}>Eliminazione account</Text>
    {done ? <Card><Text style={styles.heading}>Account eliminato</Text><Text style={styles.body}>L'account FlowOS e i dati associati sono stati eliminati definitivamente.</Text></Card> : <>
      <Card><Text style={styles.heading}>Attenzione</Text><Text style={styles.body}>L'eliminazione è irreversibile. Verranno eliminati i dati FlowOS, le impostazioni e i token di Google salvati da FlowOS, oltre all'account di autenticazione.</Text><View style={styles.spacer}/><Button danger label={busy ? 'Eliminazione…' : 'Elimina definitivamente il mio account'} onPress={() => { void handleDelete(); }} disabled={busy} /></Card>
    </>}
  </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:20,gap:14},eyebrow:{fontSize:12,fontWeight:'900',letterSpacing:1.5,color:palette.primary},title:{fontSize:32,fontWeight:'900',color:palette.ink},heading:{fontSize:19,fontWeight:'900',color:palette.ink,marginBottom:8},body:{fontSize:14,lineHeight:21,color:palette.muted},spacer:{height:8}});
