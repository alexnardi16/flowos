import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, Chip, EmptyState, ScreenShell, SectionTitle, palette } from '@/components/ui';
import { CommitmentSourceTag } from '@/components/CommitmentSourceTag';
import { ManageSheet } from '@/components/ManageSheet';
import { friendlyCalendarName, getGoogleWorkspaceStatus, type GoogleWorkspaceStatus } from '@/lib/googleWorkspace';
import { formatDurationLabel, isExpired } from '@/lib/itemTiming';
import { useFlowStore } from '@/lib/store';
import type { Commitment } from '@/types';
import { sortCommitments } from '@/lib/activityOrdering';
import { localeForLanguage, t, useLanguage } from '@/lib/i18n';
import { activitySourceColor, buildActivitySourceColors } from '@/lib/activityColors';
import { eventEnd, isCompletedMultiDayVisible } from '@/lib/commitmentVisibility';


function itemDate(item:Commitment){return item.scheduledAt??item.dueAt;}
function formatDateTime(item:Commitment,language:import('@/lib/i18n').Language){const value=itemDate(item);if(!value)return t('Data e ora non definite',undefined,language);const options={weekday:'short' as const,day:'2-digit' as const,month:'2-digit' as const,year:'numeric' as const};if(item.allDay){const d=new Date(value);return `${d.toLocaleDateString(localeForLanguage(language),{...options,timeZone:'UTC'})} · ${t('Tutto il giorno',undefined,language)}`;}const start=new Date(value);const end=new Date(start.getTime()+Math.max(1,item.durationMinutes||1)*60000);const date=(d:Date)=>d.toLocaleDateString(localeForLanguage(language),options);const time=(d:Date)=>d.toLocaleTimeString(localeForLanguage(language),{hour:'2-digit',minute:'2-digit'});return `${date(start)} · ${time(start)} - ${date(end)===date(start)?time(end):`${date(end)} · ${time(end)}`}`;}
function cardSourceStyle(item:Commitment,sourceColors:Map<string,string>){return {backgroundColor:activitySourceColor(item,sourceColors),borderColor:item.googleCalendarId||item.googleTaskListId?'#D9DDE7':'#E0E2E8',borderWidth:1};}
function searchable(item:Commitment){
  return[item.title,item.description,item.notes,item.location,item.context,item.outcome,item.kind].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}

