import { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Button, Card, Chip, SectionTitle, palette, showAlert } from '@/components/ui';
import { friendlyCalendarName, getGoogleWorkspaceStatus, syncGoogleWorkspace, type GoogleCalendar, type GoogleTaskList } from '@/lib/googleWorkspace';
import { useFlowStore } from '@/lib/store';
import { formatReminderOffsetLabel } from '@/lib/customReminders';
import type { CommitmentKind, ReminderOffset, RecurrenceFrequency } from '@/types';

type CreatableKind = Extract<CommitmentKind,'event'|'task'|'reminder'>;
type RepeatOption='none'|RecurrenceFrequency;
const REPEAT_LABELS:Record<RepeatOption,string>={none:'Non ripetere',daily:'Ogni giorno',weekly:'Ogni settimana',monthly:'Ogni mese'};
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
function localIso(date:string,time:string) { if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time)) return; const value=new Date(`${date}T${time}:00`); return Number.isNaN(value.getTime())?undefined:value.toISOString(); }
function allDayIso(date:string) { if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return; const [y,m,d]=date.split('-').map(Number); return new Date(Date.UTC(y,m-1,d,0,0)).toISOString(); }
function totalDurationMinutes(allDay:boolean,days:string,hours:string,minutes:string){return allDay?Math.max(1,Number(days)||1)*1440:Math.max(1,(Number(days)||0)*1440+(Number(hours)||0)*60+(Number(minutes)||0));}
function kindName(kind:CreatableKind){return kind==='event'?'Evento':kind==='task'?'Task':'Reminder';}

