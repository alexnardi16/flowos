import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, Chip, EmptyState, ScreenShell, SectionTitle, palette } from '@/components/ui';
import { CommitmentSourceTag } from '@/components/CommitmentSourceTag';
import { ManageSheet } from '@/components/ManageSheet';
import { isContactEvent } from '@/lib/contactEvents';
import { getGoogleWorkspaceStatus, type GoogleWorkspaceStatus } from '@/lib/googleWorkspace';
import { formatDurationLabel, isExpired } from '@/lib/itemTiming';
import { useFlowStore } from '@/lib/store';
import type { Commitment } from '@/types';

const FILTERS_KEY='flowos-plan-filters-v1';
type FilterKey='events'|'tasks'|'past'|'overdue';
type Filters=Record<FilterKey,boolean>;
const DEFAULT_FILTERS:Filters={events:true,tasks:true,past:false,overdue:true};
type ContactsFilter='all'|'onlyContacts'|'excludeContacts';
const CONTACTS_FILTER_KEY='flowos-plan-contacts-filter-v1';

function itemDate(item:Commitment){return item.scheduledAt??item.dueAt;}
function formatDateTime(item:Commitment){
  const value=itemDate(item);
  if(!value)return'Data e ora non definite';
  if(item.allDay){
    const d=new Date(value);
    return `${['dom','lun','mar','mer','gio','ven','sab'][d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()} · Tutto il giorno`;
  }
  return new Date(value).toLocaleString('it-IT',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
function cardKindStyle(kind:Commitment['kind']){
  return kind==='event'?styles.cardEvent:styles.cardTask;
}
function searchable(item:Commitment){
  return[item.title,item.description,item.notes,item.location,item.context,item.outcome,item.kind].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function isGoogleTask(item:Commitment){return item.kind==='task'&&Boolean(item.googleTaskListId);}

export default function Plan(){
  const commitments=useFlowStore(state=>state.commitments);
  const[query,setQuery]=useState('');
  const[filters,setFilters]=useState<Filters>(DEFAULT_FILTERS);
  const[manageId,setManageId]=useState<string|null>(null);
  const[contactsFilter,setContactsFilter]=useState<ContactsFilter>('all');
  const[now,setNow]=useState(()=>Date.now());
  const[google,setGoogle]=useState<GoogleWorkspaceStatus|null>(null);

  useEffect(()=>{void getGoogleWorkspaceStatus().then(setGoogle).catch(()=>setGoogle(null));},[]);
  useEffect(()=>{const i=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(i);},[]);
  useEffect(()=>{void AsyncStorage.getItem(FILTERS_KEY).then(raw=>{if(raw){try{setFilters({...DEFAULT_FILTERS,...JSON.parse(raw)});}catch{setFilters(DEFAULT_FILTERS);}}}).catch(()=>undefined);},[]);
  useEffect(()=>{void AsyncStorage.setItem(FILTERS_KEY,JSON.stringify(filters));},[filters]);
  useEffect(()=>{void AsyncStorage.getItem(CONTACTS_FILTER_KEY).then(raw=>{if(raw==='onlyContacts'||raw==='excludeContacts'||raw==='all')setContactsFilter(raw);}).catch(()=>undefined);},[]);
  useEffect(()=>{void AsyncStorage.setItem(CONTACTS_FILTER_KEY,contactsFilter);},[contactsFilter]);

  const items=useMemo(()=>{
    const normalized=query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return commitments.filter(item=>{
      const event=item.kind==='event',task=item.kind==='task',flexible=task,date=itemDate(item),past=Boolean(date&&new Date(date).getTime()<now),open=item.status!=='done';
      if(event&&!filters.events)return false;
      if(task&&!filters.tasks)return false;
      if(!event&&!flexible)return false;
      if(past&&!filters.past&&!(flexible&&open&&filters.overdue))return false;
      if(item.status==='done'&&!filters.past)return false;
      if(contactsFilter==='onlyContacts'&&(!isContactEvent(item)||isGoogleTask(item)))return false;
      if(contactsFilter==='excludeContacts'&&isContactEvent(item))return false;
      return!normalized||searchable(item).includes(normalized);
    }).sort((a,b)=>{
      const ad=itemDate(a),bd=itemDate(b);
      if(!ad)return 1;if(!bd)return-1;
      return new Date(ad).getTime()-new Date(bd).getTime();
    });
  },[commitments,filters,query,contactsFilter,now]);

  const overdueItems=items.filter(item=>item.status!=='done'&&isExpired(item));
  const manageItem=manageId?commitments.find(item=>item.id===manageId)??null:null;
  const toggle=(key:FilterKey)=>setFilters(current=>({...current,[key]:!current[key]}));

  return <ScreenShell title="Lista" subtitle="Eventi e attività ordinati nel tempo, con filtri salvati automaticamente.">
    <TextInput value={query} onChangeText={setQuery} placeholder="Cerca titolo, descrizione, luogo…" placeholderTextColor={palette.muted} style={styles.search}/>
    <View style={styles.filters}>
      <Filter label="Eventi" active={filters.events} onPress={()=>toggle('events')}/>
      <Filter label="Task" active={filters.tasks} onPress={()=>toggle('tasks')}/>
      <Filter label="Passati e completati" active={filters.past} onPress={()=>toggle('past')}/>
      <Filter label="Scaduti aperti" active={filters.overdue} onPress={()=>toggle('overdue')}/>
    </View>
    <View style={styles.filters}>
      <Filter label="Tutti" active={contactsFilter==='all'} onPress={()=>setContactsFilter('all')}/>
      <Filter label="Solo contatti" active={contactsFilter==='onlyContacts'} onPress={()=>setContactsFilter('onlyContacts')}/>
      <Filter label="Escludi contatti" active={contactsFilter==='excludeContacts'} onPress={()=>setContactsFilter('excludeContacts')}/>
    </View>
    {overdueItems.length?<Card style={styles.overdueCard}><View style={styles.overdueHeader}><Text style={styles.overdueTitle}>Attività in ritardo</Text><Chip tone="warning">{overdueItems.length}</Chip></View>{overdueItems.map(item=><Pressable key={item.id} onPress={()=>setManageId(item.id)} style={styles.overdueItem}><Text style={styles.overdueItemTitle}>{item.title}</Text><Text style={styles.overdueItemMeta}>{formatDateTime(item)} · {item.kind==='event'?'Evento':false?'Reminder':'Task'}</Text></Pressable>)}</Card>:null}
    <SectionTitle title="Elementi" subtitle="Tocca una scheda per aprirla."/>
    {items.length?items.map(item=>{
      const overdue=item.status!=='done'&&isExpired(item);
      return <Pressable key={item.id} onPress={()=>setManageId(item.id)} style={({pressed})=>pressed&&styles.cardPressed}>
        <Card style={[styles.itemCard,cardKindStyle(item.kind)]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow}>
            <Chip tone={item.status==='done'?'success':overdue?'warning':'primary'}>{item.kind==='event'?'EVENTO':false?'REMINDER':item.status==='done'?'COMPLETATA':'TASK'}</Chip>
            <CommitmentSourceTag item={item} google={google}/>
          </ScrollView>
          <Text style={styles.item}>{item.title}</Text>
          <Text style={[styles.date,overdue&&styles.warning]}>{formatDateTime(item)}{overdue?' · scaduta':''}</Text>
          <Text style={styles.meta}>{formatDurationLabel(item)} · {item.context||'nessun contesto'}</Text>
          {item.description?<Text style={styles.description}>{item.description}</Text>:null}
          {item.location?<Text style={styles.meta}>Luogo: {item.location}</Text>:null}
        </Card>
      </Pressable>;
    }):<EmptyState title="Nessun risultato" message="Modifica i filtri oppure aggiungi un nuovo elemento."/>}
    {manageItem?<ManageSheet item={manageItem} onClose={()=>setManageId(null)}/>:null}
  </ScreenShell>;
}

function Filter({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{selected:active}} style={[styles.filter,active&&styles.filterActive]}>
    <Text style={[styles.filterText,active&&styles.filterTextActive]}>{label}</Text>
  </Pressable>;
}

const styles=StyleSheet.create({
  warning:{color:palette.warning},
  search:{backgroundColor:'#FFF',borderWidth:1,borderColor:palette.border,borderRadius:15,paddingHorizontal:15,paddingVertical:13,fontSize:15,color:palette.ink},
  filters:{flexDirection:'row',flexWrap:'wrap',gap:8},
  filter:{borderRadius:99,paddingHorizontal:12,paddingVertical:9,backgroundColor:'#ECEEF4'},
  filterActive:{backgroundColor:palette.primary},
  filterText:{fontSize:12,fontWeight:'800',color:palette.muted},
  filterTextActive:{color:'#FFF'},
  overdueCard:{backgroundColor:'#FFF7E8',borderColor:'#F3DCA8',borderWidth:1,gap:8,padding:13},
  overdueHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  overdueTitle:{fontSize:16,fontWeight:'900',color:palette.ink},
  overdueItem:{paddingTop:6,borderTopWidth:1,borderTopColor:'#F3DCA8'},
  overdueItemTitle:{fontSize:15,fontWeight:'900',color:palette.ink},
  overdueItemMeta:{fontSize:12,lineHeight:16,color:palette.muted,marginTop:1},
  itemCard:{padding:9,gap:4},
  cardEvent:{backgroundColor:'#EEF1FE',borderColor:'#C7D0FB',borderWidth:1},
  cardTask:{backgroundColor:'#FFF7E8',borderColor:'#F3DCA8',borderWidth:1},
  cardReminder:{backgroundColor:'#EAFBF3',borderColor:'#B9EAD4',borderWidth:1},
  tagRow:{alignItems:'center',gap:6,paddingRight:4},
  item:{fontSize:16,lineHeight:20,fontWeight:'900',color:palette.ink},
  date:{fontSize:13,lineHeight:17,fontWeight:'800',color:palette.primary},
  meta:{fontSize:12,lineHeight:16,color:palette.muted},
  description:{fontSize:12,lineHeight:16,color:palette.ink,marginTop:1},
  cardPressed:{opacity:.96,transform:[{scale:.995}]}
});