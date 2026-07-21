import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card, palette } from '@/components/ui';
import {
  disconnectGoogleWorkspace,
  getGoogleWorkspaceStatus,
  setCalendarSelected,
  setDefaultCalendar,
  setDefaultTaskList,
  setTaskListSelected,
  signInWithGoogle,
  syncGoogleWorkspace,
  type GoogleWorkspaceStatus,
} from '@/lib/googleWorkspace';
import { useFlowStore } from '@/lib/store';

export default function Me() {
  const [assisted, setAssisted] = useState(true);
  const [google, setGoogle] = useState<GoogleWorkspaceStatus | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const commitments = useFlowStore((state) => state.commitments);
  const hydrateFromCloud = useFlowStore((state) => state.hydrateFromCloud);

  const insights = useMemo(() => {
    const done = commitments.filter((item) => item.status === 'done');
    const active = commitments.filter((item) => item.status !== 'done');
    const planned = active.filter((item) => item.scheduledAt);
    const totalMinutes = done.reduce((sum, item) => sum + item.durationMinutes, 0);
    const averageConfidence = commitments.length ? Math.round(commitments.reduce((sum, item) => sum + item.confidence, 0) / commitments.length * 100) : 0;
    const completionRate = commitments.length ? Math.round(done.length / commitments.length * 100) : 0;
    return { done: done.length, active: active.length, planned: planned.length, totalMinutes, averageConfidence, completionRate };
  }, [commitments]);

  async function loadGoogle() {
    try { setGoogleError(null); setGoogle(await getGoogleWorkspaceStatus()); }
    catch (error) { setGoogleError(error instanceof Error ? error.message : 'Impossibile leggere lo stato Google.'); }
  }

  useEffect(() => { void loadGoogle(); }, []);

  async function run(action: () => Promise<unknown>, refreshCommitments = false) {
    if (googleBusy) return;
    setGoogleBusy(true); setGoogleError(null);
    try { await action(); if (refreshCommitments) await hydrateFromCloud(); await loadGoogle(); }
    catch (error) { const message = error instanceof Error ? error.message : 'Operazione Google non riuscita.'; setGoogleError(message); Alert.alert('Google Workspace', message); }
    finally { setGoogleBusy(false); }
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Io</Text>

      <Card>
        <Text style={styles.label}>Google Workspace</Text>
        {google?.connection && google.connection.last_sync_status !== 'disconnected' ? <>
          <Text style={styles.item}>{google.connection.google_email ?? 'Account Google collegato'}</Text>
          <Text style={styles.meta}>Stato: {google.connection.last_sync_status} · Ultima sincronizzazione: {google.connection.last_sync_at ? new Date(google.connection.last_sync_at).toLocaleString() : 'mai'}</Text>
          {google.connection.last_sync_error ? <Text style={styles.error}>{google.connection.last_sync_error}</Text> : null}
          <View style={styles.actions}><Button label={googleBusy ? 'Sincronizzazione…' : 'Sincronizza ora'} onPress={() => { void run(syncGoogleWorkspace, true); }}/><Button secondary label="Scollega" onPress={() => { void run(disconnectGoogleWorkspace); }}/></View>
        </> : <>
          <Text style={styles.meta}>Collega Google per sincronizzare Calendar e Tasks in entrambe le direzioni.</Text>
          <View style={styles.actions}><Button label="Collega Google" onPress={() => { void run(signInWithGoogle); }}/></View>
        </>}
        {googleError ? <Text style={styles.error}>{googleError}</Text> : null}
      </Card>

      {google?.connection && google.connection.last_sync_status !== 'disconnected' ? <>
        <Card>
          <Text style={styles.label}>Calendari sincronizzati</Text>
          <Text style={styles.meta}>Puoi includere più calendari, anche condivisi. Solo i calendari con permesso di scrittura possono essere usati per creare o modificare eventi.</Text>
          {google.calendars.map((calendar) => {
            const writable = ['owner', 'writer'].includes(calendar.access_role);
            return <View key={calendar.id} style={styles.resourceRow}>
              <View style={styles.resourceText}>
                <Text style={styles.resourceTitle}>{calendar.summary}{calendar.primary_calendar ? ' · principale' : ''}</Text>
                <Text style={styles.meta}>{calendar.access_role}{calendar.is_default ? ' · predefinito' : ''}</Text>
              </View>
              <Switch value={calendar.selected} onValueChange={(selected) => { void run(() => setCalendarSelected(calendar.id, selected)); }}/>
              <Pressable disabled={!calendar.selected || !writable || calendar.is_default} onPress={() => { void run(() => setDefaultCalendar(calendar.id)); }} style={[styles.defaultButton, (!calendar.selected || !writable || calendar.is_default) && styles.disabled]}><Text style={styles.defaultText}>{calendar.is_default ? 'Default' : 'Imposta'}</Text></Pressable>
            </View>;
          })}
        </Card>

        <Card>
          <Text style={styles.label}>Liste Google Tasks</Text>
          <Text style={styles.meta}>La lista predefinita viene proposta automaticamente, ma puoi cambiarla per ogni nuova attività.</Text>
          {google.taskLists.map((list) => <View key={list.id} style={styles.resourceRow}>
            <View style={styles.resourceText}><Text style={styles.resourceTitle}>{list.title}</Text><Text style={styles.meta}>{list.is_default ? 'Predefinita' : 'Lista attività'}</Text></View>
            <Switch value={list.selected} onValueChange={(selected) => { void run(() => setTaskListSelected(list.id, selected)); }}/>
            <Pressable disabled={!list.selected || list.is_default} onPress={() => { void run(() => setDefaultTaskList(list.id)); }} style={[styles.defaultButton, (!list.selected || list.is_default) && styles.disabled]}><Text style={styles.defaultText}>{list.is_default ? 'Default' : 'Imposta'}</Text></Pressable>
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
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:20,paddingBottom:110,gap:16},title:{fontSize:31,fontWeight:'900',color:palette.ink,marginTop:14},label:{fontSize:13,fontWeight:'800',color:palette.primary,textTransform:'uppercase'},row:{flexDirection:'row',alignItems:'center',gap:12,marginTop:14},item:{fontSize:18,fontWeight:'800',color:palette.ink,marginTop:8},meta:{fontSize:13,lineHeight:18,color:palette.muted,marginTop:4},error:{fontSize:13,lineHeight:18,color:'#A12626',marginTop:8},score:{fontSize:42,fontWeight:'900',color:palette.ink,marginTop:10},metrics:{flexDirection:'row',gap:12},metricCard:{flex:1},metric:{fontSize:30,fontWeight:'900',color:palette.ink},metricLabel:{fontSize:12,color:palette.muted,marginTop:4},actions:{flexDirection:'row',gap:10,marginTop:16,flexWrap:'wrap'},resourceRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#ECEEF4'},resourceText:{flex:1},resourceTitle:{fontSize:15,fontWeight:'800',color:palette.ink},defaultButton:{backgroundColor:palette.soft,borderRadius:12,paddingHorizontal:10,paddingVertical:8},defaultText:{fontSize:12,fontWeight:'800',color:palette.primary},disabled:{opacity:.45}});
