import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, palette, showAlert } from '@/components/ui';
import { buildDailySummary, DailySummary } from '@/lib/dailySummary';
import { buildReminderPlan } from '@/lib/reminderPlan';
import { buildCustomReminders } from '@/lib/customReminders';
import { checkAndRecoverMissedDailySummary, registerBackgroundSync, runDailySummaryRefresh, unregisterBackgroundSync } from '@/lib/notificationSettingsBridge';
import { DEFAULT_DAILY_SUMMARY_HOUR, DEFAULT_DAILY_SUMMARY_MINUTE, disableDailySummaryNotification, getDailySummaryTime, getLastRecoveryDateKey, isDailySummaryEnabledStored, NOTIFICATIONS_SUPPORTED_HERE, sendImmediateSummaryNotification, setDailySummaryEnabledStored, setDailySummaryTime } from '@/lib/notificationServiceBridge';
import { clearNotificationLog, getNotificationLog, subscribeNotificationLog, type NotificationLogEntry } from '@/lib/notificationLog';
import { useFlowStore } from '@/lib/store';

function timeLabel(hour: number, minute: number) { return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`; }
function deviceTimeZone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'fuso orario locale'; } catch { return 'fuso orario locale'; } }
function logLine(entry: NotificationLogEntry) { const time = new Date(entry.at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); return `${time} [${entry.level}] ${entry.event}${entry.details ? ` — ${entry.details}` : ''}`; }

export default function NotificationsSettings() {
  const [enabled, setEnabled] = useState(true); const [busy, setBusy] = useState(false); const [lastRecovery, setLastRecovery] = useState<string | null>(null); const [showLogs, setShowLogs] = useState(false); const [logs, setLogs] = useState<NotificationLogEntry[]>([]); const [summaryTime, setSummaryTime] = useState(`${String(DEFAULT_DAILY_SUMMARY_HOUR).padStart(2,'0')}:${String(DEFAULT_DAILY_SUMMARY_MINUTE).padStart(2,'0')}`); const [timeSaving, setTimeSaving] = useState(false);
  const commitments = useFlowStore((state) => state.commitments); const reminderPlan = buildReminderPlan(commitments, new Date()); const upcomingReminders = buildCustomReminders(commitments, new Date()); const timeZone = useMemo(() => deviceTimeZone(), []);
  useEffect(() => { void isDailySummaryEnabledStored().then(setEnabled); void getDailySummaryTime().then(({ hour, minute }) => { setSummaryTime(timeLabel(hour, minute)); }); void getLastRecoveryDateKey().then(setLastRecovery); const unsubscribe = subscribeNotificationLog(setLogs); void getNotificationLog().then(setLogs); return unsubscribe; }, []);
  async function toggle(value: boolean) {
    if (busy) return;
    setBusy(true);
    const previous = enabled;
    setEnabled(value);
    try {
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
      setEnabled(previous);
      await setDailySummaryEnabledStored(previous);
      const message = error instanceof Error ? error.message : 'Operazione non riuscita.';
      showAlert('Notifiche', message);
    } finally { setBusy(false); }
  }
  async function saveSummaryTime() { const match=summaryTime.trim().match(/^(\d{1,2}):(\d{2})$/); const hour=match?Number(match[1]):-1; const minute=match?Number(match[2]):-1; if(hour<0||hour>23||minute<0||minute>59){showAlert('Riepilogo giornaliero','Inserisci un orario valido nel formato HH:MM.');return;} setSummaryTime(timeLabel(hour,minute)); setTimeSaving(true); try { await setDailySummaryTime(hour,minute); if (enabled) await runDailySummaryRefresh(); showAlert('Riepilogo giornaliero', `Orario impostato alle ${timeLabel(hour,minute)} (${timeZone}).`); } catch (error) { showAlert('Riepilogo giornaliero', error instanceof Error ? error.message : 'Salvataggio non riuscito.'); } finally { setTimeSaving(false); } }
  async function sendNowNotifications() { if (!NOTIFICATIONS_SUPPORTED_HERE) { showAlert('Notifiche', "Le notifiche non sono supportate nel browser web. Prova dall'app installata su telefono."); return; } setBusy(true); try { const summary: DailySummary = buildDailySummary(commitments, new Date()); const identifier = await sendImmediateSummaryNotification(summary, false); if (identifier) showAlert('Notifiche', 'Notifica inviata.'); else showAlert('Notifiche', 'Invio non riuscito: permesso notifiche non concesso. Controlla le impostazioni del telefono.'); } catch (error) { showAlert('Notifiche', error instanceof Error ? error.message : 'Invio non riuscito.'); } finally { setBusy(false); } }
  function clearLogs() { void clearNotificationLog(); showAlert('Notifiche', 'Log ripulito.'); }
  async function copyLogs() { const text = logs.map(logLine).join('\n'); if (!text) return showAlert('Notifiche', 'Non ci sono log da copiare.'); try { if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('Clipboard non disponibile'); await navigator.clipboard.writeText(text); showAlert('Notifiche', 'Log copiato negli appunti.'); } catch { showAlert('Notifiche', 'Non è stato possibile copiare automaticamente il log.'); } }
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.wrap}><Text style={styles.title}>Notifiche</Text>
    <Card><Text style={styles.label}>Riepilogo giornaliero</Text><View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.item}>Ricevi il riepilogo giornaliero</Text><Text style={styles.meta}>FlowOS sincronizza Google Calendar e Google Tasks prima di inviarlo. Se il telefono era spento o offline all'orario scelto, il riepilogo viene recuperato quando riapri l'app.</Text></View><Switch value={enabled} disabled={busy} onValueChange={(value) => { void toggle(value); }} /></View>
      <View style={styles.timeBox}><View style={styles.timeHeader}><View style={{ flex: 1 }}><Text style={styles.timeTitle}>Orario di invio</Text><Text style={styles.meta}>Fuso orario del dispositivo: {timeZone}</Text></View></View><TextInput value={summaryTime} onChangeText={v=>setSummaryTime(v.replace(/[^0-9:]/g,'' ).slice(0,5))} keyboardType="numbers-and-punctuation" maxLength={5} placeholder="HH:MM" style={styles.timeInput}/><Button label={timeSaving ? 'Salvataggio…' : 'Salva orario'} onPress={() => { void saveSummaryTime(); }} disabled={busy || timeSaving}/></View>{lastRecovery ? <Text style={styles.meta}>Ultimo recupero automatico: {lastRecovery}</Text> : null}<View style={styles.actions}><Button secondary label="Invia le notifiche adesso" onPress={() => { void sendNowNotifications(); }} disabled={busy || !enabled}/></View><Text style={styles.note}>L'orario scelto è un'ora locale, non UTC: se cambi fuso orario, il trigger segue l'ora locale del dispositivo.</Text></Card>
    <Card><Text style={styles.label}>Logger notifiche</Text><Text style={styles.meta}>Registra ogni pianificazione, invio e sincronizzazione legata alle notifiche, su tutte le piattaforme.</Text><View style={styles.logActions}><Button secondary label={showLogs ? 'Nascondi log' : 'Mostra log'} onPress={() => setShowLogs((value) => !value)} style={styles.logButton}/><Button secondary label="Copia log" onPress={() => { void copyLogs(); }} style={styles.logButton}/><Button secondary label="Pulisci log" onPress={clearLogs} style={styles.logButton}/></View>{showLogs ? <ScrollView style={styles.logBox} nestedScrollEnabled showsVerticalScrollIndicator persistentScrollbar contentContainerStyle={styles.logContent}>{logs.length ? logs.map((entry, index) => <Text key={`${entry.at}-${index}`} selectable style={[styles.logLine, entry.level === 'error' && styles.logError]}>{logLine(entry)}</Text>) : <Text style={styles.meta}>Nessun evento registrato.</Text>}</ScrollView> : null}</Card>
    <Button secondary label="Indietro" onPress={() => router.back()}/>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe:{flex:1,backgroundColor:palette.bg}, wrap:{padding:20,paddingBottom:60,gap:16}, title:{fontSize:31,fontWeight:'900',color:palette.ink,marginTop:14}, label:{fontSize:13,fontWeight:'800',color:palette.primary,textTransform:'uppercase'}, row:{flexDirection:'row',alignItems:'center',gap:12,marginTop:14}, item:{fontSize:16,fontWeight:'800',color:palette.ink}, meta:{fontSize:13,lineHeight:18,color:palette.muted,marginTop:6}, note:{fontSize:12,lineHeight:17,color:palette.muted,marginTop:14,fontStyle:'italic'}, actions:{flexDirection:'row',gap:10,marginTop:14,flexWrap:'wrap'}, timeBox:{marginTop:16,padding:14,borderRadius:16,backgroundColor:'#F7F5FF',gap:12}, timeHeader:{flexDirection:'row',alignItems:'center',gap:12}, timeTitle:{fontSize:14,fontWeight:'900',color:palette.ink}, timeValue:{fontSize:26,fontWeight:'900',color:palette.primary},timeInput:{backgroundColor:'#FFF',borderWidth:1,borderColor:palette.border,borderRadius:12,padding:12,color:palette.ink,fontSize:20,fontWeight:'800',textAlign:'center'}, logActions:{flexDirection:'row',gap:8,flexWrap:'nowrap'}, logButton:{flex:1,minWidth:0,paddingHorizontal:4}, logBox:{marginTop:14,height:360,maxHeight:360,borderRadius:14,backgroundColor:'#111827'}, logContent:{padding:12,paddingBottom:36,gap:6}, logLine:{fontSize:10,lineHeight:14,color:'#D1D5DB',fontFamily:'monospace'}, logError:{color:'#FCA5A5'} });