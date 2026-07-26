import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, EmptyState, SectionTitle, palette } from '@/components/ui';
import { formatCommitmentTime } from '@/lib/allDayDate';
import { recordDiagnostic } from '@/lib/diagnostics';
import { useFlowStore } from '@/lib/store';
import type { Commitment } from '@/types';

function when(item: Commitment) { return item.scheduledAt ?? item.dueAt; }
function isToday(item: Commitment) {
  const value = when(item);
  if (!value) return false;
  const date = new Date(value), now = new Date();
  if (item.allDay) return date.getUTCFullYear()===now.getFullYear() && date.getUTCMonth()===now.getMonth() && date.getUTCDate()===now.getDate();
  return date.getFullYear()===now.getFullYear() && date.getMonth()===now.getMonth() && date.getDate()===now.getDate();
}
function durationLabel(minutes:number) { const h=Math.floor(minutes/60), m=minutes%60; return h ? `${h} h${m?` ${m} min`:''}` : `${m} min`; }
type ContactsFilter='all'|'onlyContacts'|'excludeContacts';
const CONTACTS_FILTER_KEY='flowos-today-contacts-filter-v1';
function isContactEvent(item:Commitment){return item.googleEventType==='birthday';}

export default function Today() {
  const commitments = useFlowStore((state) => state.commitments);
  const complete = useFlowStore((state) => state.complete);
  const postpone = useFlowStore((state) => state.postpone);
  const start = useFlowStore((state) => state.startFocus);
  const [contactsFilter,setContactsFilter]=useState<ContactsFilter>('all');
  useEffect(()=>{void AsyncStorage.getItem(CONTACTS_FILTER_KEY).then((raw)=>{if(raw==='onlyContacts'||raw==='excludeContacts'||raw==='all')setContactsFilter(raw);}).catch(()=>undefined);},[]);
  useEffect(()=>{void AsyncStorage.setItem(CONTACTS_FILTER_KEY,contactsFilter);},[contactsFilter]);

  const open = useMemo(() => commitments.filter((item) => item.status !== 'done'), [commitments]);
  const tasks = useMemo(() => open.filter((item) => ['task','reminder','routine'].includes(item.kind)).sort((a,b) => {
    const ad=when(a), bd=when(b); if (!ad) return 1; if (!bd) return -1; return new Date(ad).getTime()-new Date(bd).getTime();
  }), [open]);
  const events = useMemo(() => open.filter((item) => item.kind==='event' && when(item) && new Date(when(item)!).getTime()>=Date.now()-3600000).filter((item)=>contactsFilter==='onlyContacts'?isContactEvent(item):contactsFilter==='excludeContacts'?!isContactEvent(item):true).sort((a,b)=>new Date(when(a)!).getTime()-new Date(when(b)!).getTime()), [open,contactsFilter]);
  const current = tasks.find((item) => isToday(item)) ?? tasks[0];
  const event = events[0];
  const todayItems = open.filter((item) => isToday(item));
  const plannedMinutes = todayItems.reduce((sum,item)=>sum+item.durationMinutes,0);
  const overdue = tasks.filter((item) => item.dueAt && new Date(item.dueAt).getTime()<Date.now()).length;

  useEffect(() => { recordDiagnostic('authenticated-home-mounted', { route:'/today', itemCount:open.length }); }, [open.length]);

  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.wrap}>
    <Text style={s.hello}>FlowOS</Text>
    <Text style={s.title}>Oggi, senza rumore.</Text>
    <View style={s.stats}>
      <Card style={s.stat}><Text style={s.statValue}>{todayItems.length}</Text><Text style={s.statLabel}>elementi oggi</Text></Card>
      <Card style={s.stat}><Text style={s.statValue}>{durationLabel(plannedMinutes)}</Text><Text style={s.statLabel}>carico previsto</Text></Card>
      <Card style={s.stat}><Text style={[s.statValue,overdue>0&&s.warning]}>{overdue}</Text><Text style={s.statLabel}>task scadute</Text></Card>
    </View>

    <SectionTitle title="Prossima azione" subtitle="Il task aperto più vicino nel tempo."/>
    {current ? <Card style={s.focusCard}>
      <View style={s.row}><Chip>ADESSO</Chip><Text style={s.conf}>{Math.round(current.confidence*100)}% affidabilità</Text></View>
      <Text style={s.task}>{current.title}</Text>
      <Text style={s.meta}>{durationLabel(current.durationMinutes)} · energia {current.energy} · {current.context||'generale'}</Text>
      {current.description?<Text style={s.description}>{current.description}</Text>:null}
      {current.outcome?<Text style={s.outcome}>Risultato atteso: {current.outcome}</Text>:null}
      <View style={s.actions}><Button label="Inizia" onPress={()=>{start(current.id);router.push('/focus');}}/><Button secondary label="Rimanda" onPress={()=>void postpone(current.id)}/><Button secondary label="Completa" onPress={()=>void complete(current.id)}/></View>
    </Card> : <EmptyState title="Nessuna attività attiva" message="Aggiungi un task o un reminder per ricevere una prossima azione." actionLabel="Aggiungi" onAction={()=>router.push('/capture')}/>} 

    <SectionTitle title="Prossimo evento" subtitle="Il primo appuntamento non ancora terminato."/>
    <View style={s.quick}><Filter label="Tutti" active={contactsFilter==='all'} onPress={()=>setContactsFilter('all')}/><Filter label="Solo contatti" active={contactsFilter==='onlyContacts'} onPress={()=>setContactsFilter('onlyContacts')}/><Filter label="Escludi contatti" active={contactsFilter==='excludeContacts'} onPress={()=>setContactsFilter('excludeContacts')}/></View>
    {event ? <Card><Text style={s.eventTime}>{event.allDay?formatCommitmentTime(event,event.scheduledAt!):new Date(event.scheduledAt!).toLocaleString('it-IT',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</Text><Text style={s.event}>{event.title}</Text><Text style={s.meta}>{durationLabel(event.durationMinutes)} · orario fisso</Text>{event.location?<Text style={s.meta}>📍 {event.location}</Text>:null}</Card> : <EmptyState title="Nessun evento in arrivo" message="Il calendario è libero nell’intervallo sincronizzato."/>}

    <SectionTitle title="Azioni rapide"/>
    <View style={s.quick}><Button label="Nuovo elemento" onPress={()=>router.push('/capture')}/><Button secondary label="Apri il Piano" onPress={()=>router.push('/plan')}/><Button secondary label="Controlla Inbox" onPress={()=>router.push('/inbox')}/></View>
  </ScrollView></SafeAreaView>;
}

function Filter({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{selected:active}} style={[s.filter,active&&s.filterActive]}><Text style={[s.filterText,active&&s.filterTextActive]}>{label}</Text></Pressable>;}
const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:20,paddingBottom:110,gap:14},hello:{fontSize:14,color:palette.primary,fontWeight:'900',letterSpacing:1.3,textTransform:'uppercase'},title:{fontSize:32,lineHeight:38,fontWeight:'900',color:palette.ink,marginBottom:4},stats:{flexDirection:'row',gap:10,flexWrap:'wrap'},stat:{flexGrow:1,minWidth:95,padding:14},statValue:{fontSize:23,fontWeight:'900',color:palette.ink},statLabel:{fontSize:12,color:palette.muted,marginTop:3},warning:{color:palette.warning},focusCard:{gap:13},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},conf:{fontSize:12,color:palette.muted,fontWeight:'700'},task:{fontSize:24,lineHeight:30,fontWeight:'900',color:palette.ink},meta:{fontSize:14,lineHeight:20,color:palette.muted},description:{fontSize:14,lineHeight:21,color:palette.ink},outcome:{backgroundColor:'#F2F8F6',padding:12,borderRadius:14,color:palette.success,fontWeight:'700'},actions:{flexDirection:'row',gap:8,flexWrap:'wrap'},eventTime:{fontSize:20,fontWeight:'900',color:palette.primary},event:{fontSize:19,fontWeight:'800',color:palette.ink,marginVertical:5},quick:{flexDirection:'row',gap:8,flexWrap:'wrap'},filter:{borderRadius:99,paddingHorizontal:12,paddingVertical:9,backgroundColor:'#ECEEF4'},filterActive:{backgroundColor:palette.primary},filterText:{fontSize:12,fontWeight:'800',color:palette.muted},filterTextActive:{color:'#FFF'}
});