import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Chip, EmptyState, palette } from '@/components/ui';
import { ManageSheet } from '@/components/ManageSheet';
import { formatCommitmentTime } from '@/lib/allDayDate';
import { isContactEvent } from '@/lib/contactEvents';
import { recordDiagnostic } from '@/lib/diagnostics';
import { formatDurationLabel, isExpired } from '@/lib/itemTiming';
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
function kindLabel(kind:Commitment['kind']){return kind==='event'?'EVENTO':kind==='reminder'?'REMINDER':kind==='task'?'TASK':kind==='routine'?'ROUTINE':'IDEA';}
function kindTone(kind:Commitment['kind']):'primary'|'success'|'warning'|'neutral'{return kind==='event'?'primary':kind==='task'?'warning':kind==='reminder'?'success':'neutral';}
function cardKindStyle(kind:Commitment['kind']){return kind==='event'?s.cardEvent:kind==='task'?s.cardTask:kind==='reminder'?s.cardReminder:undefined;}
type ContactsFilter='all'|'onlyContacts'|'excludeContacts';
const CONTACTS_FILTER_KEY='flowos-today-contacts-filter-v1';
function totalLoadLabel(minutes:number){const h=Math.floor(minutes/60),m=minutes%60;return h?`${h} h${m?` ${m} min`:''}`:`${m} min`;}

export default function Today() {
  const commitments = useFlowStore((state) => state.commitments);
  const complete = useFlowStore((state) => state.complete);
  const postpone = useFlowStore((state) => state.postpone);
  const [contactsFilter,setContactsFilter]=useState<ContactsFilter>('all');
  const [manageId,setManageId]=useState<string|null>(null);
  useEffect(()=>{void AsyncStorage.getItem(CONTACTS_FILTER_KEY).then((raw)=>{if(raw==='onlyContacts'||raw==='excludeContacts'||raw==='all')setContactsFilter(raw);}).catch(()=>undefined);},[]);
  useEffect(()=>{void AsyncStorage.setItem(CONTACTS_FILTER_KEY,contactsFilter);},[contactsFilter]);

  const open = useMemo(() => commitments.filter((item) => item.status !== 'done'), [commitments]);
  const todayItems = useMemo(() => open
    .filter((item) => isToday(item))
    .filter((item) => item.kind!=='event' || (contactsFilter==='onlyContacts'?isContactEvent(item):contactsFilter==='excludeContacts'?!isContactEvent(item):true))
    .sort((a,b) => { const av=when(a), bv=when(b); if(!av) return 1; if(!bv) return -1; return new Date(av).getTime()-new Date(bv).getTime(); }),
  [open,contactsFilter]);
  const plannedMinutes = todayItems.reduce((sum,item)=>sum+item.durationMinutes,0);
  // Scoped to today's items only — counting isExpired() over the whole
  // dataset would include years of historical Google-synced items.
  const overdueCount = todayItems.filter((item) => isExpired(item)).length;
  const manageItem = manageId ? commitments.find((item)=>item.id===manageId) ?? null : null;

  useEffect(() => { recordDiagnostic('authenticated-home-mounted', { route:'/today', itemCount:open.length }); }, [open.length]);

  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.wrap}>
    <Text style={s.hello}>FlowOS</Text>
    <Text style={s.title}>Oggi</Text>
    <View style={s.stats}>
      <Card style={s.stat}><Text style={s.statValue}>{todayItems.length}</Text><Text style={s.statLabel}>elementi</Text></Card>
      <Card style={s.stat}><Text style={s.statValue}>{totalLoadLabel(plannedMinutes)}</Text><Text style={s.statLabel}>carico previsto</Text></Card>
      <Card style={s.stat}><Text style={[s.statValue,overdueCount>0&&s.warning]}>{overdueCount}</Text><Text style={s.statLabel}>task scadute</Text></Card>
    </View>

    <View style={s.quick}><Filter label="Tutti" active={contactsFilter==='all'} onPress={()=>setContactsFilter('all')}/><Filter label="Solo contatti" active={contactsFilter==='onlyContacts'} onPress={()=>setContactsFilter('onlyContacts')}/><Filter label="Escludi contatti" active={contactsFilter==='excludeContacts'} onPress={()=>setContactsFilter('excludeContacts')}/></View>

    {todayItems.length ? todayItems.map((item)=>{
      const expired=isExpired(item);
      const timeLabel=item.allDay?formatCommitmentTime(item,when(item)!):new Date(when(item)!).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
      return <Card key={item.id} style={[s.itemCard,cardKindStyle(item.kind)]}>
        <View style={s.itemHeader}>
          <View style={{flex:1,gap:6}}>
            <Chip tone={kindTone(item.kind)}>{kindLabel(item.kind)}</Chip>
            <Text style={s.task}>{item.title}</Text>
            <Text style={s.meta}>{timeLabel} · {formatDurationLabel(item)}{expired?' · scaduta':''}</Text>
          </View>
          <Pressable onPress={()=>setManageId(item.id)} style={s.manageButton}><Text style={s.manageButtonText}>Gestisci</Text></Pressable>
        </View>
        {!item.externalId?<View style={s.flowOnlyTag}><Text style={s.flowOnlyText}>Solo su FlowOS</Text></View>:null}
        {item.location?<Text style={s.meta}>📍 {item.location}</Text>:null}
        {item.description?<Text style={s.description}>{item.description}</Text>:null}
        <View style={s.actions}>
          <Pressable onPress={()=>setManageId(item.id)} style={s.secondaryAction}><Text style={s.secondaryActionText}>Gestisci</Text></Pressable>
          <Pressable onPress={()=>void postpone(item.id)} style={s.secondaryAction}><Text style={s.secondaryActionText}>Rimanda di 1 giorno</Text></Pressable>
          <Pressable onPress={()=>void complete(item.id)} style={s.primaryAction}><Text style={s.primaryActionText}>Completa</Text></Pressable>
        </View>
      </Card>;
    }) : <EmptyState title="Nessuna attività per oggi" message="Aggiungi un task, un reminder o un evento per iniziare." actionLabel="Aggiungi" onAction={()=>router.push('/capture')}/>}

    {manageItem ? <ManageSheet item={manageItem} onClose={()=>setManageId(null)} /> : null}
  </ScrollView></SafeAreaView>;
}

