import { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Card, palette } from '@/components/ui';
import { useFlowStore } from '@/lib/store';

export default function Me() {
  const [assisted, setAssisted] = useState(true);
  const commitments = useFlowStore((state) => state.commitments);

  const insights = useMemo(() => {
    const done = commitments.filter((item) => item.status === 'done');
    const active = commitments.filter((item) => item.status !== 'done');
    const planned = active.filter((item) => item.scheduledAt);
    const totalMinutes = done.reduce((sum, item) => sum + item.durationMinutes, 0);
    const averageConfidence = commitments.length
      ? Math.round(commitments.reduce((sum, item) => sum + item.confidence, 0) / commitments.length * 100)
      : 0;
    const completionRate = commitments.length ? Math.round(done.length / commitments.length * 100) : 0;
    return { done: done.length, active: active.length, planned: planned.length, totalMinutes, averageConfidence, completionRate };
  }, [commitments]);

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Io</Text>

      <Card>
        <Text style={styles.label}>Modalità di controllo</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.item}>Controllo assistito</Text>
            <Text style={styles.meta}>L’IA propone. Tu approvi le modifiche importanti.</Text>
          </View>
          <Switch value={assisted} onValueChange={setAssisted} />
        </View>
      </Card>

      <View style={styles.metrics}>
        <Card style={styles.metricCard}>
          <Text style={styles.metric}>{insights.completionRate}%</Text>
          <Text style={styles.metricLabel}>Completamento</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text style={styles.metric}>{insights.planned}</Text>
          <Text style={styles.metricLabel}>Pianificati</Text>
        </Card>
      </View>

      <View style={styles.metrics}>
        <Card style={styles.metricCard}>
          <Text style={styles.metric}>{insights.done}</Text>
          <Text style={styles.metricLabel}>Completati</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text style={styles.metric}>{insights.totalMinutes}</Text>
          <Text style={styles.metricLabel}>Minuti conclusi</Text>
        </Card>
      </View>

      <Card>
        <Text style={styles.label}>Il sistema sta imparando</Text>
        <Text style={styles.score}>{insights.averageConfidence}%</Text>
        <Text style={styles.meta}>Affidabilità media delle stime di durata, energia e classificazione.</Text>
      </Card>

      <Card>
        <Text style={styles.label}>Carico attuale</Text>
        <Text style={styles.item}>{insights.active} Commitment aperti</Text>
        <Text style={styles.meta}>FlowOS usa questo dato per evitare giornate sovraccariche e distribuire il lavoro nei prossimi giorni.</Text>
      </Card>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  wrap: { padding: 20, paddingBottom: 110, gap: 16 },
  title: { fontSize: 31, fontWeight: '900', color: palette.ink, marginTop: 14 },
  label: { fontSize: 13, fontWeight: '800', color: palette.primary, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  item: { fontSize: 18, fontWeight: '800', color: palette.ink, marginTop: 8 },
  meta: { fontSize: 13, lineHeight: 18, color: palette.muted, marginTop: 4 },
  score: { fontSize: 42, fontWeight: '900', color: palette.ink, marginTop: 10 },
  metrics: { flexDirection: 'row', gap: 12 },
  metricCard: { flex: 1 },
  metric: { fontSize: 30, fontWeight: '900', color: palette.ink },
  metricLabel: { fontSize: 12, color: palette.muted, marginTop: 4 },
});