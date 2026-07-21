import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, palette } from '@/components/ui';
import { interpretCommitment } from '@/lib/ai';
import { getGoogleWorkspaceStatus, syncGoogleWorkspace, type GoogleCalendar, type GoogleTaskList } from '@/lib/googleWorkspace';
import { useFlowStore } from '@/lib/store';

export default function Capture() {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [calendarId, setCalendarId] = useState<string | undefined>();
  const [taskListId, setTaskListId] = useState<string | undefined>();
  const addCommitment = useFlowStore((state) => state.addCommitment);

  useEffect(() => {
    void getGoogleWorkspaceStatus().then((status) => {
      const writable = status.calendars.filter((calendar) => calendar.selected && ['owner', 'writer'].includes(calendar.access_role));
      const selectedLists = status.taskLists.filter((list) => list.selected);
      setCalendars(writable); setTaskLists(selectedLists);
      setCalendarId((writable.find((calendar) => calendar.is_default) ?? writable[0])?.google_calendar_id);
      setTaskListId((selectedLists.find((list) => list.is_default) ?? selectedLists[0])?.google_task_list_id);
    }).catch(() => undefined);
  }, []);

  const defaultDestination = useMemo(() => {
    const calendar = calendars.find((item) => item.google_calendar_id === calendarId);
    const list = taskLists.find((item) => item.google_task_list_id === taskListId);
    return { calendar: calendar?.summary, taskList: list?.title };
  }, [calendars, taskLists, calendarId, taskListId]);

  async function organize() {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const commitment = await interpretCommitment(text.trim());
      const enriched = commitment.kind === 'event'
        ? { ...commitment, googleCalendarId: calendarId, syncStatus: calendarId ? 'pending' as const : 'local_only' as const }
        : ['task', 'reminder'].includes(commitment.kind)
          ? { ...commitment, googleTaskListId: taskListId, syncStatus: taskListId ? 'pending' as const : 'local_only' as const }
          : commitment;
      await addCommitment(enriched);
      if (enriched.syncStatus === 'pending') await syncGoogleWorkspace();
      setSaved(true); setText('');
    } catch (error) {
      Alert.alert('Non riesco a organizzare questa intenzione', error instanceof Error ? error.message : 'Errore sconosciuto');
    } finally { setLoading(false); }
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Cosa vuoi ottenere?</Text>
      <Text style={styles.sub}>Scrivilo come ti viene. L’IA organizza il resto.</Text>
      <Card>
        <TextInput value={text} onChangeText={(value) => { setText(value); setSaved(false); }} multiline autoFocus placeholder="Es. Martedì alle 15 riunione con Marco, devo preparare il budget prima" style={styles.input}/>
        <Button label={loading ? 'Sto organizzando…' : 'Organizza con l’IA'} onPress={() => { void organize(); }}/>
      </Card>

      {calendars.length ? <Card>
        <Text style={styles.label}>Calendario per gli eventi</Text>
        <Text style={styles.meta}>Preselezionato: {defaultDestination.calendar}. Puoi cambiarlo prima di salvare.</Text>
        <View style={styles.choices}>{calendars.map((calendar) => <Pressable key={calendar.id} onPress={() => setCalendarId(calendar.google_calendar_id)} style={[styles.choice, calendar.google_calendar_id === calendarId && styles.choiceActive]}><Text style={[styles.choiceText, calendar.google_calendar_id === calendarId && styles.choiceTextActive]}>{calendar.summary}</Text></Pressable>)}</View>
      </Card> : null}

      {taskLists.length ? <Card>
        <Text style={styles.label}>Lista per le attività</Text>
        <Text style={styles.meta}>Preselezionata: {defaultDestination.taskList}. Puoi cambiarla prima di salvare.</Text>
        <View style={styles.choices}>{taskLists.map((list) => <Pressable key={list.id} onPress={() => setTaskListId(list.google_task_list_id)} style={[styles.choice, list.google_task_list_id === taskListId && styles.choiceActive]}><Text style={[styles.choiceText, list.google_task_list_id === taskListId && styles.choiceTextActive]}>{list.title}</Text></Pressable>)}</View>
      </Card> : null}

      {saved && <Card><Text style={styles.saved}>✓ Intenzione salvata e sincronizzata nella destinazione selezionata</Text></Card>}
      <Text style={styles.hint}>Gli eventi vengono inviati al calendario scelto; le attività alla lista Google Tasks scelta. Le destinazioni predefinite si modificano nella sezione Io.</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:20,paddingBottom:110,gap:16},title:{fontSize:31,fontWeight:'900',color:palette.ink,marginTop:14},sub:{fontSize:16,color:palette.muted},input:{minHeight:170,fontSize:18,lineHeight:26,color:palette.ink,textAlignVertical:'top',marginBottom:16},saved:{fontWeight:'800',color:palette.success},hint:{fontSize:13,lineHeight:19,color:palette.muted},label:{fontSize:13,fontWeight:'800',color:palette.primary,textTransform:'uppercase'},meta:{fontSize:13,lineHeight:18,color:palette.muted,marginTop:5},choices:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:12},choice:{borderRadius:99,paddingHorizontal:12,paddingVertical:9,backgroundColor:'#F0F1F6',borderWidth:1,borderColor:'#E1E3EB'},choiceActive:{backgroundColor:palette.primary,borderColor:palette.primary},choiceText:{fontSize:13,fontWeight:'700',color:palette.ink},choiceTextActive:{color:'#fff'}});