export default function Capture() {
  const [kind,setKind]=useState<CreatableKind>('event');
  const [title,setTitle]=useState('');
  const [date,setDate]=useState(today());
  const [time,setTime]=useState('00:00');
  const [allDay,setAllDay]=useState(false);
  const [days,setDays]=useState('0');
  const [hours,setHours]=useState('0');
  const [minutes,setMinutes]=useState('30');
  const [description,setDescription]=useState('');
  const [notes,setNotes]=useState('');
  const [location,setLocation]=useState('');
  const [link,setLink]=useState('');
  const [showDetails,setShowDetails]=useState(false);
  const [loading,setLoading]=useState(false);
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [calendars,setCalendars]=useState<GoogleCalendar[]>([]);
  const [taskLists,setTaskLists]=useState<GoogleTaskList[]>([]);
  const [calendarId,setCalendarId]=useState<string>();
  const [taskListId,setTaskListId]=useState<string>();
  const [repeat,setRepeat]=useState<RepeatOption>('none');
  const [reminders,setReminders]=useState<ReminderOffset[]>([]);
  const [customMinutes,setCustomMinutes]=useState('');
  function addReminder(minutesBefore:number){if(reminders.some((r)=>r.minutesBefore===minutesBefore))return;setReminders((current)=>[...current,{id:`${Date.now()}-${minutesBefore}`,minutesBefore}].sort((a,b)=>a.minutesBefore-b.minutesBefore));}
  function removeReminder(id:string){setReminders((current)=>current.filter((r)=>r.id!==id));}
  const addCommitment=useFlowStore((state)=>state.addCommitment);
  const [ownEmail,setOwnEmail]=useState<string|null>(null);

  useEffect(()=>{ void getGoogleWorkspaceStatus().then((status)=>{
    const writable=status.calendars.filter((calendar)=>calendar.selected&&['owner','writer'].includes(calendar.access_role));
    const lists=status.taskLists.filter((list)=>list.selected);
    setCalendars(writable); setTaskLists(lists);
    setOwnEmail(status.connection?.google_email??null);
    setCalendarId((writable.find((calendar)=>calendar.is_default)??writable[0])?.google_calendar_id);
    setTaskListId((lists.find((list)=>list.is_default)??lists[0])?.google_task_list_id);
  }).catch(()=>undefined); },[]);

  const destinationName=useMemo(()=>{const raw=kind==='event'?calendars.find((item)=>item.google_calendar_id===calendarId)?.summary:taskLists.find((item)=>item.google_task_list_id===taskListId)?.title;return raw?(kind==='event'?friendlyCalendarName(raw,ownEmail):raw):undefined;},[kind,calendars,taskLists,calendarId,taskListId,ownEmail]);
  const at=allDay?allDayIso(date):localIso(date,time);
  const durationMinutes=totalDurationMinutes(allDay,days,hours,minutes);
  const valid=Boolean(title.trim()&&at&&durationMinutes>0&&destinationName);

  function reset(){setTitle('');setDescription('');setNotes('');setLocation('');setLink('');setAllDay(false);setTime('00:00');setDays('0');setHours('0');setMinutes('30');setShowDetails(false);setRepeat('none');setReminders([]);}
  async function create(){
    if(loading)return;
    setSaved(false);setError(null);
    if(!title.trim())return setError('Inserisci un titolo.');
    if(!at)return setError('Inserisci data e orario validi.');
    if(!destinationName)return setError(kind==='event'?'Seleziona un calendario scrivibile.':'Seleziona una lista Google Tasks.');
    setLoading(true);
    try{
      const id=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`;
      const googleCalendarId=kind==='event'?calendarId:undefined;
      const googleTaskListId=kind!=='event'?taskListId:undefined;
      const recurrenceRule=repeat!=='none'?{frequency:repeat,interval:1}:undefined;
      await addCommitment({id,title:title.trim(),kind,description:description.trim()||undefined,notes:notes.trim()||undefined,location:location.trim()||undefined,link:link.trim()||undefined,status:kind==='event'?'scheduled':'active',durationMinutes,allDay,energy:'medium',context:kind==='event'?'Calendario':kind==='task'?'Google Tasks':'Reminder',scheduledAt:kind==='event'?at:undefined,dueAt:kind!=='event'?at:undefined,fixed:kind==='event',confidence:1,googleCalendarId,googleTaskListId,recurrenceRule,reminders:reminders.length?reminders:undefined,syncStatus:'pending'});
      await syncGoogleWorkspace(); reset(); setSaved(true);
    }catch(e){const message=e instanceof Error?e.message:'Creazione non riuscita.';setError(message);showAlert('Aggiungi',message);}finally{setLoading(false);}
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>FlowOS</Text><Text style={styles.title}>Aggiungi</Text><Text style={styles.sub}>Definisci prima cosa stai creando, poi scegli quando e dove salvarlo.</Text>

    <SectionTitle title="1. Tipo" subtitle="Evento per un appuntamento fisso; task per un’attività; reminder per un promemoria."/>
    <View style={styles.kindGridRow}>{(['event','task','reminder'] as const).map((value)=><Pressable key={value} onPress={()=>{setKind(value);setSaved(false);setError(null);}} style={[styles.kindCard,kind===value&&styles.kindCardActive]}><Text style={[styles.kindTitle,kind===value&&styles.kindTitleActive]}>{kindName(value)}</Text><Text style={[styles.kindHelp,kind===value&&styles.kindHelpActive]}>{value==='event'?'Occupa uno spazio nel calendario':value==='task'?'Richiede un’azione':'Ti ricorda qualcosa'}</Text></Pressable>)}</View>

    <SectionTitle title="2. Informazioni essenziali"/>
    <Card>
      <Field required label="Titolo" value={title} onChangeText={(v)=>{setTitle(v);setSaved(false);setError(null);}} placeholder={kind==='event'?'Es. Visita pediatrica':kind==='task'?'Es. Preparare il budget':'Es. Chiamare il medico'}/>
      <View style={styles.rowBetween}><Text style={styles.fieldLabel}>Giornata intera</Text><Switch value={allDay} onValueChange={setAllDay}/></View>
      <View style={styles.inline}>
        <View style={styles.flex}><Field required label="Data" value={date} onChangeText={setDate} placeholder="AAAA-MM-GG"/></View>
        {!allDay?<View style={styles.flex}><Field required label="Orario di inizio" value={time} onChangeText={setTime} placeholder="HH:MM"/></View>:null}
      </View>
      <Text style={styles.fieldLabel}>Durata{allDay?' (giorni)':''}</Text>
      <View style={styles.inline}>
        <View style={styles.flex}><Field label="giorni" value={days} onChangeText={(v)=>setDays(v.replace(/\D/g,''))} keyboardType="number-pad" placeholder="0"/></View>
        {!allDay?<><View style={styles.flex}><Field label="ore" value={hours} onChangeText={(v)=>setHours(v.replace(/\D/g,''))} keyboardType="number-pad" placeholder="0"/></View>
        <View style={styles.flex}><Field label="minuti" value={minutes} onChangeText={(v)=>setMinutes(v.replace(/\D/g,''))} keyboardType="number-pad" placeholder="30"/></View></>:null}
      </View>
      <Text style={[styles.fieldLabel,styles.fieldLabelSpaced]}>Ripeti{kind==='task'?' (gestito da FlowOS: Google Tasks non supporta la ricorrenza)':''}</Text>
      <View style={styles.choices}>{(['none','daily','weekly','monthly'] as const).map((option)=><Choice key={option} label={REPEAT_LABELS[option]} active={repeat===option} onPress={()=>setRepeat(option)}/>)}</View>
      <Text style={[styles.fieldLabel,styles.fieldLabelSpaced]}>Notifiche di rappel</Text>
      {reminders.length?<View style={styles.remindersList}>{reminders.map((r)=><View key={r.id} style={styles.reminderChip}><Text style={styles.reminderChipText}>{formatReminderOffsetLabel(r.minutesBefore)}</Text><Pressable onPress={()=>removeReminder(r.id)}><Text style={styles.reminderRemove}>✕</Text></Pressable></View>)}</View>:null}
      <View style={styles.choices}>{[10,60,1440].map((m)=><Choice key={m} label={`+ ${formatReminderOffsetLabel(m)}`} active={false} onPress={()=>addReminder(m)}/>)}</View>
      <View style={styles.inline}>
        <View style={styles.flex}><Field label="minuti personalizzati" value={customMinutes} onChangeText={(v)=>setCustomMinutes(v.replace(/\D/g,''))} keyboardType="number-pad" placeholder="es. 45"/></View>
        <Pressable onPress={()=>{const m=Number(customMinutes);if(m>0){addReminder(m);setCustomMinutes('');}}} style={styles.addReminderButton}><Text style={styles.addReminderButtonText}>Aggiungi</Text></Pressable>
      </View>
    </Card>

    <SectionTitle title="3. Destinazione Google" subtitle={kind==='event'?'Scegli il calendario in cui creare l’evento.':'Scegli la lista in cui creare l’attività.'}/>
    <Card><Text style={styles.destination}>Destinazione: <Text style={styles.destinationStrong}>{destinationName??'nessuna disponibile'}</Text></Text><View style={styles.choices}>{kind==='event'?calendars.map((item)=><Choice key={item.id} label={friendlyCalendarName(item.summary,ownEmail)} active={item.google_calendar_id===calendarId} onPress={()=>setCalendarId(item.google_calendar_id)}/>):taskLists.map((item)=><Choice key={item.id} label={item.title} active={item.google_task_list_id===taskListId} onPress={()=>setTaskListId(item.google_task_list_id)}/>)}</View>{!destinationName?<Text style={styles.warning}>Configura almeno una destinazione scrivibile nella sezione Io.</Text>:null}</Card>

    <Pressable onPress={()=>setShowDetails((v)=>!v)} style={styles.detailsToggle}><Text style={styles.detailsToggleText}>{showDetails?'Nascondi dettagli facoltativi':'Aggiungi descrizione, note, luogo o link'}</Text><Text style={styles.chevron}>{showDetails?'−':'+'}</Text></Pressable>
    {showDetails?<Card><Field label="Descrizione" value={description} onChangeText={setDescription} multiline placeholder="Informazioni principali"/><Field label="Note private" value={notes} onChangeText={setNotes} multiline placeholder="Dettagli utili per te"/><Field label="Luogo" value={location} onChangeText={setLocation} placeholder="Indirizzo o luogo"/><Field label="Link" value={link} onChangeText={setLink} keyboardType="url" autoCapitalize="none" placeholder="https://…"/></Card>:null}

    <Card style={styles.preview}><View style={styles.previewRow}><Chip>{kindName(kind).toUpperCase()}</Chip><Text style={styles.previewDestination}>{destinationName??'Nessuna destinazione'}</Text></View><Text style={styles.previewTitle}>{title.trim()||'Titolo non ancora inserito'}</Text><Text style={styles.previewMeta}>{date}{allDay?' · Tutto il giorno':` · ${time}`} · {durationMinutes} min</Text></Card>
    {error?<Text style={styles.error}>{error}</Text>:null}
    <Button label={`Crea ${kindName(kind).toLowerCase()}`} onPress={()=>void create()} loading={loading} disabled={!valid}/>
    {saved?<Card><Text style={styles.saved}>Elemento creato e sincronizzato con Google.</Text></Card>:null}
  </ScrollView></SafeAreaView>;
}

function Choice({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){return <Pressable onPress={onPress} style={[styles.choice,active&&styles.choiceActive]}><Text style={[styles.choiceText,active&&styles.choiceTextActive]}>{label}</Text></Pressable>;}
type FieldProps=TextInputProps&{label:string;required?:boolean};
function Field({label,required,multiline,style,...props}:FieldProps){return <View style={styles.field}><Text style={styles.fieldLabel}>{label}{required?<Text style={styles.required}> *</Text>:null}</Text><TextInput {...props} multiline={multiline} placeholderTextColor="#979DAE" style={[styles.input,multiline&&styles.multiline,style]}/></View>;}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:20,paddingBottom:110,gap:14},eyebrow:{fontSize:12,fontWeight:'900',letterSpacing:1.5,color:palette.primary,marginTop:14},title:{fontSize:32,fontWeight:'900',color:palette.ink},sub:{fontSize:15,lineHeight:22,color:palette.muted},kindGrid:{flexDirection:'row',gap:8,flexWrap:'wrap'},kindGridRow:{flexDirection:'row',gap:8,flexWrap:'nowrap'},remindersList:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:6},reminderChip:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:palette.soft,borderRadius:99,paddingHorizontal:10,paddingVertical:6},reminderChipText:{fontSize:12,fontWeight:'800',color:palette.primary},reminderRemove:{fontSize:12,fontWeight:'900',color:palette.muted},addReminderButton:{backgroundColor:'#ECEEF4',borderRadius:12,paddingHorizontal:12,justifyContent:'center'},addReminderButtonText:{fontSize:12,fontWeight:'800',color:palette.ink},kindCard:{flex:1,minWidth:0,padding:12,borderRadius:17,backgroundColor:'#FFF',borderWidth:1,borderColor:palette.border},rowBetween:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:13},kindCardActive:{backgroundColor:palette.primary,borderColor:palette.primary},kindTitle:{fontSize:16,fontWeight:'900',color:palette.ink},kindTitleActive:{color:'#FFF'},kindHelp:{fontSize:12,lineHeight:17,color:palette.muted,marginTop:4},kindHelpActive:{color:'#EAE7FF'},field:{marginTop:13},fieldLabel:{fontSize:12,fontWeight:'800',color:palette.muted,marginBottom:6},fieldLabelSpaced:{marginTop:18},required:{color:palette.danger},input:{backgroundColor:'#FFF',borderWidth:1,borderColor:palette.border,borderRadius:12,padding:12,color:palette.ink,fontSize:15},multiline:{minHeight:88,textAlignVertical:'top'},inline:{flexDirection:'row',gap:10},flex:{flex:1},destination:{fontSize:14,color:palette.muted},destinationStrong:{fontWeight:'900',color:palette.ink},choices:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:12},choice:{borderRadius:99,paddingHorizontal:12,paddingVertical:9,backgroundColor:'#F0F1F6',borderWidth:1,borderColor:palette.border},choiceActive:{backgroundColor:palette.primary,borderColor:palette.primary},choiceText:{fontSize:13,fontWeight:'700',color:palette.ink},choiceTextActive:{color:'#FFF'},warning:{fontSize:13,lineHeight:18,color:palette.warning,marginTop:10},detailsToggle:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:13},detailsToggleText:{fontSize:15,fontWeight:'800',color:palette.primary},chevron:{fontSize:24,color:palette.primary},preview:{gap:8,backgroundColor:'#FAFAFE'},previewRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},previewDestination:{fontSize:12,color:palette.muted,flexShrink:1},previewTitle:{fontSize:18,fontWeight:'900',color:palette.ink},previewMeta:{fontSize:13,color:palette.muted},error:{fontSize:14,lineHeight:20,color:palette.danger,fontWeight:'700'},saved:{fontWeight:'800',color:palette.success}});