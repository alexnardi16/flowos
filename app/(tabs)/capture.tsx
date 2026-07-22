import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, palette } from '@/components/ui';
import { getGoogleWorkspaceStatus, syncGoogleWorkspace, type GoogleCalendar, type GoogleTaskList } from '@/lib/googleWorkspace';
import { useFlowStore } from '@/lib/store';
import type { CommitmentKind } from '@/types';

function localIso(date: string, time: string) {
  if (!date) return undefined;
  const safeTime = time || '09:00';
  const value = new Date(`${date}T${safeTime}:00`);
  return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
}

export default function Capture() {
  const [kind, setKind] = useState<Extract<CommitmentKind,'event'|'task'|'reminder'>>('event');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState('30');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [calendarId, setCalendarId] = useState<string>();
  const [taskListId, setTaskListId] = useState<string>();
  const addCommitment = useFlowStore((state) => state.addCommitment);

  useEffect(() => {
    void getGoogleWorkspaceStatus().then((status) => {
      const writable = status.calendars.filter((calendar) => calendar.selected && ['owner','writer'].includes(calendar.access_role));
      const lists = status.taskLists.filter((list) => list.selected);
      setCalendars(writable); setTaskLists(lists);
      setCalendarId((writable.find((calendar) => calendar.is_default) ?? writable[0])?.google_calendar_id);
      setTaskListId((lists.find((list) => list.is_default) ?? lists[0])?.google_task_list_id);
    }).catch(() => undefined);
  }, []);

  const destinationName = useMemo(() => kind === 'event'
    ? calendars.find((item) => item.google_calendar_id === calendarId)?.summary
    : taskLists.find((item) => item.google_task_list_id === taskListId)?.title,
  [kind, calendars, taskLists, calendarId, taskListId]);

  async function create() {
    if (!title.trim() || !date || loading) return;
    const at = localIso(date, time);
    if (!at) return Alert.alert('Aggiungi', 'Controlla data e orario.');
    setLoading(true); setSaved(false);
    try {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const googleCalendarId = kind === 'event' ? calendarId : undefined;
      const googleTaskListId = kind !== 'event' ? taskListId : undefined;
      await addCommitment({
        id, title: title.trim(), kind, description: description.trim() || undefined,
        notes: notes.trim() || undefined, location: location.trim() || undefined, link: link.trim() || undefined,
        status: kind === 'event' ? 'scheduled' : 'active', durationMinutes: Math.max(1, Number(duration) || 30),
        energy: 'medium', context: kind === 'event' ? 'Calendario' : kind === 'task' ? 'Google Tasks' : 'Reminder',
        scheduledAt: kind === 'event' ? at : undefined, dueAt: kind !== 'event' ? at : undefined,
        fixed: kind === 'event', confidence: 1, googleCalendarId, googleTaskListId,
        syncStatus: googleCalendarId || googleTaskListId ? 'pending' : 'local_only',
      });
      if (googleCalendarId || googleTaskListId) await syncGoogleWorkspace();
      setSaved(true); setTitle(''); setDescription(''); setNotes(''); setLocation(''); setLink('');
    } catch (error) {
      Alert.alert('Aggiungi', error instanceof Error ? error.message : 'Creazione non riuscita.');
    } finally { setLoading(false); }
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>Aggiungi</Text><Text style={styles.sub}>Crea un elemento completo e scegli dove sincronizzarlo.</Text>
    <Card>
      <Text style={styles.label}>Tipo</Text><View style={styles.choices}>{(['event','task','reminder'] as const).map((value) => <Choice key={value} label={value==='event'?'Evento':value==='task'?'Task':'Reminder'} active={kind===value} onPress={() => setKind(value)}/>)}</View>
      <Field label="Titolo" value={title} onChangeText={setTitle} placeholder="Titolo"/>
      <View style={styles.inline}><View style={styles.flex}><Field label="Data" value={date} onChangeText={setDate} placeholder="2026-07-22"/></View><View style={styles.flex}><Field label="Orario" value={time} onChangeText={setTime} placeholder="09:00"/></View></View>
      <Field label="Durata in minuti" value={duration} onChangeText={(value) => setDuration(value.replace(/\D/g,''))} placeholder="30" keyboardType="number-pad"/>
      <Field label="Descrizione" value={description} onChangeText={setDescription} placeholder="Descrizione" multiline/>
      <Field label="Note" value={notes} onChangeText={setNotes} placeholder="Note aggiuntive" multiline/>
      <Field label="Luogo" value={location} onChangeText={setLocation} placeholder="Indirizzo o luogo"/>
      <Field label="Link" value={link} onChangeText={setLink} placeholder="https://…" keyboardType="url"/>
    </Card>

    <Card><Text style={styles.label}>{kind==='event'?'Calendario':'Lista Google Tasks'}</Text><Text style={styles.meta}>Destinazione selezionata: {destinationName ?? 'nessuna'}</Text><View style={styles.choices}>{kind==='event' ? calendars.map((item) => <Choice key={item.id} label={item.summary} active={item.google_calendar_id===calendarId} onPress={() => setCalendarId(item.google_calendar_id)}/>) : taskLists.map((item) => <Choice key={item.id} label={item.title} active={item.google_task_list_id===taskListId} onPress={() => setTaskListId(item.google_task_list_id)}/>)}</View></Card>

    <Button label={loading?'Creazione…':kind==='event'?'Crea evento':kind==='task'?'Crea task':'Crea reminder'} onPress={() => { void create(); }}/>
    {saved ? <Card><Text style={styles.saved}>✓ Elemento creato e sincronizzato</Text></Card> : null}
  </ScrollView></SafeAreaView>;
}

function Choice({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}) { return <Pressable onPress={onPress} style={[styles.choice,active&&styles.choiceActive]}><Text style={[styles.choiceText,active&&styles.choiceTextActive]}>{label}</Text></Pressable>; }
function Field(props:any) { return <View style={styles.field}><Text style={styles.fieldLabel}>{props.label}</Text><TextInput {...props} label={undefined} style={[styles.input,props.multiline&&styles.multiline]}/></View>; }
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:20,paddingBottom:110,gap:16},title:{fontSize:31,fontWeight:'900',color:palette.ink,marginTop:14},sub:{fontSize:16,color:palette.muted},label:{fontSize:13,fontWeight:'800',color:palette.primary,textTransform:'uppercase'},meta:{fontSize:13,color:palette.muted,marginTop:6},choices:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:10},choice:{borderRadius:99,paddingHorizontal:12,paddingVertical:9,backgroundColor:'#F0F1F6',borderWidth:1,borderColor:'#E1E3EB'},choiceActive:{backgroundColor:palette.primary,borderColor:palette.primary},choiceText:{fontSize:13,fontWeight:'700',color:palette.ink},choiceTextActive:{color:'#fff'},field:{marginTop:14},fieldLabel:{fontSize:12,fontWeight:'800',color:palette.muted,marginBottom:6},input:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#E2E4EA',borderRadius:12,padding:12,color:palette.ink},multiline:{minHeight:90,textAlignVertical:'top'},inline:{flexDirection:'row',gap:10},flex:{flex:1},saved:{fontWeight:'800',color:palette.success}});