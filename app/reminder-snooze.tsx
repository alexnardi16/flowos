import { useLocalSearchParams, router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useState } from 'react';
import { palette, showAlert } from '@/components/ui';
import { scheduleSnoozedReminder } from '@/lib/reminderActions';
import { useFlowStore } from '@/lib/store';

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function timeNowPlusFive() {
  const d = new Date(Date.now() + 5 * 60000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function combine(date: string, time: string) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date) || !/^\\d{2}:\\d{2}$/.test(time)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const value = new Date(y, m - 1, d, hh, mm, 0, 0);
  return Number.isNaN(value.getTime()) ? null : value;
}

export default function ReminderSnooze() {
  const { commitmentId, notificationId } = useLocalSearchParams<{ commitmentId?: string; notificationId?: string }>();
  const item = useFlowStore((state) => state.commitments.find((entry) => entry.id === commitmentId));
  const [date, setDate] = useState(today());
  const [time, setTime] = useState(timeNowPlusFive());

  useEffect(() => {
    if (!item) showAlert('Promemoria', 'Attività non trovata.');
  }, [item]);

  async function save() {
    if (!commitmentId || !notificationId) {
      showAlert('Promemoria', 'Dati del promemoria non validi.');
      return;
    }
    const triggerAt = combine(date, time);
    if (!triggerAt || triggerAt.getTime() <= Date.now()) {
      showAlert('Promemoria', 'Scegli una data e un orario futuri.');
      return;
    }
    try {
      await scheduleSnoozedReminder(commitmentId, notificationId, triggerAt);
      router.replace('/today');
    } catch (error) {
      showAlert('Promemoria', error instanceof Error ? error.message : 'Impossibile rimandare il promemoria.');
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>PROMEMORIA</Text>
        <Text style={styles.title}>Rimanda notifica</Text>
        <Text style={styles.subtitle}>{item?.title ?? 'Attività'}</Text>
        <Text style={styles.label}>Nuova data</Text>
        <TextInput value={date} onChangeText={setDate} placeholder="AAAA-MM-GG" style={styles.input} />
        <Text style={styles.label}>Nuovo orario</Text>
        <TextInput value={time} onChangeText={setTime} placeholder="HH:MM" style={styles.input} keyboardType="numbers-and-punctuation" />
        <View style={styles.actions}>
          <Pressable onPress={() => router.back()} style={styles.secondary}><Text style={styles.secondaryText}>Annulla</Text></Pressable>
          <Pressable onPress={() => void save()} style={styles.primary}><Text style={styles.primaryText}>Rimanda</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 22, borderWidth: 1, borderColor: palette.border },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: palette.primary },
  title: { fontSize: 26, fontWeight: '900', color: palette.ink, marginTop: 6 },
  subtitle: { fontSize: 15, color: palette.muted, marginTop: 5, marginBottom: 18 },
  label: { fontSize: 12, fontWeight: '800', color: palette.muted, marginTop: 12 },
  input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E4EA', borderRadius: 12, padding: 12, marginTop: 5, color: palette.ink },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  secondary: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: '#ECEEF4' },
  secondaryText: { fontWeight: '800', color: palette.ink },
  primary: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: palette.primary },
  primaryText: { fontWeight: '900', color: '#FFF' },
});
