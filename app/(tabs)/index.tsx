import { router } from 'expo-router';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, palette } from '@/components/ui';
import { useFlowStore } from '@/lib/store';

export default function Today() {
  const items = useFlowStore((state) => state.commitments.filter((commitment) => commitment.status !== 'done'));
  const current = items.find((commitment) => commitment.kind === 'task');
  const event = items.find((commitment) => commitment.kind === 'event');
  const complete = useFlowStore((state) => state.complete);
  const postpone = useFlowStore((state) => state.postpone);
  const start = useFlowStore((state) => state.startFocus);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.wrap}>
        <Text style={s.hello}>Buongiorno, Alex</Text>
        <Text style={s.title}>La cosa migliore da fare adesso</Text>

        {current ? (
          <Card style={{ gap: 14 }}>
            <View style={s.row}>
              <Chip>ADESSO</Chip>
              <Text style={s.conf}>{Math.round((current.confidence ?? 0) * 100)}% confidenza</Text>
            </View>
            <Text style={s.task}>{current.title}</Text>
            <Text style={s.meta}>
              {current.durationMinutes} min · Energia {current.energy} · {current.context}
            </Text>
            {current.outcome ? <Text style={s.outcome}>Risultato: {current.outcome}</Text> : null}
            <View style={s.actions}>
              <Button
                label="Inizia"
                onPress={() => {
                  start(current.id);
                  router.push('/focus');
                }}
              />
              <Button secondary label="Rimanda" onPress={() => void postpone(current.id)} />
              <Button secondary label="Fatto" onPress={() => void complete(current.id)} />
            </View>
          </Card>
        ) : (
          <Card style={{ gap: 12 }}>
            <Text style={s.emptyTitle}>Nessuna attività attiva</Text>
            <Text style={s.meta}>Aggiungi un’attività per ricevere il prossimo suggerimento.</Text>
            <Button label="Aggiungi attività" onPress={() => router.push('/capture')} />
          </Card>
        )}

        <Text style={s.section}>Prossimo evento</Text>
        {event ? (
          <Card>
            <Text style={s.eventTime}>
              {event.scheduledAt
                ? new Date(event.scheduledAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                : 'Da pianificare'}
            </Text>
            <Text style={s.event}>{event.title}</Text>
            <Text style={s.meta}>{event.durationMinutes} min · impegno fisso</Text>
          </Card>
        ) : (
          <Card>
            <Text style={s.meta}>Nessun evento programmato.</Text>
          </Card>
        )}

        <Text style={s.section}>Capacità di oggi</Text>
        <Card>
          <Text style={s.capacity}>3 h 20 min</Text>
          <Text style={s.meta}>Tempo realmente disponibile · 2 attività realistiche</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  wrap: { padding: 20, paddingBottom: 110, gap: 14 },
  hello: { fontSize: 15, color: palette.muted, fontWeight: '700' },
  title: { fontSize: 31, lineHeight: 36, fontWeight: '900', color: palette.ink, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  conf: { fontSize: 12, color: palette.muted, fontWeight: '700' },
  task: { fontSize: 24, lineHeight: 30, fontWeight: '900', color: palette.ink },
  emptyTitle: { fontSize: 21, lineHeight: 27, fontWeight: '900', color: palette.ink },
  meta: { fontSize: 14, color: palette.muted },
  outcome: { backgroundColor: '#F2F8F6', padding: 12, borderRadius: 14, color: palette.success, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  section: { fontSize: 18, fontWeight: '900', color: palette.ink, marginTop: 10 },
  eventTime: { fontSize: 26, fontWeight: '900', color: palette.primary },
  event: { fontSize: 19, fontWeight: '800', color: palette.ink, marginVertical: 4 },
  capacity: { fontSize: 30, fontWeight: '900', color: palette.ink },
});