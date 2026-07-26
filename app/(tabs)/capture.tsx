import { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Button, Card, Chip, SectionTitle, palette, showAlert } from '@/components/ui';
import { getGoogleWorkspaceStatus, syncGoogleWorkspace, type GoogleCalendar, type GoogleTaskList } from '@/lib/googleWorkspace';
import { useFlowStore } from '@/lib/store';
import type { CommitmentKind, RecurrenceFrequency } from '@/types';

type CreatableKind = Extract<CommitmentKind,'event'|'task'|'reminder'>;
type RepeatOption='none'|RecurrenceFrequency;
const REPEAT_LABELS:Record<RepeatOption,string>={none:'Non ripetere',daily:'Ogni giorno',weekly:'Ogni settimana',monthly:'Ogni mese'};
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
function localIso(date:string,time:string) { if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time)) return; const value=new Date(`${date}T${time}:00`); return Number.isNaN(value.getTime())?undefined:value.toISOString(); }
function kindName(kind:CreatableKind){return kind==='event'?'Evento':kind==='task'?'Task':'Reminder';}

export default function Capture() {
  const [kind,setKind]=useState<CreatableKind>('event');
  const [title,setTitle]=useState('');
  const [date,setDate]=useState(today());
  const [time,setTime]=useState('09:00');
  const [duration,setDuration]=useState('30');
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
  const addCommitment=useFlowStore((state)=>state.addCommitment);

  useEffect(()=>{ void getGoogleWorkspaceStatus().then((status)=>{
    const writable=status.calendars.filter((calendar)=>calendar.selected&&['owner','writer'].includes(calendar.access_role));
    const lists=status.taskLists.filter((list)=>list.selected);
    setCalendars(writable); setTaskLists(lists);
    setCalendarId((writable.find((calendar)=>calendar.is_default)??writable[0])?.google_calendar_id);
    setTaskListId((lists.find((list)=>list.is_default)??lists[0])?.google_task_list_id);
  }).catch(()=>undefined); },[]);

  const destinationName=useMemo(()=>kind==='event'?calendars.find((item)=>item.google_calendar_id===calendarId)?.summary:taskLists.find((item)=>item.google_task_list_id===taskListId)?.title,[kind,calendars,taskLists,calendarId,taskListId]);
  const valid=Boolean(title.trim()&&localIso(date,time)&&Number(duration)>0&&destinationName);

  function reset(){setTitle('');setDescription('');setNotes('');setLocation('');setLink('');setDuration('30');setShowDetails(false);setRepeat('none');}
  async function create(){
    if(loading)return;
    setSaved(false);setError(null);
    if(!title.trim())return setError('Inserisci un titolo.');
    const at=localIso(date,time); if(!at)return setError('Inserisci data e orario validi.');
    if(!destinationName)return setError(kind==='event'?'Seleziona un calendario scrivibile.':'Seleziona una lista Google Tasks.');
    setLoading(true);
    try{
      const id=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`;
      const googleCalendarId=kind==='event'?calendarId:undefined;
      const googleTaskListId=kind!=='event'?taskListId:undefined;
      const recurrenceRule=repeat!=='none'?{frequency:repeat,interval:1}:undefined;
      await addCommitment({id,title:title.trim(),kind,description:description.trim()||undefined,notes:notes.trim()||undefined,location:location.trim()||undefined,link:link.trim()||undefined,status:kind==='event'?'scheduled':'active',durationMinutes:Math.max(1,Number(duration)||30),energy:'medium',context:kind==='event'?'Calendario':kind==='task'?'Google Tasks':'Reminder',scheduledAt:kind==='event'?at:undefined,dueAt:kind!=='event'?at:undefined,fixed:kind==='event',confidence:1,googleCalendarId,googleTaskListId,recurrenceRule,syncStatus:'pending'});
      await syncGoogleWorkspace(); reset(); setSaved(true);
    }catch(e){const message=e instanceof Error?e.message:'Creazione non riuscita.';setError(message);showAlert('Aggiungi',message);}finally{setLoading(false);}
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>NUOVO ELEMENTO</Text><Text style={styles.title}>Aggiungi</Text><Text style={styles.sub}>Definisci prima cosa stai creando, poi scegli quando e dove salvarlo.</Text>

    <SectionTitle title="1. Tipo" subtitle="Evento per un appuntamento fisso; task per un’attività; reminder per un promemoria."/>
    <View style={styles.kindGrid}>{(['event','task','reminder'] as const).map((value)=><Pressable key={value} onPress={()=>{setKind(value);setSaved(false);setError(null);}} style={[styles.kindCard,kind===value&&styles.kindCardActive]}><Text style={[styles.kindTitle,kind===value&&styles.kindTitleActive]}>{kindName(value)}</Text><Text style={[styles.kindHelp,kind===value&&styles.kindHelpActive]}>{value==='event'?'Occupa uno spazio nel calendario':value==='task'?'Richiede un’azione':'Ti ricorda qualcosa'}</Text></Pressable>)}</View>

    <SectionTitle title="2. Informazioni essenziali"/>
    <Card>
      <Field required label="Titolo" value={title} onChangeText={(v)=>{setTitle(v);setSaved(false);setError(null);}} placeholder={kind==='event'?'Es. Visita pediatrica':kind==='task'?'Es. Preparare il budget':'Es. Chiamare il medico'}/>
      <View style={styles.inline}><View style={styles.flex}><Field required label="Data" value={date} onChangeText={setDate} placeholder="AAAA-MM-GG"/></View><View style={styles.flex}><Field required label="Orario" value={time} onChangeText={setTime} placeholder="HH:MM"/></View></View>
      <Field required label="Durata stimata (minuti)" value={duration} onChangeText={(v)=>setDuration(v.replace(/\D/g,''))} keyboardType="number-pad" placeholder="30"/>
      <Text style={styles.fieldLabel}>Ripeti{kind==='task'?' (gestito da FlowOS: Google Tasks non supporta la ricorrenza)':''}</Text>
      <View style={styles.choices}>{(['none','daily','weekly','monthly'] as const).map((option)=><Choice key={option} label={REPEAT_LABELS[option]} active={repeat===option} onPress={()=>setRepeat(option)}/>)}</View>
    </Card>

    <SectionTitle title="3. Destinazione Google" subtitle={kind==='event'?'Scegli il calendario in cui creare l’evento.':'Scegli la lista in cui creare l’attività.'}/>
    <Card><Text style={styles.destination}>Destinazione: <Text style={styles.destinationStrong}>{destinationName??'nessuna disponibile'}</Text></Text><View style={styles.choices}>{kind==='event'?calendars.map((item)=><Choice key={item.id} label={item.summary} active={item.google_calendar_id===calendarId} onPress={()=>setCalendarId(item.google_calendar_id)}/>):taskLists.map((item)=><Choice key={item.id} label={item.title} active={item.google_task_list_id===taskListId} onPress={()=>setTaskListId(item.google_task_list_id)}/>)}</View>{!destinationName?<Text style={styles.warning}>Configura almeno una destinazione scrivibile nella sezione Io.</Text>:null}</Card>

    <Pressable onPress={()=>setShowDetails((v)=>!v)} style={styles.detailsToggle}><Text style={styles.detailsToggleText}>{showDetails?'Nascondi dettagli facoltativi':'Aggiungi descrizione, note, luogo o link'}</Text><Text style={styles.chevron}>{showDetails?'−':'+'}</Text></Pressable>
    {showDetails?<Card><Field label="Descrizione" value={description} onChangeText={setDescription} multiline placeholder="Informazioni principali"/><Field label="Note private" value={notes} onChangeText={setNotes} multiline placeholder="Dettagli utili per te"/><Field label="Luogo" value={location} onChangeText={setLocation} placeholder="Indirizzo o luogo"/><Field label="Link" value={link} onChangeText={setLink} keyboardType="url" autoCapitalize="none" placeholder="https://…"/></Card>:null}

    <Card style={styles.preview}><View style={styles.previewRow}><Chip>{kindName(kind).toUpperCase()}</Chip><Text style={styles.previewDestination}>{destinationName??'Nessuna destinazione'}</Text></View><Text style={styles.previewTitle}>{title.trim()||'Titolo non ancora inserito'}</Text><Text style={styles.previewMeta}>{date} · {time} · {duration||'0'} min</Text></Card>
    {error?<Text style={styles.error}>{error}</Text>:null}
    <Button label={`Crea ${kindName(kind).toLowerCase()}`} onPress={()=>void create()} loading={loading} disabled={!valid}/>
    {saved?<Card><Text style={styles.saved}>Elemento creato e sincronizzato con Google.</Text></Card>:null}
  </ScrollView></SafeAreaView>;
}

function Choice({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){return <Pressable onPress={onPress} style={[styles.choice,active&&styles.choiceActive]}><Text style={[styles.choiceText,active&&styles.choiceTextActive]}>{label}</Text></Pressable>;}
type FieldProps=TextInputProps&{label:string;required?:boolean};
function Field({label,required,multiline,style,...props}:FieldProps){return <View style={styles.field}><Text style={styles.fieldLabel}>{label}{required?<Text style={styles.required}> *</Text>:null}</Text><TextInput {...props} multiline={multiline} placeholderTextColor="#979DAE" style={[styles.input,multiline&&styles.multiline,style]}/></View>;}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:20,paddingBottom:110,gap:14},eyebrow:{fontSize:12,fontWeight:'900',letterSpacing:1.5,color:palette.primary,marginTop:14},title:{fontSize:32,fontWeight:'900',color:palette.ink},sub:{fontSize:15,lineHeight:22,color:palette.muted},kindGrid:{flexDirection:'row',gap:8,flexWrap:'wrap'},kindCard:{flexGrow:1,minWidth:100,padding:14,borderRadius:17,backgroundColor:'#FFF',borderWidth:1,borderColor:palette.border},kindCardActive:{backgroundColor:palette.primary,borderColor:palette.primary},kindTitle:{fontSize:16,fontWeight:'900',color:palette.ink},kindTitleActive:{color:'#FFF'},kindHelp:{fontSize:12,lineHeight:17,color:palette.muted,marginTop:4},kindHelpActive:{color:'#EAE7FF'},field:{marginTop:13},fieldLabel:{fontSize:12,fontWeight:'800',color:palette.muted,marginBottom:6},required:{color:palette.danger},input:{backgroundColor:'#FFF',borderWidth:1,borderColor:palette.border,borderRadius:12,padding:12,color:palette.ink,fontSize:15},multiline:{minHeight:88,textAlignVertical:'top'},inline:{flexDirection:'row',gap:10},flex:{flex:1},destination:{fontSize:14,color:palette.muted},destinationStrong:{fontWeight:'900',color:palette.ink},choices:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:12},choice:{borderRadius:99,paddingHorizontal:12,paddingVertical:9,backgroundColor:'#F0F1F6',borderWidth:1,borderColor:palette.border},choiceActive:{backgroundColor:palette.primary,borderColor:palette.primary},choiceText:{fontSize:13,fontWeight:'700',color:palette.ink},choiceTextActive:{color:'#FFF'},warning:{fontSize:13,lineHeight:18,color:palette.warning,marginTop:10},detailsToggle:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:13},detailsToggleText:{fontSize:15,fontWeight:'800',color:palette.primary},chevron:{fontSize:24,color:palette.primary},preview:{gap:8,backgroundColor:'#FAFAFE'},previewRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},previewDestination:{fontSize:12,color:palette.muted,flexShrink:1},previewTitle:{fontSize:18,fontWeight:'900',color:palette.ink},previewMeta:{fontSize:13,color:palette.muted},error:{fontSize:14,lineHeight:20,color:palette.danger,fontWeight:'700'},saved:{fontWeight:'800',color:palette.success}});