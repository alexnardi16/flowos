import { useMemo } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { Card, palette } from '@/components/ui';
import { useFlowStore } from '@/lib/store';

export default function Inbox() {
  const commitments = useFlowStore((state) => state.commitments);
  const items = useMemo(
    () => commitments.filter((commitment) => commitment.status !== 'done' && commitment.confidence < 0.85),
    [commitments],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.title}>Inbox</Text>
        <Text style={styles.sub}>Solo ciò che richiede una tua decisione.</Text>
        {items.length ? items.map((commitment) => (
          <Card key={commitment.id}>
            <Text style={styles.item}>{commitment.title}</Text>
            <Text style={styles.meta}>Confidenza IA {Math.round(commitment.confidence * 100)}% · verifica consigliata</Text>
          </Card>
        )) : (
          <Card><Text style={styles.empty}>Tutto chiaro. Nessuna decisione in sospeso.</Text></Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  wrap: { padding: 20, paddingBottom: 110, gap: 14 },
  title: { fontSize: 31, fontWeight: '900', color: palette.ink, marginTop: 14 },
  sub: { fontSize: 16, color: palette.muted, marginBottom: 8 },
  item: { fontSize: 18, fontWeight: '800', color: palette.ink },
  meta: { fontSize: 13, color: palette.muted, marginTop: 6 },
  empty: { fontWeight: '800', color: palette.success },
});