import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modal, Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActivityKindTag, Card, EmptyState, ScreenShell, SectionTitle, palette } from '@/components/ui';
import { QuickAddMenu } from '@/components/QuickAddMenu';
import { ProgressiveHint } from '@/components/ProgressiveHint';
import { CommitmentSourceTag } from '@/components/CommitmentSourceTag';
import { ManageSheet } from '@/components/ManageSheet';
import { friendlyCalendarName, getGoogleWorkspaceStatus, type GoogleWorkspaceStatus } from '@/lib/googleWorkspace';
import { formatDurationLabel } from '@/lib/itemTiming';
import { useFlowStore } from '@/lib/store';
import type { Commitment } from '@/types';
import { sortCommitments } from '@/lib/activityOrdering';
import { localeForLanguage, t, useLanguage } from '@/lib/i18n';
import { activitySourceColor, buildActivitySourceColors } from '@/lib/activityColors';
import { activityDayDates, isMultiDayActivity, isCompletedMultiDayEvent, isOverdueTask, isCompletedForDate } from '@/lib/commitmentVisibility';


function itemDate(item:Commitment){return item.scheduledAt??item.dueAt;}
function formatDateTime(item:Commitment,language:import('@/lib/i18n').Language){const value=itemDate(item);if(!value)return t('Data e ora non definite',undefined,language);const options={weekday:'short' as const,day:'2-digit' as const,month:'2-digit' as const,year:'numeric' as const};if(item.allDay){const d=new Date(value);return `${d.toLocaleDateString(localeForLanguage(language),{...options,timeZone:'UTC'})} · ${t('Tutto il giorno',undefined,language)}`;}const start=new Date(value);const end=new Date(start.getTime()+Math.max(1,item.durationMinutes||1)*60000);const date=(d:Date)=>d.toLocaleDateString(localeForLanguage(language),options);const time=(d:Date)=>d.toLocaleTimeString(localeForLanguage(language),{hour:'2-digit',minute:'2-digit'});return `${date(start)} · ${time(start)} - ${date(end)===date(start)?time(end):`${date(end)} · ${time(end)}`}`;}
function cardSourceStyle(item:Commitment,sourceColors:Map<string,string>){return {backgroundColor:activitySourceColor(item,sourceColors),borderColor:item.googleCalendarId||item.googleTaskListId?'#D9DDE7':'#E0E2E8',borderWidth:1};}
type ListFilters={order:'asc'|'desc';kind:'all'|'task'|'event';period:'all'|'past'|'future';status:'all'|'open'|'done'};
const LIST_FILTERS_KEY='flowos-list-filters-v1';
const DEFAULT_LIST_FILTERS:ListFilters={order:'asc',kind:'all',period:'all',status:'all'};
function localDateKey(item:Commitment){const value=itemDate(item);if(!value)return '';const d=new Date(value);const y=item.allDay?d.getUTCFullYear():d.getFullYear();const m=(item.allDay?d.getUTCMonth():d.getMonth())+1;const day=item.allDay?d.getUTCDate():d.getDate();return `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
function FilterOption({label,selected,onPress}:{label:string;selected:boolean;onPress:()=>void}){return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress} style={[styles.filterOption,selected&&styles.filterOptionSelected]}><Text style={[styles.filterOptionText,selected&&styles.filterOptionTextSelected]}>{label}</Text></Pressable>;}
function searchable(item:Commitment,sourceName=''){
  return[item.title,item.description,item.notes,item.location,item.context,item.outcome,item.kind,sourceName].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}

export default function Plan(){
  const { language } = useLanguage();
  const commitments=useFlowStore(state=>state.commitments);
  const[query,setQuery]=useState('');
  const[filters,setFilters]=useState<ListFilters>(DEFAULT_LIST_FILTERS);
  const[filtersReady,setFiltersReady]=useState(false);
  const[manageId,setManageId]=useState<string|null>(null);
  const[filtersExpanded,setFiltersExpanded]=useState(false);
  const[now,setNow]=useState(()=>Date.now());
  const[google,setGoogle]=useState<GoogleWorkspaceStatus|null>(null);
  const scrollRef=useRef<SectionList<Commitment,{key:string;label:string}>|null>(null);
  const didInitialScroll=useRef(false);
  const hasPlanFocused=useRef(false);
  const pendingTodayScroll=useRef(false);
  const sourceColors=useMemo(()=>buildActivitySourceColors(commitments),[commitments]);
  const nowDate=useMemo(()=>new Date(now),[now]);

  useEffect(()=>{void getGoogleWorkspaceStatus().then(setGoogle).catch(()=>setGoogle(null));},[]);
  useEffect(()=>{let active=true;void AsyncStorage.getItem(LIST_FILTERS_KEY).then(raw=>{if(!active||!raw)return;try{const saved=JSON.parse(raw) as Partial<ListFilters>;setFilters({...DEFAULT_LIST_FILTERS,...saved});}catch{/* Ignore invalid saved filter state. */}}).catch(()=>undefined).finally(()=>{if(active)setFiltersReady(true);});return()=>{active=false;};},[]);
  useEffect(()=>{if(filtersReady)void AsyncStorage.setItem(LIST_FILTERS_KEY,JSON.stringify(filters)).catch(()=>undefined);},[filters,filtersReady]);
  function setFilter<K extends keyof ListFilters>(key:K,value:ListFilters[K]){setFilters(current=>({...current,[key]:value}));}
  useEffect(()=>{const i=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(i);},[]);

  const todayKey=(()=>{const d=nowDate;return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;})();
  const calendarNameById=useMemo(()=>new Map((google?.calendars??[]).map(calendar=>[calendar.google_calendar_id,calendar.summary])),[google?.calendars]);
  const taskListNameById=useMemo(()=>new Map((google?.taskLists??[]).map(list=>[list.google_task_list_id,list.title])),[google?.taskLists]);
  const searchIndex=useMemo(()=>commitments.map(item=>{const sourceName=item.kind==='event'?calendarNameById.get(item.googleCalendarId??''):item.googleTaskListId?taskListNameById.get(item.googleTaskListId):'';return {item,text:searchable(item,sourceName??'')};}),[commitments,calendarNameById,taskListNameById]);
  const items=useMemo(()=>{
    const normalized=query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const filtered=searchIndex.filter(({item,text})=>{
      if(normalized&&!text.includes(normalized))return false;
      if(filters.kind!=='all'&&item.kind!==filters.kind)return false;
      if(filters.period!=='all'){
        const key=localDateKey(item);
        if(!key)return false;
        if(filters.period==='past'&&key>=todayKey)return false;
        if(filters.period==='future'&&key<todayKey)return false;
      }
      return true;
    }).map(entry=>entry.item);
    return filtered.sort((a,b)=>{
      const av=itemDate(a)?new Date(itemDate(a)!).getTime():Number.POSITIVE_INFINITY;
      const bv=itemDate(b)?new Date(itemDate(b)!).getTime():Number.POSITIVE_INFINITY;
      const diff=av-bv;
      return (filters.order==='asc'?diff:-diff)||a.title.localeCompare(b.title,language,{sensitivity:'base',numeric:true});
    });
  },[searchIndex,query,filters,todayKey,language]);

  const calendarNames=useMemo(()=>new Map((google?.calendars??[]).map(calendar=>[calendar.google_calendar_id,friendlyCalendarName(calendar.summary,google?.connection?.google_email,language)])),[google?.calendars,google?.connection?.google_email,language]);
  const groupedItems=useMemo(()=>{
    const groups=new Map<string,{label:string;items:Commitment[]}>();
    for(const item of items){
      const overdueTask=isOverdueTask(item,nowDate);
      const spansDays=!overdueTask&&isMultiDayActivity(item)&&(item.status!=='done'||(item.kind==='event'&&isCompletedMultiDayEvent(item)));
      const dates=spansDays?activityDayDates(item):[];
      const value=overdueTask?new Date(now).toISOString():itemDate(item);
      const dayDates=dates.length?dates:value?[new Date(value)]:[];
      for(const date of dayDates){
        const completedForDate=isCompletedForDate(item,date);
        if(filters.status==='done'&&!completedForDate)continue;
        if(filters.status==='open'&&completedForDate)continue;
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
    }
    return Array.from(groups.entries()).sort(([a],[b])=>filters.order==='asc'?a.localeCompare(b):b.localeCompare(a)).map(([key,group])=>({key,...group,items:group.items.sort((a,b)=>{const av=itemDate(a)?new Date(itemDate(a)!).getTime():Number.POSITIVE_INFINITY;const bv=itemDate(b)?new Date(itemDate(b)!).getTime():Number.POSITIVE_INFINITY;const byTime=filters.order==='asc'?av-bv:bv-av;return byTime || (sortCommitments([a,b],calendarNames)[0].id===a.id?-1:1);
        })
      }));

  },[items,calendarNames,nowDate,filters.order]);
  const todayGroupKey=useMemo(()=>{
    if(groupedItems.some(group=>group.key===todayKey))return todayKey;
    let future:string|undefined,past:string|undefined;
    for(const group of groupedItems){
      if(group.key>=todayKey&&(!future||group.key<future))future=group.key;
      if(group.key<todayKey&&(!past||group.key>past))past=group.key;
    }
    return future??past;
  },[groupedItems,todayKey]);
  const scrollToToday=useCallback(()=>{
    pendingTodayScroll.current=true;
    if(query.trim())setQuery('');
    if(filters.period!=='all')setFilters(current=>({...current,period:'all'}));
    if(!query.trim()&&filters.period==='all'&&todayGroupKey){
      const sectionIndex=groupedItems.findIndex(group=>group.key===todayGroupKey);
      if(sectionIndex>=0)requestAnimationFrame(()=>scrollRef.current?.scrollToLocation({sectionIndex,itemIndex:0,viewPosition:0,animated:false}));
      pendingTodayScroll.current=false;
    }
  },[query,filters.period,todayGroupKey,groupedItems]);
  useEffect(()=>{
    if(!pendingTodayScroll.current||!todayGroupKey)return;
    const sectionIndex=groupedItems.findIndex(group=>group.key===todayGroupKey);
    if(sectionIndex<0)return;
    requestAnimationFrame(()=>{
      scrollRef.current?.scrollToLocation({sectionIndex,itemIndex:0,viewPosition:0,animated:false});
      pendingTodayScroll.current=false;
      didInitialScroll.current=true;
    });
  },[groupedItems,todayGroupKey]);
  useFocusEffect(useCallback(()=>{
    if(!hasPlanFocused.current){
      hasPlanFocused.current=true;
      didInitialScroll.current=false;
      pendingTodayScroll.current=true;
      if(query.trim())setQuery('');
      if(filters.period!=='all')setFilters(current=>({...current,period:'all'}));
      if(!query.trim()&&filters.period==='all'&&todayGroupKey){
        const sectionIndex=groupedItems.findIndex(group=>group.key===todayGroupKey);
        if(sectionIndex>=0)requestAnimationFrame(()=>scrollRef.current?.scrollToLocation({sectionIndex,itemIndex:0,viewPosition:0,animated:false}));
        pendingTodayScroll.current=false;
      }
    }
  },[query,filters.period,todayGroupKey,groupedItems]));
  const manageItem=manageId?commitments.find(item=>item.id===manageId)??null:null;
  function formatStartEnd(item:Commitment,language:import('@/lib/i18n').Language){const value=itemDate(item);if(!value)return t('Data e ora non definite',undefined,language);const options={weekday:'short' as const,day:'2-digit' as const,month:'2-digit' as const,year:'numeric' as const};if(item.allDay){const date=new Date(value);return `${date.toLocaleDateString(localeForLanguage(language),{...options,timeZone:'UTC'})} · ${t('Tutto il giorno',undefined,language)}`;}const start=new Date(value);const end=new Date(start.getTime()+Math.max(1,item.durationMinutes||1)*60000);const date=(d:Date)=>d.toLocaleDateString(localeForLanguage(language),options);const time=(d:Date)=>d.toLocaleTimeString(localeForLanguage(language),{hour:'2-digit',minute:'2-digit'});return `${date(start)} · ${time(start)} - ${date(end)===date(start)?time(end):`${date(end)} · ${time(end)}`}`;}

  return <><ScreenShell title={t('Lista')} scrollable={false} headerActions={<View style={styles.searchRow}><TextInput value={query} onChangeText={setQuery} placeholder={t('Cerca')} placeholderTextColor={palette.muted} style={styles.search}/>{query.length>0?<Pressable accessibilityRole="button" accessibilityLabel={t('Cancella ricerca')} onPress={()=>setQuery('')} style={styles.clearSearch}><Text style={styles.clearSearchText}>×</Text></Pressable>:null}<Pressable accessibilityRole="button" accessibilityLabel={t('Filtri')} accessibilityState={{expanded:filtersExpanded}} onPress={()=>setFiltersExpanded(value=>!value)} style={styles.filterToggle}><Text style={styles.filterToggleText}>{t('Filtri')} · {Object.values(filters).filter((value,index)=>value!==(index===0?'asc':'all')).length}</Text></Pressable><Pressable accessibilityRole="button" onPress={scrollToToday} style={styles.todayButton}><Text style={styles.todayButtonText}>{t('Oggi')}</Text></Pressable><QuickAddMenu date={todayKey}/></View>}>
    <SectionList
      ref={scrollRef}
      style={{flex:1}}
      contentContainerStyle={{paddingHorizontal:20,paddingTop:14,paddingBottom:140,gap:8}}
      sections={groupedItems.map(group=>({key:group.key,label:group.label,data:group.items}))}
      keyExtractor={item=>item.id}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={<View><ProgressiveHint id="list-filters">{t('Suggerimento Lista: usa la ricerca e i filtri per trovare rapidamente attività e calendari di provenienza.')}</ProgressiveHint><SectionTitle title={t('Elementi')} subtitle={t('Tocca una scheda per aprirla.')}/></View>}
      ListEmptyComponent={<EmptyState title={t('Nessun risultato')} message={t(query.trim()?'Prova con un’altra ricerca oppure aggiungi un nuovo elemento per iniziare.')}/>}
      renderSectionHeader={({section})=><View style={styles.dayDivider}><View style={styles.dayDividerLine}/><View style={styles.dayDividerText}>{section.key===todayKey?<Text style={styles.todayGroupBadge}>{t('Oggi')}</Text>:null}<Text style={styles.groupWeekday}>{section.label}</Text></View><View style={styles.dayDividerLine}/></View>}
      renderItem={({item,section})=>{
        const overdue=isOverdueTask(item,nowDate);
        return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${t('Gestisci')}: ${item.title}`} onPress={()=>setManageId(item.id)} style={({pressed})=>pressed&&styles.cardPressed}>
          <Card style={[styles.itemCard,cardSourceStyle(item,sourceColors)]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow}>
              <ActivityKindTag kind={item.kind} completed={isCompletedForDate(item,new Date(`${section.key}T12:00:00`))}/>
              <CommitmentSourceTag item={item} google={google}/>
            </ScrollView>
            <View style={styles.titleRow}>{item.kind==='task'&&item.priority ? <Text style={styles.priorityBadge}>{item.priority}</Text> : null}<Text style={styles.item}>{item.title}</Text></View>
            <Text style={[styles.date,overdue&&styles.warning]}>{formatDateTime(item,language)}{overdue?' · '+t('Scaduta'):''}</Text>
            {item.kind==='task'&&!item.allDay?<Text style={styles.duration}>{t('Durata')}: {formatDurationLabel(item)}</Text>:null}
            {item.description?<Text style={styles.description}>{item.description}</Text>:null}
            {item.location?<Text style={styles.meta}>{t('Luogo')}: {item.location}</Text>:null}
          </Card>
        </Pressable>;
      }}
      onScrollToIndexFailed={({averageItemLength,index})=>scrollRef.current?.scrollToOffset({offset:averageItemLength*index,animated:false})}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews
    />
    {manageItem?<ManageSheet item={manageItem} onClose={()=>setManageId(null)}/>:null}
  </ScreenShell>
    <Modal visible={filtersExpanded} transparent animationType="slide" onRequestClose={()=>setFiltersExpanded(false)}>
      <View style={styles.filterModalRoot}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Chiudi filtri')} onPress={()=>setFiltersExpanded(false)} style={styles.filterBackdrop}/>
        <View style={styles.filtersCard}>
          <View style={styles.filterSheetHeader}><Text style={styles.filterSheetTitle}>{t('Filtri')}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('Chiudi filtri')} onPress={()=>setFiltersExpanded(false)} style={styles.filterSheetClose}><Text style={styles.filterSheetCloseText}>×</Text></Pressable></View>
          
      <View style={styles.filterRow}><Text style={styles.filterLabel}>{t('Ordina')}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterOptions}><FilterOption label={t('Cronologico')} selected={filters.order==='asc'} onPress={()=>setFilter('order','asc')}/><FilterOption label={t('Inverso')} selected={filters.order==='desc'} onPress={()=>setFilter('order','desc')}/></ScrollView></View>
      <View style={styles.filterRow}><Text style={styles.filterLabel}>{t('Tipo')}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterOptions}><FilterOption label={t('Entrambi')} selected={filters.kind==='all'} onPress={()=>setFilter('kind','all')}/><FilterOption label={t('Solo task')} selected={filters.kind==='task'} onPress={()=>setFilter('kind','task')}/><FilterOption label={t('Solo eventi')} selected={filters.kind==='event'} onPress={()=>setFilter('kind','event')}/></ScrollView></View>
      <View style={styles.filterRow}><Text style={styles.filterLabel}>{t('Periodo')}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterOptions}><FilterOption label={t('Tutte le date')} selected={filters.period==='all'} onPress={()=>setFilter('period','all')}/><FilterOption label={t('Passate')} selected={filters.period==='past'} onPress={()=>setFilter('period','past')}/><FilterOption label={t('Future')} selected={filters.period==='future'} onPress={()=>setFilter('period','future')}/></ScrollView></View>
      <View style={styles.filterRow}><Text style={styles.filterLabel}>{t('Stato attività')}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterOptions}><FilterOption label={t('Tutti gli stati')} selected={filters.status==='all'} onPress={()=>setFilter('status','all')}/><FilterOption label={t('Da fare')} selected={filters.status==='open'} onPress={()=>setFilter('status','open')}/><FilterOption label={t('Completate')} selected={filters.status==='done'} onPress={()=>setFilter('status','done')}/></ScrollView></View>
    
          <View style={styles.filterSheetFooter}>
            <Pressable accessibilityRole="button" onPress={()=>{setFilter('order','asc');setFilter('kind','all');setFilter('period','all');setFilter('status','all');}} style={styles.filterReset}><Text style={styles.filterResetText}>{t('Azzera filtri')}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={()=>setFiltersExpanded(false)} style={styles.filterApply}><Text style={styles.filterApplyText}>{t('Mostra risultati')}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </>;
}

