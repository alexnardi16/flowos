import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, EmptyState, SectionTitle, palette } from '@/components/ui';
import { ManageSheet } from '@/components/ManageSheet';
import { formatDurationLabel, isExpired } from '@/lib/itemTiming';
import { buildPlanningSuggestions } from '@/lib/planningSuggestions';
import { useFlowStore } from '@/lib/store';
import type { Commitment } from '@/types';

const FILTERS_KEY='flowos-plan-filters-v1';
type FilterKey='events'|'tasks'|'past'|'overdue';
type Filters=Record<FilterKey,boolean>;
const DEFAULT_FILTERS:Filters={events:true,tasks:true,past:false,overdue:true};
type ContactsFilter='all'|'onlyContacts'|'excludeContacts';
const CONTACTS_FILTER_KEY='flowos-plan-contacts-filter-v1';
function isContactEvent(item:Commitment){return item.googleEventType==='birthday';}
function itemDate(item:Commitment){return item.scheduledAt??item.dueAt;}
function formatDateTime(item:Commitment):string{
  const value=itemDate(item);
  if(!value)return'Data e ora non definite';
  if(item.allDay){
    const d=new Date(value);
    const weekday=['dom','lun','mar','mer','gio','ven','sab'][d.getUTCDay()];
    const day=String(d.getUTCDate()).padStart(2,'0');
    const month=String(d.getUTCMonth()+1).padStart(2,'0');
    return `${weekday} ${day}/${month}/${d.getUTCFullYear()} · Tutto il giorno`;
  }
  return new Date(value).toLocaleString('it-IT',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
function formatTotal(minutes:number){const h=Math.floor(minutes/60),m=minutes%60;return h?`${h} h${m?` ${m} min`:''}`:`${m} min`;}
function searchable(item:Commitment){return [item.title,item.description,item.notes,item.location,item.context,item.outcome,item.kind].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}

export default function Plan(){
  const commitments=useFlowStore((state)=>state.commitments);
  const [query,setQuery]=useState('');
  const [filters,setFilters]=useState<Filters>(DEFAULT_FILTERS);
  const [manageId,setManageId]=useState<string|null>(null);
  const [contactsFilter,setContactsFilter]=useState<ContactsFilter>('all');

  useEffect(()=>{void AsyncStorage.getItem(FILTERS_KEY).then((raw)=>{if(raw)setFilters({...DEFAULT_FILTERS,...JSON.parse(raw)});}).catch(()=>undefined);},[]);
  useEffect(()=>{void AsyncStorage.setItem(FILTERS_KEY,JSON.stringify(filters));},[filters]);
  useEffect(()=>{void AsyncStorage.getItem(CONTACTS_FILTER_KEY).then((raw)=>{if(raw==='onlyContacts'||raw==='excludeContacts'||raw==='all')setContactsFilter(raw);}).catch(()=>undefined);},[]);
  useEffect(()=>{void AsyncStorage.setItem(CONTACTS_FILTER_KEY,contactsFilter);},[contactsFilter]);

  const items=useMemo(()=>{const now=Date.now();const normalized=query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return commitments.filter((item)=>{const event=item.kind==='event';const task=['task','reminder','routine'].includes(item.kind);const date=itemDate(item);const past=Boolean(date&&new Date(date).getTime()<now);const open=item.status!=='done';if(event&&!filters.events)return false;if(task&&!filters.tasks)return false;if(!event&&!task)return false;if(past&&!filters.past&&!(task&&open&&filters.overdue))return false;if(item.status==='done'&&!filters.past)return false;if(contactsFilter==='onlyContacts'&&!isContactEvent(item))return false;if(contactsFilter==='excludeContacts'&&isContactEvent(item))return false;return !normalized||searchable(item).includes(normalized);}).sort((a,b)=>{const ad=itemDate(a),bd=itemDate(b);if(!ad)return 1;if(!bd)return-1;return new Date(ad).getTime()-new Date(bd).getTime();});},[commitments,filters,query,contactsFilter]);
  const totalMinutes=items.reduce((sum,item)=>sum+item.durationMinutes,0);
  const overdueCount=items.filter((item)=>item.status!=='done'&&isExpired(item)).length;
  const suggestions=useMemo(()=>buildPlanningSuggestions(commitments),[commitments]);
  const toggle=(key:FilterKey)=>setFilters((current)=>({...current,[key]:!current[key]}));
  const manageItem=manageId?commitments.find((item)=>item.id===manageId)??null:null;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.wrap}>
    <Text style={styles.eyebrow}>FlowOS</Text><Text style={styles.title}>Tutto</Text><Text style={styles.sub}>Eventi e attività ordinati nel tempo, con filtri salvati automaticamente.</Text>
    <View style={styles.summary}><Card style={styles.summaryCard}><Text style={styles.summaryValue}>{items.length}</Text><Text style={styles.summaryLabel}>elementi visibili</Text></Card><Card style={styles.summaryCard}><Text style={styles.summaryValue}>{formatTotal(totalMinutes)}</Text><Text style={styles.summaryLabel}>carico totale</Text></Card><Card style={styles.summaryCard}><Text style={[styles.summaryValue,overdueCount>0&&styles.warning]}>{overdueCount}</Text><Text style={styles.summaryLabel}>elementi scaduti</Text></Card></View>
    <TextInput value={query} onChangeText={setQuery} placeholder="Cerca titolo, descrizione, luogo…" placeholderTextColor={palette.muted} style={styles.search}/>
    <View style={styles.filters}><Filter label="Eventi" active={filters.events} onPress={()=>toggle('events')}/><Filter label="Task e reminder" active={filters.tasks} onPress={()=>toggle('tasks')}/><Filter label="Passati e completati" active={filters.past} onPress={()=>toggle('past')}/><Filter label="Scaduti aperti" active={filters.overdue} onPress={()=>toggle('overdue')}/></View>
    <View style={styles.filters}><Filter label="Tutti gli eventi" active={contactsFilter==='all'} onPress={()=>setContactsFilter('all')}/><Filter label="Solo contatti (compleanni)" active={contactsFilter==='onlyContacts'} onPress={()=>setContactsFilter('onlyContacts')}/><Filter label="Escludi contatti" active={contactsFilter==='excludeContacts'} onPress={()=>setContactsFilter('excludeContacts')}/></View>
    {suggestions.length?<View style={styles.filters}>{suggestions.map((suggestion)=><Card key={suggestion.id} style={styles.suggestionCard}><Text style={styles.suggestionText}>{suggestion.text}</Text></Card>)}</View>:null}
    <SectionTitle title="Elementi" subtitle="Le azioni di eliminazione sono nascoste dietro “Gestisci” per evitare tocchi accidentali."/>
    {items.length?items.map((item)=>{const overdue=item.status!=='done'&&isExpired(item);return <Card key={item.id} style={styles.itemCard}>
      <View style={styles.row}><View style={styles.chips}><Chip tone={item.status==='done'?'success':overdue?'warning':'primary'}>{item.kind==='event'?'EVENTO':item.kind==='reminder'?'REMINDER':item.status==='done'?'COMPLETATA':'TASK'}</Chip></View><Pressable onPress={()=>setManageId(item.id)} style={styles.manage}><Text style={styles.manageText}>Gestisci</Text></Pressable></View>
      {!item.externalId?<View style={styles.flowOnlyTag}><Text style={styles.flowOnlyText}>Solo su FlowOS</Text></View>:null}
      <Text style={styles.item}>{item.title}</Text><Text style={[styles.date,overdue&&styles.warning]}>{formatDateTime(item)}{overdue?' · scaduta':''}</Text>
      <Text style={styles.meta}>{formatDurationLabel(item)} · {item.context||'nessun contesto'}</Text>
      {item.description?<Text style={styles.description}>{item.description}</Text>:null}{item.location?<Text style={styles.meta}>Luogo: {item.location}</Text>:null}
    </Card>;}) : <EmptyState title="Nessun risultato" message="Modifica i filtri oppure aggiungi un nuovo elemento."/>}
    {manageItem?<ManageSheet item={manageItem} onClose={()=>setManageId(null)}/>:null}
  </ScrollView></SafeAreaView>;
}
function Filter({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{selected:active}} style={[styles.filter,active&&styles.filterActive]}><Text style={[styles.filterText,active&&styles.filterTextActive]}>{label}</Text></Pressable>;}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:20,paddingBottom:110,gap:14},eyebrow:{fontSize:12,fontWeight:'900',letterSpacing:1.4,color:palette.primary,marginTop:14},title:{fontSize:32,fontWeight:'900',color:palette.ink},sub:{fontSize:15,lineHeight:22,color:palette.muted},summary:{flexDirection:'row',gap:8,flexWrap:'nowrap'},summaryCard:{flex:1,minWidth:0,padding:10},summaryValue:{fontSize:22,fontWeight:'900',color:palette.ink},summaryLabel:{fontSize:12,color:palette.muted,marginTop:3},warning:{color:palette.warning},flowOnlyTag:{alignSelf:'flex-start',backgroundColor:'#FDECEC',borderRadius:99,paddingHorizontal:10,paddingVertical:4},flowOnlyText:{fontSize:11,fontWeight:'900',color:'#A12626'},suggestionCard:{width:'100%',padding:12,backgroundColor:palette.soft},suggestionText:{fontSize:13,lineHeight:18,color:palette.ink,fontWeight:'700'},search:{backgroundColor:'#FFF',borderWidth:1,borderColor:palette.border,borderRadius:15,paddingHorizontal:15,paddingVertical:13,fontSize:15,color:palette.ink},filters:{flexDirection:'row',flexWrap:'wrap',gap:8},filter:{borderRadius:99,paddingHorizontal:12,paddingVertical:9,backgroundColor:'#ECEEF4'},filterActive:{backgroundColor:palette.primary},filterText:{fontSize:12,fontWeight:'800',color:palette.muted},filterTextActive:{color:'#FFF'},itemCard:{gap:7},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},chips:{flexDirection:'row',gap:7,flexWrap:'wrap',flex:1},manage:{paddingHorizontal:11,paddingVertical:7,borderRadius:10,backgroundColor:palette.soft},manageText:{fontSize:12,fontWeight:'900',color:palette.primary},item:{fontSize:19,fontWeight:'900',color:palette.ink,marginTop:4},date:{fontSize:14,fontWeight:'800',color:palette.primary},meta:{fontSize:13,lineHeight:18,color:palette.muted},description:{fontSize:14,lineHeight:20,color:palette.ink,marginTop:2},actionBox:{marginTop:8,padding:12,borderRadius:14,backgroundColor:'#F8F8FC',gap:7},actionTitle:{fontSize:14,fontWeight:'900',color:palette.ink},actionHelp:{fontSize:12,lineHeight:17,color:palette.muted},deleteActions:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:4},localDelete:{paddingVertical:9,paddingHorizontal:12,borderRadius:12,backgroundColor:'#ECEEF4'},localDeleteText:{color:palette.ink,fontWeight:'800'},googleDelete:{paddingVertical:9,paddingHorizontal:12,borderRadius:12,backgroundColor:'#FDECEC'},googleDeleteText:{color:palette.danger,fontWeight:'800'}});