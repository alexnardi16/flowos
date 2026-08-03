import { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, palette, showAlert, showConfirm } from '@/components/ui';
import { clearDiagnostics, readDiagnostics, recordDiagnostic, subscribeDiagnostics, type DiagnosticEntry } from '@/lib/diagnostics';
import { deleteAllFlowOSOnlyData } from '@/lib/commitmentsRepository';
import {
  connectGoogleFromSession,
  disconnectGoogleWorkspace,
  getGoogleWorkspaceStatus,
  isSyncGenuinelyStale,
  recoverStaleGoogleSyncState,
  setCalendarSelected,
  setDefaultCalendar,
  setDefaultTaskList,
  friendlyCalendarName,
  setSyncRange,
  setTaskListSelected,
  signInWithGoogle,
  subscribeToSyncProgress,
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

function logLine(entry: DiagnosticEntry) {
  const time = new Date(entry.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${time} [${entry.level}] ${entry.event}${entry.details ? ` — ${entry.details}` : ''}`;
}

function isMissingGoogleAuthorization(status: GoogleWorkspaceStatus | null, error: string | null) {
  const message = `${status?.connection?.last_sync_error ?? ''} ${error ?? ''}`;
  return /google account is not connected|account google non.*collegato/i.test(message);
}

export default function Me() {
  const [google, setGoogle] = useState<GoogleWorkspaceStatus | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStage, setSyncStage] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<DiagnosticEntry[]>([]);
  const commitments = useFlowStore((state) => state.commitments);
  const hydrateFromCloud = useFlowStore((state) => state.hydrateFromCloud);
  const { session, signOut } = useAuth();

  const insights = useMemo(() => {
    const done = commitments.filter((item) => item.status === 'done');
    const active = commitments.filter((item) => item.status !== 'done');
    const planned = active.filter((item) => item.scheduledAt);
    const totalMinutes = done.reduce((sum, item) => sum + item.durationMinutes, 0);
    const averageConfidence = commitments.length ? Math.round(commitments.reduce((sum, item) => sum + item.confidence, 0) / commitments.length * 100) : 0;
    const completionRate = commitments.length ? Math.round(done.length / commitments.length * 100) : 0;
    return { done: done.length, active: active.length, planned: planned.length, totalMinutes, averageConfidence, completionRate };
  }, [commitments]);

  async function copyLogs() {
    const text = readDiagnostics().map(logLine).join('\n');
    if (!text) return showAlert('Logger', 'Non ci sono log da copiare.');
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('Clipboard non disponibile');
      await navigator.clipboard.writeText(text);
      recordDiagnostic('logs-copied', { entries: readDiagnostics().length });
      showAlert('Logger', 'Log copiato negli appunti.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Copia del log non riuscita.';
      recordDiagnostic('logs-copy-failed', { message }, 'error');
      showAlert('Logger', 'Non è stato possibile copiare automaticamente il log.');
    }
  }

  function clearLogs() {
    clearDiagnostics();
    showAlert('Logger', 'Log ripulito.');
  }

  async function loadGoogle(repairStale = true) {
    try {
      const status = await getGoogleWorkspaceStatus();
      if (repairStale && !googleBusy && isSyncGenuinelyStale(status.connection)) {
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
    }
  }

  useEffect(() => {
    void loadGoogle(true);
    const unsubscribe = subscribeDiagnostics((entries) => setLogs([...entries].reverse()));
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToSyncProgress(({ percent, stage }) => {
      setSyncProgress(percent);
      setSyncStage(stage);
      if (percent >= 100) {
        setTimeout(() => { setSyncProgress(0); void loadGoogle(false); }, 900);
      }
    });
    return unsubscribe;
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
      showAlert('Google Workspace', message);
      await loadGoogle(false);
    } finally {
      setGoogleBusy(false);
    }
  }

  async function runSync() {
    if (googleBusy) return;
    setGoogleBusy(true);
    setGoogleError(null);
    setSyncProgress(1);
    setSyncStage('Avvio della sincronizzazione');
    recordDiagnostic('sync-ui-started');
    try {
      if (session?.provider_token) {
        await connectGoogleFromSession(session, true);
        recordDiagnostic('google-workspace-connection-refreshed-manually', { userId: session.user.id });
      }
      await syncGoogleWorkspace(({ percent, stage }) => {
        setSyncProgress(percent);
        setSyncStage(stage);
      });
      await hydrateFromCloud();
      await loadGoogle(false);
      recordDiagnostic('sync-ui-completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sincronizzazione non riuscita.';
      setGoogleError(message);
      setSyncStage('Sincronizzazione interrotta');
      recordDiagnostic('sync-ui-failed', { message }, 'error');
      showAlert('Sincronizzazione Google', message);
      await loadGoogle(false);
    } finally {
      setGoogleBusy(false);
      setTimeout(() => { setSyncProgress(0); setSyncStage(''); }, 1800);
    }
  }

  async function logout() {
    if (googleBusy) return;
    try {
      await signOut();
      router.replace('/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout non riuscito.';
      recordDiagnostic('flowos-logout-failed', { message }, 'error');
      showAlert('FlowOS', message);
    }
  }

  async function wipeFlowOSData() {
    const ok = await showConfirm('Eliminare ogni attività su FlowOS?', 'Tutti gli elementi verranno rimossi da FlowOS. Google Calendar e Google Tasks non vengono toccati, né ora né alla prossima sincronizzazione: gli elementi provenienti da Google verranno semplicemente reimportati.', 'Elimina tutto');
    if (!ok) return;
    setGoogleBusy(true);
    try {
      await deleteAllFlowOSOnlyData();
      await hydrateFromCloud();
      recordDiagnostic('flowos-data-wiped');
      showAlert('FlowOS', 'Tutti gli elementi FlowOS sono stati eliminati.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Eliminazione non riuscita.';
      recordDiagnostic('flowos-data-wipe-failed', { message }, 'error');
      showAlert('FlowOS', message);
    } finally {
      setGoogleBusy(false);
    }
  }

  const [rangeStartInput,setRangeStartInput]=useState('');
  const [rangeEndInput,setRangeEndInput]=useState('');
  const [rangeSaving,setRangeSaving]=useState(false);
  useEffect(()=>{
    if(!google?.range)return;
    const toDisplay=(label:string)=>{const [d,m,y]=label.split('/');return d&&m&&y?`${d}-${m}-${y}`:'';};
    setRangeStartInput(toDisplay(google.range.labelStart));
    setRangeEndInput(toDisplay(google.range.labelEnd));
  },[google?.range?.labelStart,google?.range?.labelEnd]);
  async function saveRange(){
    const toIso=(display:string)=>{const [d,m,y]=display.split('-');return d&&m&&y?`${y}-${m}-${d}`:null;};
    const startIso=toIso(rangeStartInput), endIso=toIso(rangeEndInput);
    if(!startIso||!endIso||!/^\d{4}-\d{2}-\d{2}$/.test(startIso)||!/^\d{4}-\d{2}-\d{2}$/.test(endIso)){
      showAlert('Google Workspace','Usa il formato GG-MM-AAAA per entrambe le date.');return;
    }
    setRangeSaving(true);
    try{
      await setSyncRange(startIso,endIso);
      await loadGoogle(false);
      showAlert('Google Workspace','Periodo aggiornato. Sincronizza ora per applicarlo.');
    }catch(error){
      showAlert('Google Workspace',error instanceof Error?error.message:'Aggiornamento non riuscito.');
    }finally{
      setRangeSaving(false);
    }
  }
  const rangeLabel = google?.range
    ? `Elementi importati visibili dal ${google.range.labelStart} al ${google.range.labelEnd}.`
    : 'Intervallo di importazione in caricamento…';
  const authorizationMissing = isMissingGoogleAuthorization(google, googleError);
  const googleConnected = Boolean(google?.connection && google.connection.last_sync_status !== 'disconnected' && !authorizationMissing);

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.eyebrow}>FlowOS</Text>
      <Text style={styles.title}>Impostazioni</Text>

      <Card>
        <Text style={styles.label}>Google Workspace</Text>
        <Text style={styles.rangeLabel}>{rangeLabel}</Text>
        <View style={styles.inline}>
          <View style={styles.flex}><Text style={styles.fieldLabel}>Dal</Text><TextInput value={rangeStartInput} onChangeText={setRangeStartInput} placeholder="GG-MM-AAAA" style={styles.rangeInput}/></View>
          <View style={styles.flex}><Text style={styles.fieldLabel}>Al</Text><TextInput value={rangeEndInput} onChangeText={setRangeEndInput} placeholder="GG-MM-AAAA" style={styles.rangeInput}/></View>
        </View>
        <View style={styles.actions}><Button secondary label={rangeSaving?'Salvataggio…':'Salva periodo'} onPress={()=>{void saveRange();}} disabled={rangeSaving}/></View>
        {googleConnected ? <>
          <Text style={styles.item}>{google?.connection?.google_email ? friendlyCalendarName(google.connection.google_email, google.connection.google_email) : 'Account Google collegato'}</Text>
          <Text style={styles.meta}>Stato: {google?.connection?.last_sync_status} · Ultima sincronizzazione: {formatSyncDate(google?.connection?.last_sync_at)}</Text>
          {google?.connection?.last_sync_error ? <Text style={styles.error}>{google.connection.last_sync_error}</Text> : null}
          {googleError && googleError !== google?.connection?.last_sync_error ? <Text style={styles.error}>{googleError}</Text> : null}
          {syncProgress > 0 ? <View style={styles.progressBlock}>
            <View style={styles.progressHeader}><Text style={styles.progressStage}>{syncStage}</Text><Text style={styles.progressPercent}>{syncProgress}%</Text></View>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${syncProgress}%` }]} /></View>
          </View> : null}
          <View style={styles.actions}><Button label={googleBusy ? 'Sincronizzazione…' : 'Sincronizza ora'} onPress={() => { void runSync(); }}/><Button secondary label="Scollega Google" onPress={() => { void run(disconnectGoogleWorkspace); }}/></View>
          <View style={styles.wipeRow}><Pressable onPress={() => { void wipeFlowOSData(); }} style={styles.wipeButton}><Text style={styles.logoutText}>Elimina ogni attività su FlowOS senza alcun impatto su Google</Text></Pressable></View>
        </> : <>
          <Text style={styles.meta}>{authorizationMissing ? 'La sessione FlowOS è attiva, ma l’autorizzazione Google deve essere ripristinata.' : 'Collega Google per sincronizzare Calendar e Tasks in entrambe le direzioni.'}</Text>
          {googleError ? <Text style={styles.error}>{googleError}</Text> : null}
          <View style={styles.actions}><Button label={authorizationMissing ? 'Ricollega Google' : 'Collega Google'} onPress={() => { void run(signInWithGoogle); }}/></View>
        </>}
      </Card>

      {googleConnected ? <>
        <Card>
          <Text style={styles.label}>Calendari sincronizzati</Text>
          <Text style={styles.meta}>Puoi includere più calendari, anche condivisi. Solo quelli con permesso di scrittura possono essere usati per creare o modificare eventi.</Text>
          {google?.calendars.map((calendar) => {
            const writable = ['owner', 'writer'].includes(calendar.access_role);
            const holidayCalendar = /^Jours fériés en (France|Italie)$/i.test(calendar.summary.trim());
            return <View key={calendar.id} style={styles.resourceRow}>
              <View style={styles.resourceText}><Text style={styles.resourceTitle}>{friendlyCalendarName(calendar.summary, google?.connection?.google_email)}{calendar.primary_calendar && friendlyCalendarName(calendar.summary, google?.connection?.google_email)!=='Alex' ? ' · principale' : ''}</Text><Text style={styles.meta}>{calendar.access_role}{calendar.is_default ? ' · predefinito' : ''}</Text></View>
              <Switch value={calendar.selected} onValueChange={(selected) => { void run(() => setCalendarSelected(calendar.id, selected)); }}/>
              {!holidayCalendar ? <Pressable disabled={!calendar.selected || !writable || calendar.is_default} onPress={() => { void run(() => setDefaultCalendar(calendar.id)); }} style={[styles.defaultButton, (!calendar.selected || !writable || calendar.is_default) && styles.disabled]}><Text style={styles.defaultText}>{calendar.is_default ? 'Default' : 'Imposta come default'}</Text></Pressable> : null}
            </View>;
          })}
        </Card>

        <Card>
          <Text style={styles.label}>Liste Google Tasks</Text>
          <Text style={styles.meta}>La lista predefinita viene proposta automaticamente, ma puoi cambiarla per ogni nuova attività.</Text>
          {google?.taskLists.map((list) => <View key={list.id} style={styles.resourceRow}>
            <View style={styles.resourceText}><Text style={styles.resourceTitle}>{list.title}</Text><Text style={styles.meta}>{list.is_default ? 'Predefinita' : 'Lista attività'}</Text></View>
            <Switch value={list.selected} onValueChange={(selected) => { void run(() => setTaskListSelected(list.id, selected)); }}/>
            <Pressable disabled={!list.selected || list.is_default} onPress={() => { void run(() => setDefaultTaskList(list.id)); }} style={[styles.defaultButton, (!list.selected || list.is_default) && styles.disabled]}><Text style={styles.defaultText}>{list.is_default ? 'Default' : 'Imposta come default'}</Text></Pressable>
          </View>)}
        </Card>
      </> : null}

      <Card><Text style={styles.label}>Notifiche</Text><Text style={styles.meta}>Riepilogo giornaliero, recupero automatico e log dedicato.</Text><View style={styles.actions}><Button secondary label="Apri impostazioni notifiche" onPress={() => router.push('/notifications-settings')} /></View></Card>
      <View style={styles.metrics}><Card style={styles.metricCard}><Text style={styles.metric}>{insights.completionRate}%</Text><Text style={styles.metricLabel}>Completamento</Text></Card><Card style={styles.metricCard}><Text style={styles.metric}>{insights.planned}</Text><Text style={styles.metricLabel}>Pianificati</Text></Card></View>
      <View style={styles.metrics}><Card style={styles.metricCard}><Text style={styles.metric}>{insights.done}</Text><Text style={styles.metricLabel}>Completati</Text></Card><Card style={styles.metricCard}><Text style={styles.metric}>{insights.totalMinutes}</Text><Text style={styles.metricLabel}>Minuti conclusi</Text></Card></View>
      <Card><Text style={styles.label}>Carico attuale</Text><Text style={styles.item}>{insights.active} Commitment aperti</Text><Text style={styles.meta}>FlowOS usa questo dato per evitare giornate sovraccariche e distribuire il lavoro nei prossimi giorni.</Text></Card>

      <Card>
        <Text style={styles.label}>Logger</Text>
        <Text style={styles.meta}>Mostra automaticamente tutto il log della sessione corrente e si aggiorna in tempo reale. Viene azzerato soltanto al login e al logout.</Text>
        <View style={styles.logActions}><Button secondary label={showLogs ? 'Nascondi log' : 'Mostra log'} onPress={() => setShowLogs((value) => !value)} style={{flex:1}}/><Button secondary label="Copia log" onPress={() => { void copyLogs(); }} style={{flex:1}}/><Button secondary label="Pulisci log" onPress={clearLogs} style={{flex:1}}/></View>
        {showLogs ? <View style={styles.logBox}>{logs.length ? logs.map((entry, index) => <Text key={`${entry.at}-${index}`} selectable style={[styles.logLine, entry.level === 'error' && styles.logError]}>{logLine(entry)}</Text>) : <Text style={styles.meta}>Nessun evento registrato.</Text>}</View> : null}
      </Card>

      <Card><Text style={styles.label}>Account FlowOS</Text><Text style={styles.meta}>Il logout termina la sessione FlowOS. Non è la stessa cosa di “Scollega Google”.</Text><View style={styles.actions}><Pressable onPress={() => { void logout(); }} style={styles.logoutButton}><Text style={styles.logoutText}>Esci da FlowOS</Text></Pressable></View></Card>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:20,paddingBottom:110,gap:16},eyebrow:{fontSize:14,color:palette.primary,fontWeight:'900',letterSpacing:1.3,textTransform:'uppercase',marginTop:14},title:{fontSize:31,fontWeight:'900',color:palette.ink},label:{fontSize:13,fontWeight:'800',color:palette.primary,textTransform:'uppercase'},row:{flexDirection:'row',alignItems:'center',gap:12,marginTop:14},item:{fontSize:18,fontWeight:'800',color:palette.ink,marginTop:8},meta:{fontSize:13,lineHeight:18,color:palette.muted,marginTop:4},rangeLabel:{fontSize:13,lineHeight:18,color:palette.ink,marginTop:8,fontWeight:'800'},error:{fontSize:13,lineHeight:18,color:'#A12626',marginTop:8,fontWeight:'700'},score:{fontSize:42,fontWeight:'900',color:palette.ink,marginTop:10},metrics:{flexDirection:'row',gap:12},metricCard:{flex:1},metric:{fontSize:30,fontWeight:'900',color:palette.ink},metricLabel:{fontSize:12,color:palette.muted,marginTop:4},actions:{flexDirection:'row',gap:10,marginTop:16,flexWrap:'wrap'},logActions:{flexDirection:'row',gap:8,marginTop:16,flexWrap:'nowrap'},wipeRow:{marginTop:12,width:'100%'},wipeButton:{width:'100%',minHeight:58,paddingVertical:14,paddingHorizontal:16,borderRadius:16,backgroundColor:'#FDECEC',alignItems:'center',justifyContent:'center'},resourceRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#ECEEF4'},resourceText:{flex:1},resourceTitle:{fontSize:15,fontWeight:'800',color:palette.ink},defaultButton:{maxWidth:124,backgroundColor:palette.soft,borderRadius:12,paddingHorizontal:10,paddingVertical:8},defaultText:{fontSize:11,fontWeight:'800',textAlign:'center',color:palette.primary},disabled:{opacity:.45},progressBlock:{marginTop:16},progressHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10},progressStage:{fontSize:13,fontWeight:'700',color:palette.ink,flex:1},progressPercent:{fontSize:14,fontWeight:'900',color:palette.primary},progressTrack:{height:10,borderRadius:99,backgroundColor:'#E4E2EC',overflow:'hidden',marginTop:8},progressFill:{height:'100%',borderRadius:99,backgroundColor:palette.primary},logoutButton:{borderRadius:16,paddingVertical:13,paddingHorizontal:16,backgroundColor:'#FDECEC'},logoutText:{color:'#A12626',fontWeight:'800',fontSize:15},logBox:{marginTop:14,padding:12,borderRadius:14,backgroundColor:'#111827',gap:6},logLine:{fontSize:10,lineHeight:14,color:'#D1D5DB',fontFamily:'monospace'},logError:{color:'#FCA5A5'},inline:{flexDirection:'row',gap:10,marginTop:10},flex:{flex:1},fieldLabel:{fontSize:11,fontWeight:'800',color:palette.muted},rangeInput:{backgroundColor:'#FFF',borderWidth:1,borderColor:palette.border,borderRadius:10,padding:9,marginTop:4,color:palette.ink}
});