const styles=StyleSheet.create({
  warning:{color:palette.warning},
  filtersCard:{padding:18,paddingBottom:28,marginBottom:42,gap:14,borderTopLeftRadius:22,borderTopRightRadius:22,backgroundColor:palette.card,borderWidth:1,borderColor:palette.border},filterModalRoot:{flex:1,justifyContent:'flex-end'},filterBackdrop:{...StyleSheet.absoluteFill,backgroundColor:'rgba(10,14,25,0.45)'},filterSheetHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},filterSheetTitle:{fontSize:18,fontWeight:'700',color:palette.ink},filterSheetClose:{width:40,height:40,alignItems:'center',justifyContent:'center'},filterSheetCloseText:{fontSize:28,color:palette.muted},filterSheetFooter:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,marginTop:8},filterReset:{minHeight:44,justifyContent:'center',paddingHorizontal:10},filterResetText:{fontSize:13,fontWeight:'700',color:palette.muted},filterApply:{minHeight:44,borderRadius:12,backgroundColor:palette.primary,justifyContent:'center',paddingHorizontal:18},filterApplyText:{fontSize:13,fontWeight:'700',color:'#FFFFFF'},filterRow:{flexDirection:'row',alignItems:'center',gap:6,minHeight:34},filterLabel:{width:74,fontSize:11,fontWeight:'700',color:palette.muted},filterOptions:{alignItems:'center',gap:6,paddingRight:4},filterOption:{borderRadius:99,paddingHorizontal:10,paddingVertical:7,backgroundColor:palette.soft,borderWidth:1,borderColor:palette.border},filterOptionSelected:{backgroundColor:palette.soft,borderColor:palette.primary},filterOptionText:{fontSize:11,fontWeight:'700',color:palette.muted},filterOptionTextSelected:{color:palette.primary},
  searchRow:{flexDirection:'row',alignItems:'center',gap:6},
  clearSearch:{width:32,height:44,alignItems:'center',justifyContent:'center'},clearSearchText:{fontSize:24,lineHeight:28,color:palette.muted},
  filterToggle:{minHeight:44,paddingHorizontal:10,borderRadius:12,backgroundColor:palette.soft,alignItems:'center',justifyContent:'center'},filterToggleText:{fontSize:11,fontWeight:'700',color:palette.primary},
  search:{flex:1,minWidth:0,backgroundColor:palette.card,borderWidth:1,borderColor:palette.border,borderRadius:15,paddingHorizontal:15,paddingVertical:13,fontSize:15,color:palette.ink},
  todayButton:{backgroundColor:palette.primary,borderRadius:13,paddingHorizontal:15,paddingVertical:13,justifyContent:'center',alignItems:'center'},
  todayButtonText:{color:'#FFF',fontSize:14,fontWeight:'700'},
