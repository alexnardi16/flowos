import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, palette, showAlert } from '@/components/ui';
import { buildDailySummary, DailySummary } from '@/lib/dailySummary';
import { buildReminderPlan } from '@/lib/reminderPlan';
import { buildCustomReminders } from '@/lib/customReminders';
import { checkAndRecoverMissedDailySummary, registerBackgroundSync, runDailySummaryRefresh, unregisterBackgroundSync } from '@/lib/backgroundSyncService';
import {
  DAILY_SUMMARY_HOUR,
  DAILY_SUMMARY_MINUTE,
  disableDailySummaryNotification,
  getLastRecoveryDateKey,
  isDailySummaryEnabledStored,
  NOTIFICATIONS_SUPPORTED_HERE,
  sendImmediateSummaryNotification,
  setDailySummaryEnabledStored,
} from '@/lib/notificationService';
import { clearNotificationLog, getNotificationLog, subscribeNotificationLog, type NotificationLogEntry } from '@/lib/notificationLog';
import { useFlowStore } from '@/lib/store';

const TIME_LABEL = `${String(DAILY_SUMMARY_HOUR).padStart(2, '0')}:${String(DAILY_SUMMARY_MINUTE).padStart(2, '0')}`;

function logLine(entry: NotificationLogEntry) {
  const time = new Date(entry.at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${time} [${entry.level}] ${entry.event}${entry.details ? ` — ${entry.details}` : ''}`;
}

export default function NotificationsSettings() {
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [lastRecovery, setLastRecovery] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);
  const commitments = useFlowStore((state) => state.commitments);
  const reminderPlan = buildReminderPlan(commitments, new Date());
  const upcomingReminders = buildCustomReminders(commitments, new Date());

  useEffect(() => {
    void isDailySummaryEnabledStored().then(setEnabled);
    void getLastRecoveryDateKey().then(setLastRecovery);
    const unsubscribe = subscribeNotificationLog(setLogs);
    void getNotificationLog().then(setLogs);
    return unsubscribe;
  }, []);

  async function toggle(value: boolean) {
    setBusy(true);
    try {
      setEnabled(value);
      await setDailySummaryEnabledStored(value);
      if (value) {
        await registerBackgroundSync();
        await runDailySummaryRefresh();
        await checkAndRecoverMissedDailySummary();
      } else {
        await unregisterBackgroundSync();
        await disableDailySummaryNotification();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Operazione non riuscita.';
      showAlert('Notifiche', message);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!NOTIFICATIONS_SUPPORTED_HERE) {
      showAlert('Notifiche', "Le notifiche non sono supportate nel browser web. Prova dall'app installata su telefono.");
      return;
    }
    setBusy(true);
    try {
      const summary: DailySummary = buildDailySummary(commitments, new Date());
      const identifier = await sendImmediateSummaryNotification(summary, true);
      if (identifier) showAlert('Notifiche', 'Notifica di prova inviata.');
      else showAlert('Notifiche', 'Invio non riuscito: permesso notifiche non concesso. Controlla le impostazioni del telefono.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invio non riuscito.';
      showAlert('Notifiche', message);
    } finally {
      setBusy(false);
    }
  }

  function clearLogs() {
    void clearNotificationLog();
    showAlert('Notifiche', 'Log ripulito.');
  }

  async function copyLogs() {
    const text = logs.map(logLine).join('\n');
    if (!text) return showAlert('Notifiche', 'Non ci sono log da copiare.');
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('Clipboard non disponibile');
      await navigator.clipboard.writeText(text);
      showAlert('Notifiche', 'Log copiato negli appunti.');
    } catch {
      showAlert('Notifiche', 'Non è stato possibile copiare automaticamente il log.');
    }
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Notifiche</Text>

      <Card>
        <Text style={styles.label}>Riepilogo giornaliero</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.item}>Ricevi il riepilogo alle {TIME_LABEL}</Text>
            <Text style={styles.meta}>FlowOS sincronizza Google Calendar e Google Tasks prima di inviarlo. Se il telefono era spento o offline alle {TIME_LABEL}, il riepilogo arriva comunque appena riapri l'app.</Text>
          </View>
          <Switch value={enabled} disabled={busy} onValueChange={(value) => { void toggle(value); }} />
        </View>
        {lastRecovery ? <Text style={styles.meta}>Ultimo recupero automatico: {lastRecovery}</Text> : null}
        <View style={styles.actions}>
          <Button secondary label="Invia adesso notifiche di prova" onPress={() => { void sendTest(); }} disabled={busy || !enabled} />
        </View>
        <Text style={styles.note}>
          Nota tecnica: iOS e Android decidono loro quando eseguire la sincronizzazione in background, per risparmiare batteria.
          L'orario della notifica è garantito dal sistema operativo; il contenuto riflette l'ultima sincronizzazione riuscita prima di quell'orario.
        </Text>
      </Card>

      <Card>
        <Text style={styles.label}>Promemoria</Text>
        <Text style={styles.meta}>Un avviso per ogni promemoria configurato su un'attività, più una notifica raggruppata per i task in scadenza e per quelli scaduti. Il badge sull'icona conta {reminderPlan.badgeCount} task da guardare.</Text>
        <View style={styles.row}>
          <Text style={styles.item}>{upcomingReminders.length} promemoria in coda</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.item}>{reminderPlan.dueSoon.length} task in scadenza · {reminderPlan.overdue.length} scadute</Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.label}>Logger notifiche</Text>
        <Text style={styles.meta}>Registra ogni pianificazione, invio e sincronizzazione legata alle notifiche, su tutte le piattaforme.</Text>
        <View style={styles.logActions}>
          <Button secondary label={showLogs ? 'Nascondi log' : 'Mostra log'} onPress={() => setShowLogs((value) => !value)} style={{flex:1}} />
          <Button secondary label="Copia log" onPress={() => { void copyLogs(); }} style={{flex:1}} />
          <Button secondary label="Pulisci log" onPress={clearLogs} style={{flex:1}} />
        </View>
        {showLogs ? <View style={styles.logBox}>
          {logs.length ? logs.map((entry, index) => (
            <Text key={`${entry.at}-${index}`} selectable style={[styles.logLine, entry.level === 'error' && styles.logError]}>{logLine(entry)}</Text>
          )) : <Text style={styles.meta}>Nessun evento registrato.</Text>}
        </View> : null}
      </Card>

      <Button secondary label="Indietro" onPress={() => router.back()} />
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  wrap: { padding: 20, paddingBottom: 60, gap: 16 },
  title: { fontSize: 31, fontWeight: '900', color: palette.ink, marginTop: 14 },
  label: { fontSize: 13, fontWeight: '800', color: palette.primary, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  item: { fontSize: 16, fontWeight: '800', color: palette.ink },
  meta: { fontSize: 13, lineHeight: 18, color: palette.muted, marginTop: 6 },
  note: { fontSize: 12, lineHeight: 17, color: palette.muted, marginTop: 14, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  logActions: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'nowrap' },
  logBox: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: '#111827', gap: 6 },
  logLine: { fontSize: 10, lineHeight: 14, color: '#D1D5DB', fontFamily: 'monospace' },
  logError: { color: '#FCA5A5' },
});
