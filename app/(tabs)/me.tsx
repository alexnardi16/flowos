import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, palette } from '@/components/ui';
import { clearDiagnostics, readDiagnostics, recordDiagnostic, type DiagnosticEntry } from '@/lib/diagnostics';
import {
  disconnectGoogleWorkspace,
  getGoogleWorkspaceStatus,
  recoverStaleGoogleSyncState,
  setCalendarSelected,
  setDefaultCalendar,
  setDefaultTaskList,
  setTaskListSelected,
  signInWithGoogle,
  syncGoogleWorkspace,
  type GoogleWorkspaceStatus,
} from '@/lib/googleWorkspace';
import { useFlowStore } from '@/lib/store';
import { useAuth } from '@/providers/AuthProvider';

function formatSyncDate(value?: string | null) {
  if (!value) return 'mai';
  return new Date(value).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function progressStage(progress: number) {
  if (progress < 15) return 'Preparazione della connessione';
  if (progress < 35) return 'Invio delle modifiche a Google';
  if (progress < 72) return 'Importazione degli eventi Calendar';
  if (progress < 92) return 'Importazione delle attività Google Tasks';
  if (progress < 100) return 'Aggiornamento di FlowOS';
  return 'Sincronizzazione completata';
}

function logLine(entry: DiagnosticEntry) {
  const time = new Date(entry.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${time} [${entry.level}] ${entry.event}${entry.details ? ` — ${entry.details}` : ''}`;
}

export default function Me() {
  const [assisted, setAssisted] = useState(true);
  const [google, setGoogle] = useState<GoogleWorkspaceStatus | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<DiagnosticEntry[]>([]);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const commitments = useFlowStore((state) => state.commitments);
  const hydrateFromCloud = useFlowStore((state) => state.hydrateFromCloud);
  const { signOut } = useAuth();

  const insights = useMemo(() => {
    const done = commitments.filter((item) => item.status === 'done');
    const active = commitments.filter((item) => item.status !== 'done');
    const planned = active.filter((item) => item.scheduledAt);
    const totalMinutes = done.reduce((sum, item) => sum + item.durationMinutes, 0);
    const averageConfidence = commitments.length ? Math.round(commitments.reduce((sum, item) => sum + item.confidence, 0) / commitments.length * 100) : 0;
    const completionRate = commitments.length ? Math.round(done.length / commitments.length * 100) : 0;
    return { done: done.length, active: active.length, planned: planned.length, totalMinutes, averageConfidence, completionRate };
  }, [commitments]);

  function refreshLogs() {
    setLogs(readDiagnostics().slice(-20).reverse());
  }

  async function copyLogs() {
    const text = readDiagnostics().map(logLine).join('\n');
    if (!text) {
      Alert.alert('Logger', 'Non ci sono log da copiare.');
      return;
    }
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('Clipboard non disponibile');
      await navigator.clipboard.writeText(text);
      recordDiagnostic('logs-copied', { entries: readDiagnostics().length });
      refreshLogs();
      Alert.alert('Logger', 'Log copiato negli appunti.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Copia del log non riuscita.';
      recordDiagnostic('logs-copy-failed', { message }, 'error');
      Alert.alert('Logger', 'Non è stato possibile copiare automaticamente il log.');
    }
  }

  async function loadGoogle(repairStale = true) {
    try {
      const status = await getGoogleWorkspaceStatus();
      if (repairStale && !googleBusy && status.connection?.last_sync_status === 'syncing') {
        await recoverStaleGoogleSyncState();
        const repaired = await getGoogleWorkspaceStatus();
        setGoogle(repaired);
        setGoogleError(repaired.connection?.last_sync_status === 'error' ? repaired.connection.last_sync_error ?? 'La sincronizzazione Google non è riuscita.' : null);
      } else {
        setGoogle(status);
        setGoogleError(status.connection?.last_sync_status === 'error' ? status.connection.last_sync_error ?? 'La sincronizzazione Google non è riuscita.' : null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossibile leggere lo stato Google.';
      recordDiagnostic('google-status-load-failed', { message }, 'error');
      setGoogleError(message);
    } finally {
      refreshLogs();
    }
  }

  useEffect(() => {
    void loadGoogle(true);
    refreshLogs();
    return () => { if (progressTimer.current) clearInterval(progressTimer.current); };
  }, []);

  async function run(action: () => Promise<unknown>, refreshCommitments = false) {
    if (googleBusy) return;
    setGoogleBusy(true);
    setGoogleError(null);
    try {
      await action();
      if (refreshCommitments) await hydrateFromCloud();
      await loadGoogle(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Operazione Google non riuscita.';
      setGoogleError(message);
      recordDiagnostic('google-operation-failed', { message }, 'error');
      Alert.alert('Google Workspace', message);
      await loadGoogle(false);
    } finally {
      setGoogleBusy(false);
      refreshLogs();
    }
  }

  async function runSync() {
    if (googleBusy) return;
    setGoogleBusy(true);
    setGoogleError(null);
    setSyncProgress(4);
    recordDiagnostic('sync-ui-started');
    progressTimer.current = setInterval(() => {
      setSyncProgress((current) => {
        if (current >= 92) return current;
        const increment = current < 30 ? 4 : current < 70 ? 2 : 1;
        return Math.min(92, current + increment);
      });
    }, 700);

    try {
      await syncGoogleWorkspace();
      setSyncProgress(95);
      await hydrateFromCloud();
      setSyncProgress(98);
      await loadGoogle(false);
      setSyncProgress(100);
      recordDiagnostic('sync-ui-completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sincronizzazione non riuscita.';
      setGoogleError(message);
      recordDiagnostic('sync-ui-failed', { message }, 'error');
      Alert.alert('Sincronizzazione Google', message);
      await loadGoogle(false);
    } finally {
      if (progressTimer.current) clearInterval(progressTimer.current);
      progressTimer.current = null;
      setGoogleBusy(false);
      refreshLogs();
      setTimeout(() => setSyncProgress(0), 1200);
    }
  }

  async function logout() {
    if (googleBusy) return;
    recordDiagnostic('flowos-logout-started');
    try {
      await signOut();
      router.replace('/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout non riuscito.';
      recordDiagnostic('flowos-logout-failed', { message }, 'error');
      Alert.alert('FlowOS', message);
    }
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Io</Text>

      <Card>
        <Text style={styles.label}>Google Workspace</Text>
        {google?.connection && google.connection.last_sync_status !== 'disconnected' ? <>
          <Text style={styles.item}>{google.connection.google_email ?? 'Account Google collegato'}</Text>
          <Text style={styles.meta}>Stato: {google.connection.last_sync_status} · Ultima sincronizzazione: {formatSyncDate(google.connection.last_sync_at)}</Text>
          {google.connection.last_sync_error ? <Text style={styles.error}>{google.connection.last_sync_error}</Text> : null}
          {googleError && googleError !== google.connection.last_sync_error ? <Text style={styles.error}>{googleError}</Text> : null}
          {syncProgress > 0 ? <View style={styles.progressBlock}>
            <View style={styles.progressHeader}><Text style={styles.progressStage}>{progressStage(syncProgress)}</Text><Text style={styles.progressPercent}>{syncProgress}%</Text></View>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${syncProgress}%` }]} /></View>
          </View> : null}
          <View style={styles.actions}><Button label={googleBusy ? 'Sincronizzazione…' : 'Sincronizza ora'} onPress={() => { void runSync(); }}/><Button secondary label="Scollega Google" onPress={() => { void run(disconnectGoogleWorkspace); }}/></View>
        </> : <>
          <Text style={styles.meta}>Collega Google per sincronizzare Calendar e Tasks in entrambe le direzioni.</Text>
          {googleError ? <Text style={styles.error}>{googleError}</Text> : null}
          <View style={styles.actions}><Button label="Collega Google" onPress={() => { void run(signInWithGoogle); }}/></View>
        </>}
      </Card>

      {google?.connection && google.connection.last_sync_status !== 'disconnected' ? <>
        <Card>
          <Text style={styles.label}>Calendari sincronizzati</Text>
          <Text style={styles.meta}>Puoi includere più calendari, anche condivisi. Solo i calendari con permesso di scrittura possono essere usati per creare o modificare eventi.</Text>
          {google.calendars.map((calendar) => {
            const writable = ['owner', 'writer'].includes(calendar.access_role);
            const holidayCalendar = /^Jours fériés en (France|Italie)$/i.test(calendar.summary.trim());
            return <View key={calendar.id} style={styles.resourceRow}>
              <View style={styles.resourceText}>
                <Text style={styles.resourceTitle}>{calendar.summary}{calendar.primary_calendar ? ' · principale' : ''}</Text>
                <Text style={styles.meta}>{calendar.access_role}{calendar.is_default ? ' · predefinito' : ''}</Text>
              </View>
              <Switch value={calendar.selected} onValueChange={(selected) => { void run(() => setCalendarSelected(calendar.id, selected)); }}/>
              {!holidayCalendar ? <Pressable disabled={!calendar.selected || !writable || calendar.is_default} onPress={() => { void run(() => setDefaultCalendar(calendar.id)); }} style={[styles.defaultButton, (!calendar.selected || !writable || calendar.is_default) && styles.disabled]}><Text style={styles.defaultText}>{calendar.is_default ? 'Default' : 'Imposta come default'}</Text></Pressable> : null}
            </View>;
          })}
        </Card>

        <Card>
          <Text style={styles.label}>Liste Google Tasks</Text>
          <Text style={styles.meta}>La lista predefinita viene proposta automaticamente, ma puoi cambiarla per ogni nuova attività.</Text>
          {google.taskLists.map((list) => <View key={list.id} style={styles.resourceRow}>
            <View style={styles.resourceText}><Text style={styles.resourceTitle}>{list.title}</Text><Text style={styles.meta}>{list.is_default ? 'Predefinita' : 'Lista attività'}</Text></View>
            <Switch value={list.selected} onValueChange={(selected) => { void run(() => setTaskListSelected(list.id, selected)); }}/>
            <Pressable disabled={!list.selected || list.is_default} onPress={() => { void run(() => setDefaultTaskList(list.id)); }} style={[styles.defaultButton, (!list.selected || list.is_default) && styles.disabled]}><Text style={styles.defaultText}>{list.is_default ? 'Default' : 'Imposta come default'}</Text></Pressable>
          </View>)}
        </Card>
      </> : null}

      <Card>
        <Text style={styles.label}>Modalità di controllo</Text>
        <View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.item}>Controllo assistito</Text><Text style={styles.meta}>L’IA propone. Tu approvi le modifiche importanti.</Text></View><Switch value={assisted} onValueChange={setAssisted} /></View>
      </Card>

      <View style={styles.metrics}><Card style={styles.metricCard}><Text style={styles.metric}>{insights.completionRate}%</Text><Text style={styles.metricLabel}>Completamento</Text></Card><Card style={styles.metricCard}><Text style={styles.metric}>{insights.planned}</Text><Text style={styles.metricLabel}>Pianificati</Text></Card></View>
      <View style={styles.metrics}><Card style={styles.metricCard}><Text style={styles.metric}>{insights.done}</Text><Text style={styles.metricLabel}>Completati</Text></Card><Card style={styles.metricCard}><Text style={styles.metric}>{insights.totalMinutes}</Text><Text style={styles.metricLabel}>Minuti conclusi</Text></Card></View>
      <Card><Text style={styles.label}>Il sistema sta imparando</Text><Text style={styles.score}>{insights.averageConfidence}%</Text><Text style={styles.meta}>Affidabilità media delle stime di durata, energia e classificazione.</Text></Card>
      <Card><Text style={styles.label}>Carico attuale</Text><Text style={styles.item}>{insights.active} Commitment aperti</Text><Text style={styles.meta}>FlowOS usa questo dato per evitare giornate sovraccariche e distribuire il lavoro nei prossimi giorni.</Text></Card>

      <Card>
        <Text style={styles.label}>Logger</Text>
        <Text style={styles.meta}>Registra login, richieste di sincronizzazione, risposte server, retry ed errori tecnici sul dispositivo.</Text>
        <View style={styles.actions}>
          <Button secondary label={showLogs ? 'Nascondi log' : 'Mostra log'} onPress={() => { refreshLogs(); setShowLogs((value) => !value); }}/>
          <Button secondary label="Copia log" onPress={() => { void copyLogs(); }}/>
          <Button secondary label="Cancella log" onPress={() => { clearDiagnostics(); refreshLogs(); }}/>
        </View>
        {showLogs ? <View style={styles.logBox}>{logs.length ? logs.map((entry, index) => <Text key={`${entry.at}-${index}`} selectable style={[styles.logLine, entry.level === 'error' && styles.logError]}>{logLine(entry)}</Text>) : <Text style={styles.meta}>Nessun evento registrato.</Text>}</View> : null}
      </Card>

      <Card>
        <Text style={styles.label}>Account FlowOS</Text>
        <Text style={styles.meta}>Il logout termina la sessione FlowOS. Non è la stessa cosa di “Scollega Google”.</Text>
        <View style={styles.actions}><Pressable onPress={() => { void logout(); }} style={styles.logoutButton}><Text style={styles.logoutText}>Esci da FlowOS</Text></Pressable></View>
      </Card>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:20,paddingBottom:110,gap:16},title:{fontSize:31,fontWeight:'900',color:palette.ink,marginTop:14},label:{fontSize:13,fontWeight:'800',color:palette.primary,textTransform:'uppercase'},row:{flexDirection:'row',alignItems:'center',gap:12,marginTop:14},item:{fontSize:18,fontWeight:'800',color:palette.ink,marginTop:8},meta:{fontSize:13,lineHeight:18,color:palette.muted,marginTop:4},error:{fontSize:13,lineHeight:18,color:'#A12626',marginTop:8,fontWeight:'700'},score:{fontSize:42,fontWeight:'900',color:palette.ink,marginTop:10},metrics:{flexDirection:'row',gap:12},metricCard:{flex:1},metric:{fontSize:30,fontWeight:'900',color:palette.ink},metricLabel:{fontSize:12,color:palette.muted,marginTop:4},actions:{flexDirection:'row',gap:10,marginTop:16,flexWrap:'wrap'},resourceRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#ECEEF4'},resourceText:{flex:1},resourceTitle:{fontSize:15,fontWeight:'800',color:palette.ink},defaultButton:{maxWidth:124,backgroundColor:palette.soft,borderRadius:12,paddingHorizontal:10,paddingVertical:8},defaultText:{fontSize:11,fontWeight:'800',textAlign:'center',color:palette.primary},disabled:{opacity:.45},progressBlock:{marginTop:16},progressHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10},progressStage:{fontSize:13,fontWeight:'700',color:palette.ink,flex:1},progressPercent:{fontSize:14,fontWeight:'900',color:palette.primary},progressTrack:{height:10,borderRadius:99,backgroundColor:'#E4E2EC',overflow:'hidden',marginTop:8},progressFill:{height:'100%',borderRadius:99,backgroundColor:palette.primary},logoutButton:{borderRadius:16,paddingVertical:13,paddingHorizontal:16,backgroundColor:'#FDECEC'},logoutText:{color:'#A12626',fontWeight:'800',fontSize:15},logBox:{marginTop:14,padding:12,borderRadius:14,backgroundColor:'#111827',gap:6},logLine:{fontSize:10,lineHeight:14,color:'#D1D5DB',fontFamily:'monospace'},logError:{color:'#FCA5A5'}
});