export default function Plan(){
  const { language } = useLanguage();
  const commitments=useFlowStore(state=>state.commitments);
  const[query,setQuery]=useState('');
  const[manageId,setManageId]=useState<string|null>(null);
  const[now,setNow]=useState(()=>Date.now());
  const[google,setGoogle]=useState<GoogleWorkspaceStatus|null>(null);
  const scrollRef=useRef<import('react-native').ScrollView|null>(null);
  const didInitialScroll=useRef(false);
  const sourceColors=useMemo(()=>buildActivitySourceColors(commitments),[commitments]);

  useEffect(()=>{void getGoogleWorkspaceStatus().then(setGoogle).catch(()=>setGoogle(null));},[]);
  useEffect(()=>{const i=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(i);},[]);

  const items=useMemo(()=>{
    const normalized=query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return commitments.filter(item=>{
      const date=itemDate(item),completedMultiDay=isCompletedMultiDayVisible(item,new Date(now));
      if(date&&Number(date.slice(0,4))<new Date(now).getFullYear()&&!completedMultiDay)return false;
      return!normalized||searchable(item).includes(normalized);
    });
  },[commitments,query,now]);

  const overdueItems=items.filter(item=>item.status!=='done'&&isExpired(item));
  const calendarNames=new Map((google?.calendars??[]).map(calendar=>[calendar.google_calendar_id,friendlyCalendarName(calendar.summary,google?.connection?.google_email,language)]));
  const groupedItems=useMemo(()=>{
    const groups=new Map<string,{label:string;items:Commitment[]}>();
    for(const item of items){
      const completedMultiDay=isCompletedMultiDayVisible(item,new Date(now));
      const value=completedMultiDay?eventEnd(item)?.toISOString():itemDate(item);
      if(!value)continue;
      const date=new Date(value);
      const key=item.allDay
        ? `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`
        : `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      const label=item.allDay
        ? date.toLocaleDateString(localeForLanguage(language),{weekday:'long',day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'})
        : date.toLocaleDateString(localeForLanguage(language),{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
      const group=groups.get(key)??{label,items:[]};
      group.items.push(item);
      groups.set(key,group);
    }
    return Array.from(groups.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([key,group])=>({key,...group,items:sortCommitments(group.items,calendarNames)}));
  },[items,calendarNames]);
  const todayKey=(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;})();
  const initialScrollKey=groupedItems.find(group=>group.key>=todayKey)?.key??groupedItems[groupedItems.length-1]?.key;
  const manageItem=manageId?commitments.find(item=>item.id===manageId)??null:null;
  function formatStartEnd(item:Commitment,language:import('@/lib/i18n').Language){const value=itemDate(item);if(!value)return t('Data e ora non definite',undefined,language);const options={weekday:'short' as const,day:'2-digit' as const,month:'2-digit' as const,year:'numeric' as const};if(item.allDay){const date=new Date(value);return `${date.toLocaleDateString(localeForLanguage(language),{...options,timeZone:'UTC'})} · ${t('Tutto il giorno',undefined,language)}`;}const start=new Date(value);const end=new Date(start.getTime()+Math.max(1,item.durationMinutes||1)*60000);const date=(d:Date)=>d.toLocaleDateString(localeForLanguage(language),options);const time=(d:Date)=>d.toLocaleTimeString(localeForLanguage(language),{hour:'2-digit',minute:'2-digit'});return `${date(start)} · ${time(start)} - ${date(end)===date(start)?time(end):`${date(end)} · ${time(end)}`}`;}

  return <ScreenShell title={t('Lista')} scrollRef={scrollRef} scrollProps={{stickyHeaderIndices:[2]}}>
    <TextInput value={query} onChangeText={setQuery} placeholder={t('Cerca titolo, descrizione, luogo…')} placeholderTextColor={palette.muted} style={styles.search}/>
    {overdueItems.length?<Card style={styles.overdueCard}><View style={styles.overdueHeader}><Text style={styles.overdueTitle}>{t('Attività in ritardo')}</Text><Chip tone="warning">{overdueItems.length}</Chip></View>{overdueItems.map(item=><Pressable key={item.id} onPress={()=>setManageId(item.id)} style={styles.overdueItem}><View style={styles.titleRow}>{item.kind==='task'&&item.priority ? <Text style={styles.priorityBadge}>{item.priority}</Text> : null}<Text style={styles.overdueItemTitle}>{item.title}</Text></View><Text style={styles.overdueItemMeta}>{formatStartEnd(item,language)} · {item.kind==='event'?t('Evento'):t('Task')}</Text></Pressable>)}</Card>:null}
    <SectionTitle title={t('Elementi')} subtitle={t('Tocca una scheda per aprirla.')}/>
    {groupedItems.length?groupedItems.map(group=><View key={group.key} onLayout={event=>{if(group.key===initialScrollKey&&!didInitialScroll.current){didInitialScroll.current=true;const y=event.nativeEvent.layout.y;requestAnimationFrame(()=>scrollRef.current?.scrollTo({y:Math.max(0,y-8),animated:false}));}}} style={styles.dayGroup}>
      <View style={styles.dayDivider}><View style={styles.dayDividerLine}/><Text style={styles.dayDividerText}>{group.label}</Text><View style={styles.dayDividerLine}/></View>
      {group.items.map(item=>{
        const overdue=item.status!=='done'&&isExpired(item);
        return <Pressable key={item.id} onPress={()=>setManageId(item.id)} style={({pressed})=>pressed&&styles.cardPressed}>
          <Card style={[styles.itemCard,cardSourceStyle(item,sourceColors)]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow}>
              <Chip tone={item.status==='done'?'success':'primary'}>{item.kind==='event'?'EVENTO':item.status==='done'?'COMPLETATA':'TASK'}</Chip>
              <CommitmentSourceTag item={item} google={google}/>
            </ScrollView>
            <View style={styles.titleRow}>{item.kind==='task'&&item.priority ? <Text style={styles.priorityBadge}>{item.priority}</Text> : null}<Text style={styles.item}>{item.title}</Text></View>
            <Text style={[styles.date,overdue&&styles.warning]}>{formatDateTime(item,language)}{overdue?' · '+t('scaduta'):''}</Text>
            {item.description?<Text style={styles.description}>{item.description}</Text>:null}
            {item.location?<Text style={styles.meta}>{t('Luogo')}: {item.location}</Text>:null}
          </Card>
        </Pressable>;
      })}
    </View>):<EmptyState title={t('Nessun risultato')} message={t('Modifica i filtri oppure aggiungi un nuovo elemento.')}/>}
    {manageItem?<ManageSheet item={manageItem} onClose={()=>setManageId(null)}/>:null}
  </ScreenShell>;
}

const styles=StyleSheet.create({
  warning:{color:palette.warning},
  search:{backgroundColor:'#FFF',borderWidth:1,borderColor:palette.border,borderRadius:15,paddingHorizontal:15,paddingVertical:13,fontSize:15,color:palette.ink},
  overdueCard:{backgroundColor:'#FFF7E8',borderColor:'#F3DCA8',borderWidth:1,gap:8,padding:13},
  overdueHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  overdueTitle:{fontSize:16,fontWeight:'900',color:palette.ink},
  overdueItem:{paddingTop:6,borderTopWidth:1,borderTopColor:'#F3DCA8'},
  overdueItemTitle:{fontSize:15,fontWeight:'900',color:palette.ink},
  overdueItemMeta:{fontSize:12,lineHeight:16,fontWeight:'800',color:palette.primary,marginTop:1},dayGroup:{gap:4},dayDivider:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:6},dayDividerLine:{flex:1,height:1,backgroundColor:palette.border},dayDividerText:{fontSize:12,fontWeight:'900',color:palette.primary,textTransform:'capitalize'},
  itemCard:{padding:7,gap:2},
  tagRow:{alignItems:'center',gap:6,paddingRight:4},
  titleRow:{flexDirection:'row',alignItems:'flex-start',gap:7,minWidth:0},priorityBadge:{fontSize:12,lineHeight:18,fontWeight:'900',color:palette.primary,backgroundColor:palette.soft,borderRadius:8,paddingHorizontal:6},item:{flex:1,minWidth:0,flexShrink:1,fontSize:16,lineHeight:20,fontWeight:'900',color:palette.ink},
  date:{fontSize:13,lineHeight:17,fontWeight:'800',color:palette.primary},
  meta:{fontSize:12,lineHeight:16,color:palette.muted},
  description:{fontSize:12,lineHeight:16,color:palette.ink,marginTop:1},
  cardPressed:{opacity:.96,transform:[{scale:.995}]}
});