function Filter({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{selected:active}} style={[s.filter,active&&s.filterActive]}><Text style={[s.filterText,active&&s.filterTextActive]}>{label}</Text></Pressable>;}
const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:20,paddingBottom:110,gap:14},hello:{fontSize:14,color:palette.primary,fontWeight:'900',letterSpacing:1.3,textTransform:'uppercase'},title:{fontSize:32,lineHeight:38,fontWeight:'900',color:palette.ink,marginBottom:4},
  stats:{flexDirection:'row',gap:8,flexWrap:'nowrap'},stat:{flex:1,minWidth:0,padding:12},statValue:{fontSize:20,fontWeight:'900',color:palette.ink},statLabel:{fontSize:11,color:palette.muted,marginTop:3},warning:{color:palette.warning},
  quick:{flexDirection:'row',gap:8,flexWrap:'wrap'},filter:{borderRadius:99,paddingHorizontal:12,paddingVertical:9,backgroundColor:'#ECEEF4'},filterActive:{backgroundColor:palette.primary},filterText:{fontSize:12,fontWeight:'800',color:palette.muted},filterTextActive:{color:'#FFF'},
  itemCard:{gap:8},cardEvent:{backgroundColor:'#EEF1FE',borderColor:'#C7D0FB',borderWidth:1},cardTask:{backgroundColor:'#FFF7E8',borderColor:'#F3DCA8',borderWidth:1},cardReminder:{backgroundColor:'#EAFBF3',borderColor:'#B9EAD4',borderWidth:1},
  itemHeader:{flexDirection:'row',alignItems:'flex-start',gap:8},task:{fontSize:19,lineHeight:24,fontWeight:'900',color:palette.ink},meta:{fontSize:13,lineHeight:18,color:palette.muted},description:{fontSize:14,lineHeight:20,color:palette.ink},
  manageButton:{backgroundColor:'#ECEEF4',borderRadius:12,paddingHorizontal:12,paddingVertical:8},manageButtonText:{fontSize:12,fontWeight:'900',color:palette.ink},
  flowOnlyTag:{alignSelf:'flex-start',backgroundColor:'#FDECEC',borderRadius:99,paddingHorizontal:10,paddingVertical:4},flowOnlyText:{fontSize:11,fontWeight:'900',color:'#A12626'},
  actions:{flexDirection:'row',gap:6,flexWrap:'nowrap'},
  secondaryAction:{flex:1,backgroundColor:'#ECEEF4',borderRadius:12,paddingVertical:10,alignItems:'center',justifyContent:'center'},secondaryActionText:{fontSize:12,fontWeight:'900',color:palette.ink,textAlign:'center'},
  primaryAction:{flex:1,backgroundColor:palette.primary,borderRadius:12,paddingVertical:10,alignItems:'center',justifyContent:'center'},primaryActionText:{fontSize:12,fontWeight:'900',color:'#FFF',textAlign:'center'},
});
