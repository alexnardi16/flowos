import { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, palette } from '@/components/ui';
import { useFlowStore } from '@/lib/store';

export default function Plan() {
  const commitments = useFlowStore((state) => state.commitments);
  const autoPlan = useFlowStore((state) => state.autoPlan);
  const [planning, setPlanning] = useState(false);

  const items = useMemo(() => commitments
    .filter((item) => item.status !== 'done')
    .sort((a, b) => {
      if (!a.scheduledAt) return 1;
      if (!b.scheduledAt) return -1;
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    }), [commitments]);

  async function handleAutoPlan() {
    setPlanning(true);
    try {
      await autoPlan();
    } finally {
      setPlanning(false);
    }
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Piano</Text>
      <Text style={styles.sub}>Impegni fissi e blocchi IA, in un’unica sequenza.</Text>
      <Button label={planning ? 'Sto pianificando…' : 'Genera piano automatico'} onPress={handleAutoPlan} />
      <Text style={styles.helper}>FlowOS ordina per scadenza, energia e affidabilità, evitando sovrapposizioni con gli impegni fissi.</Text>
      {items.map((item) => <Card key={item.id}>
        <View style={styles.row}>
          <Chip>{item.fixed ? 'FISSO' : item.scheduledAt ? 'PIANIFICATO IA' : 'FLESSIBILE'}</Chip>
          <Text style={styles.time}>{item.scheduledAt ? new Date(item.scheduledAt).toLocaleString('it-IT', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'Da pianificare'}</Text>
        </View>
        <Text style={styles.item}>{item.title}</Text>
        <Text style={styles.meta}>{item.durationMinutes} min · {item.context} · energia {item.energy}</Text>
      </Card>)}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  wrap: { padding: 20, paddingBottom: 110, gap: 14 },
  title: { fontSize: 31, fontWeight: '900', color: palette.ink, marginTop: 14 },
  sub: { fontSize: 16, color: palette.muted, marginBottom: 2 },
  helper: { fontSize: 13, lineHeight: 18, color: palette.muted, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  time: { flex: 1, textAlign: 'right', fontWeight: '800', color: palette.primary },
  item: { fontSize: 18, fontWeight: '800', color: palette.ink, marginTop: 12 },
  meta: { fontSize: 13, color: palette.muted, marginTop: 6 },
});