dayGroup:{gap:4},dayDivider:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:8},dayDividerLine:{flex:1,height:1,backgroundColor:palette.border},dayDividerText:{flexDirection:'row',alignItems:'center',gap:9,fontSize:13,fontWeight:'700',color:palette.ink,textTransform:'capitalize'},todayGroupLabel:{color:palette.primary},todayGroupBadge:{fontSize:10,fontWeight:'800',color:'#FFFFFF',backgroundColor:palette.primary,borderRadius:6,overflow:'hidden',paddingHorizontal:5,paddingVertical:2,marginRight:9},groupWeekday:{fontWeight:'800'},
  itemCard:{padding:7,gap:2},
  tagRow:{alignItems:'center',gap:6,paddingRight:4},
  titleRow:{flexDirection:'row',alignItems:'flex-start',gap:7,minWidth:0},priorityBadge:{fontSize:12,lineHeight:18,fontWeight:'700',color:palette.primary,backgroundColor:palette.soft,borderRadius:8,paddingHorizontal:6},item:{flex:1,minWidth:0,flexShrink:1,fontSize:16,lineHeight:20,fontWeight:'700',color:palette.ink},
  date:{fontSize:13,lineHeight:17,fontWeight:'700',color:palette.primary},duration:{fontSize:12,lineHeight:15,fontWeight:'700',color:palette.muted},
  meta:{fontSize:12,lineHeight:16,color:palette.muted},
  description:{fontSize:12,lineHeight:16,color:palette.ink,marginTop:1},
  cardPressed:{opacity:.96,transform:[{scale:.995}]}
});