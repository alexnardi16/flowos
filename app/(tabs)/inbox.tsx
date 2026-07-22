import { useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, palette } from '@/components/ui';
import { saveCommitment } from '@/lib/commitmentsRepository';
import { useFlowStore } from '@/lib/store';

export default function Inbox() {
  const commitments = useFlowStore((state) => state.commitments);
  const hydrateFromCloud = useFlowStore((state) => state.hydrateFromCloud);
  const [busyId, setBusyId] = useState<string | null>(null);
  const items = useMemo(
    () => commitments.filter((commitment) => commitment.status !== 'done' && commitment.confidence < 0.85),
    [commitments],
  );

  async function confirm(id: string) {
    const item = commitments.find((commitment) => commitment.id === id);
    if (!item) return;
    setBusyId(id);
    try {
      await saveCommitment({ ...item, confidence: 1 });
      await hydrateFromCloud();
    } catch (error) {
      Alert.alert('Inbox', error instanceof Error ? error.message : 'Conferma non riuscita.');
    } finally {
      setBusyId(null);
    }
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Inbox</Text>
      <Text style={styles.sub}>Qui trovi soltanto gli elementi che FlowOS non è riuscito a interpretare con sufficiente sicurezza.</Text>
      <Card>
        <Text style={styles.guideTitle}>Cosa devi fare</Text>
        <Text style={styles.guide}>Controlla che titolo, tipo, data e durata siano corretti. Se lo sono, premi “Conferma”. Dopo la conferma l’elemento sparisce dall’Inbox e resta nel Piano.</Text>
      </Card>
      {items.length ? items.map((commitment) => (
        <Card key={commitment.id}>
          <Text style={styles.item}>{commitment.title}</Text>
          <Text style={styles.meta}>Tipo proposto: {commitment.kind} · affidabilità {Math.round(commitment.confidence * 100)}%</Text>
          <Text style={styles.meta}>Data: {commitment.scheduledAt || commitment.dueAt ? new Date(commitment.scheduledAt ?? commitment.dueAt!).toLocaleString('it-IT') : 'non definita'}</Text>
          <Text style={styles.meta}>Durata proposta: {commitment.durationMinutes} minuti</Text>
          <View style={styles.actions}>
            <Pressable disabled={busyId === commitment.id} onPress={() => { void confirm(commitment.id); }} style={styles.confirmButton}>
              <Text style={styles.confirmText}>{busyId === commitment.id ? 'Conferma…' : 'Conferma'}</Text>
            </Pressable>
          </View>
        </Card>
      )) : (
        <Card><Text style={styles.empty}>Tutto chiaro. Nessun elemento richiede la tua verifica.</Text></Card>
      )}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:20,paddingBottom:110,gap:14},title:{fontSize:31,fontWeight:'900',color:palette.ink,marginTop:14},sub:{fontSize:16,lineHeight:22,color:palette.muted,marginBottom:2},guideTitle:{fontSize:16,fontWeight:'900',color:palette.ink},guide:{fontSize:14,lineHeight:20,color:palette.muted,marginTop:8},item:{fontSize:18,fontWeight:'800',color:palette.ink},meta:{fontSize:13,lineHeight:18,color:palette.muted,marginTop:6},actions:{flexDirection:'row',marginTop:14},confirmButton:{backgroundColor:palette.primary,borderRadius:14,paddingHorizontal:16,paddingVertical:11},confirmText:{color:'#FFFFFF',fontWeight:'900'},empty:{fontWeight:'800',color:palette.success}
});