import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Modal, ScrollView, type GestureResponderEvent } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, ScreenShell, palette } from '@/components/ui';
import { QuickAddMenu } from '@/components/QuickAddMenu';
import { ProgressiveHint } from '@/components/ProgressiveHint';
import { ManageSheet } from '@/components/ManageSheet';
import { friendlyCalendarName, getGoogleWorkspaceStatus, type GoogleWorkspaceStatus } from '@/lib/googleWorkspace';
import { useFlowStore } from '@/lib/store';
import type { Commitment } from '@/types';
import { sortCommitments } from '@/lib/activityOrdering';
import { localeForLanguage, t, useLanguage, widgetStrings } from '@/lib/i18n';
import { activitySourceColor, buildActivitySourceColors } from '@/lib/activityColors';
import { isVisibleCompletedMultiDayForDate, isOverdueTask, activityDayDates, isMultiDayActivity } from '@/lib/commitmentVisibility';
import { buildCalendarTimeline } from '@/lib/calendarTimeline';
import { formatDurationLabel } from '@/lib/itemTiming';

function dayKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function itemDate(item:Commitment){return item.scheduledAt??item.dueAt;}
function multiDaySegment(item:Commitment,date:Date){
  if(item.kind!=='event'||!isMultiDayActivity(item))return 'single';
  const keyFor=(value:Date)=>item.allDay?`${value.getUTCFullYear()}-${String(value.getUTCMonth()+1).padStart(2,'0')}-${String(value.getUTCDate()).padStart(2,'0')}`:dayKey(value);
  const dates=activityDayDates(item);const current=keyFor(date);const first=keyFor(dates[0]);const last=keyFor(dates[dates.length-1]);
  return current===first?'start':current===last?'end':'middle';
}
function formatItemTime(item:Commitment,language:import('@/lib/i18n').Language){
  if(item.allDay)return '';
  const value=itemDate(item);if(!value)return '';
  const start=new Date(value);
  const startText=start.toLocaleTimeString(localeForLanguage(language),{hour:'2-digit',minute:'2-digit'});
  if(!item.durationMinutes)return startText;
  const end=new Date(start.getTime()+item.durationMinutes*60000);
  return `${startText} - ${end.toLocaleTimeString(localeForLanguage(language),{hour:'2-digit',minute:'2-digit'})}`;
}
function monthLabelForWeek(week:Date[],weekIndex:number,months:string[]){const firstDay=week.find(day=>day.getDate()===1);if(firstDay)return `${months[firstDay.getMonth()]} ${firstDay.getFullYear()}`;if(weekIndex===0&&week[0])return `${months[week[0].getMonth()]} ${week[0].getFullYear()}`;return '';}
function sourceStyle(item:Commitment,sourceColors:Map<string,string>){return {backgroundColor:activitySourceColor(item,sourceColors),borderColor:item.googleCalendarId||item.googleTaskListId?'#D9DDE7':'#E0E2E8'};}

export default function Calendar(){
  const { language } = useLanguage();
  const commitments=useFlowStore(state=>state.commitments); const syncWithGoogle=useFlowStore(state=>state.syncWithGoogle);
  const[manageId,setManageId]=useState<string|null>(null);const[showDatePicker,setShowDatePicker]=useState(false);const[pickerMonth,setPickerMonth]=useState(()=>new Date());
  const[selectedDateOverride,setSelectedDateOverride]=useState<string|null>(null);
  const[google,setGoogle]=useState<GoogleWorkspaceStatus|null>(null);
  const params=useLocalSearchParams<{widgetAction?:string;date?:string;id?:string}>();
  const scrollRef=useRef<import('react-native').ScrollView|null>(null);
  const weekOffsets=useRef(new Map<number,number>());
  const swipeStart=useRef<{x:number;y:number}|null>(null);
  const hasCalendarFocused=useRef(false);

  useEffect(()=>{void getGoogleWorkspaceStatus().then(setGoogle).catch(()=>setGoogle(null));},[]);
  useEffect(()=>{const action=typeof params.widgetAction==='string'?params.widgetAction:undefined;const id=typeof params.id==='string'?params.id:null;if(action==='sync')void syncWithGoogle();if(action==='manage'&&id) setManageId(id);},[params.widgetAction,params.id,syncWithGoogle]);

  const weeks=useMemo(()=>{
    const now=new Date();
    const syncEnd=google?.range?.endDate?new Date(`${google.range.endDate}T23:59:59`):new Date(now.getFullYear()+1,11,31);
    return buildCalendarTimeline(commitments,syncEnd,now).weeks;
  },[commitments,google]);

  const sourceColors=useMemo(()=>buildActivitySourceColors(commitments),[commitments]);
  const calendarNames=useMemo(()=>new Map((google?.calendars??[]).map(calendar=>[calendar.google_calendar_id,friendlyCalendarName(calendar.summary,google?.connection?.google_email,language)])),[google?.calendars,google?.connection?.google_email,language]);

  const byDay=useMemo(()=>{
    const map=new Map<string,Commitment[]>();
    for(const item of commitments.filter(item=>!item.deletedAt&&item.status!=='done')){
      const overdueTask=isOverdueTask(item);
      const value=overdueTask?new Date().toISOString():itemDate(item);if(!value)continue;
      const d=new Date(value);
      const dates=!overdueTask&&isMultiDayActivity(item)?activityDayDates(item):[d];
      for(const date of dates){
        const key=item.allDay?`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`:dayKey(date);
        const list=map.get(key)??[];list.push(item);map.set(key,list);
      }
    }
    for(const item of commitments.filter(item=>!item.deletedAt&&item.status==='done')){
      const end=item.scheduledAt&&item.durationMinutes?new Date(new Date(item.scheduledAt).getTime()+Math.max(1,item.durationMinutes)*60000):null;
      if(!end||item.durationMinutes<=24*60)continue;
      if(!isVisibleCompletedMultiDayForDate(item,end))continue;
      for(const date of activityDayDates(item)){
        const key=dayKey(date);
        const list=map.get(key)??[];list.push(item);map.set(key,list);
      }
    }
    return map;
  },[commitments]);

  const sortedByDay=useMemo(()=>{
    const result=new Map<string,Commitment[]>();
    for(const [key,items] of byDay){const ordered=sortCommitments(items,calendarNames);ordered.sort((a,b)=>Number(b.kind==='event'&&isMultiDayActivity(b))-Number(a.kind==='event'&&isMultiDayActivity(a)));result.set(key,ordered);}
    return result;
  },[byDay,calendarNames]);

  const manageItem=manageId?commitments.find(item=>item.id===manageId)??null:null;
  const requestedDate=typeof params.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(params.date)?params.date:null;
  const selectedDateKey=selectedDateOverride??requestedDate??dayKey(new Date());
  const selectedWeekIndex=weeks.findIndex(week=>week.some(date=>dayKey(date)===selectedDateKey));
  const scrollToSelectedWeek=useCallback(()=>{if(selectedWeekIndex<0)return;const offset=weekOffsets.current.get(selectedWeekIndex);if(offset===undefined)return;requestAnimationFrame(()=>scrollRef.current?.scrollTo({y:Math.max(0,offset-8),animated:false}));},[selectedWeekIndex]);
  useFocusEffect(useCallback(()=>{if(!hasCalendarFocused.current){if(!requestedDate)setSelectedDateOverride(dayKey(new Date()));hasCalendarFocused.current=true;}requestAnimationFrame(()=>scrollToSelectedWeek());},[requestedDate,scrollToSelectedWeek]));
  const goToToday=useCallback(()=>{setSelectedDateOverride(dayKey(new Date()));scrollToSelectedWeek();},[scrollToSelectedWeek]);
  const moveSelectedDay=useCallback((delta:number)=>{const current=new Date(`${selectedDateKey}T12:00:00`);current.setDate(current.getDate()+delta);setSelectedDateOverride(dayKey(current));},[selectedDateKey]);
  const handleCalendarTouchStart=useCallback((event:GestureResponderEvent)=>{swipeStart.current={x:event.nativeEvent.pageX,y:event.nativeEvent.pageY};},[]);
  const handleCalendarTouchEnd=useCallback((event:GestureResponderEvent)=>{const start=swipeStart.current;swipeStart.current=null;if(!start)return;const deltaX=event.nativeEvent.pageX-start.x;const deltaY=event.nativeEvent.pageY-start.y;if(Math.abs(deltaX)>65&&Math.abs(deltaX)>Math.abs(deltaY)*1.3)moveSelectedDay(deltaX<0?7:-7);},[moveSelectedDay]);
  useEffect(()=>{scrollToSelectedWeek();},[scrollToSelectedWeek,selectedDateKey]);

  const strings=widgetStrings(language);

  return <ScreenShell title={t('Calendario')} scrollRef={scrollRef} scrollProps={{onTouchStart:handleCalendarTouchStart,onTouchEnd:handleCalendarTouchEnd}} headerActions={<View style={styles.todayRow}><Pressable accessibilityRole="button" accessibilityLabel={t('Settimana precedente')} onPress={()=>moveSelectedDay(-7)} style={styles.navButton}><Ionicons name="chevron-back" size={19} color={palette.primary}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel={t('Seleziona mese e anno')} onPress={()=>{setPickerMonth(new Date(`${selectedDateKey}T12:00:00`));setShowDatePicker(true);}} style={styles.monthButton}><Ionicons name="calendar-outline" size={14} color={palette.primary}/><Text style={styles.monthButtonText}>{new Date(`${selectedDateKey}T12:00:00`).toLocaleDateString(localeForLanguage(language),{month:'short',year:'numeric'})}</Text></Pressable><Pressable accessibilityRole="button" onPress={goToToday} style={styles.todayButton}><Text style={styles.todayButtonText}>{t('Oggi')}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={t('Settimana successiva')} onPress={()=>moveSelectedDay(7)} style={styles.navButton}><Ionicons name="chevron-forward" size={19} color={palette.primary}/></Pressable><QuickAddMenu date={selectedDateKey} compact/></View>}>
    <ProgressiveHint id="calendar-navigation">{t('Suggerimento Calendario: seleziona un giorno, usa le frecce per spostarti e crea un elemento già associato alla data selezionata.')}</ProgressiveHint>
    {weeks.map((week,index)=>{
      const monthTitle=monthLabelForWeek(week,index,strings.months);
      return <Card key={index} style={styles.weekCard} onLayout={(event)=>{weekOffsets.current.set(index,event.nativeEvent.layout.y);if(index===selectedWeekIndex)scrollToSelectedWeek();}}>
        {monthTitle?<Text style={styles.monthTitle}>{monthTitle}</Text>:null}
        <View style={styles.grid}>
          {week.map((date,dayIndex)=>{
            const items=sortedByDay.get(dayKey(date))??[];
            const today=dayKey(date)===dayKey(new Date());
            const selected=dayKey(date)===selectedDateKey;
            return <View key={date.toISOString()} style={[styles.dayBox,today&&styles.todayBox,selected&&styles.selectedBox]}>
              <View style={styles.dayHeader}>
                <Text style={[styles.dayName,today&&styles.todayText]}>{strings.dayNames[dayIndex]}</Text>
                <Text style={[styles.dayNumber,today&&styles.todayText]}>{date.getDate()}</Text>
              </View>
              <View style={styles.dayActivities}>
                {items.map(item=>{const segment=multiDaySegment(item,date);return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${t('Gestisci')}: ${item.title}`} onPress={()=>setManageId(item.id)} style={({pressed})=>[styles.item,sourceStyle(item,sourceColors),segment==='start'&&styles.multiDayStart,segment==='middle'&&styles.multiDayMiddle,segment==='end'&&styles.multiDayEnd,pressed&&styles.itemPressed]}>
                  {segment==='start'||segment==='single'?<>
                  {formatItemTime(item,language) ? <Text style={styles.itemTime}>{formatItemTime(item,language)}</Text> : null}
                  {item.kind==='task'&&!item.allDay?<Text style={styles.itemDuration}>{t('Durata')}: {formatDurationLabel(item)}</Text>:null}
                  {isOverdueTask(item) ? <Text style={styles.overdueTag}>{t('Scaduta')}</Text> : null}
                  <View style={styles.itemTitleRow}>{item.kind==='task'&&item.priority ? <Text style={styles.itemPriority}>{item.priority}</Text> : null}<Ionicons name={item.kind==='event'?'calendar-outline':'checkbox-outline'} size={8} color={palette.primary}/><Text style={styles.itemTitle}>{item.title}</Text></View>
                  {item.location?<View style={styles.itemTitleRow}><Ionicons name="location-outline" size={8} color={palette.muted}/><Text style={styles.itemMeta}>{item.location}</Text></View>:null}
                  </>:null}
                </Pressable>;})}
              </View>
            </View>;
          })}
        </View>
      </Card>;
    })}
    <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={()=>setShowDatePicker(false)}>
      <View style={styles.datePickerBackdrop}>
        <View style={styles.datePickerCard}>
          <View style={styles.datePickerHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('Mese precedente')} onPress={()=>setPickerMonth(current=>new Date(current.getFullYear(),current.getMonth()-1,1))} style={styles.datePickerNav}><Ionicons name="chevron-back" size={20} color={palette.primary}/></Pressable>
            <Text style={styles.datePickerTitle}>{pickerMonth.toLocaleDateString(localeForLanguage(language),{month:'long',year:'numeric'})}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('Mese successivo')} onPress={()=>setPickerMonth(current=>new Date(current.getFullYear(),current.getMonth()+1,1))} style={styles.datePickerNav}><Ionicons name="chevron-forward" size={20} color={palette.primary}/></Pressable>
          </View>
          <View style={styles.datePickerWeek}>{['L','M','M','G','V','S','D'].map((day,index)=><Text key={index} style={styles.datePickerWeekday}>{day}</Text>)}</View>
          <View style={styles.datePickerGrid}>
            {Array.from({length:(new Date(pickerMonth.getFullYear(),pickerMonth.getMonth(),1).getDay()+6)%7},(_,index)=><View key={'blank-'+index} style={styles.datePickerDay}/>)}
            {Array.from({length:new Date(pickerMonth.getFullYear(),pickerMonth.getMonth()+1,0).getDate()},(_,index)=>{const date=new Date(pickerMonth.getFullYear(),pickerMonth.getMonth(),index+1);const key=dayKey(date);const selected=key===selectedDateKey;const today=key===dayKey(new Date());return <Pressable key={key} accessibilityRole="button" accessibilityLabel={date.toLocaleDateString(localeForLanguage(language))} accessibilityState={{selected}} onPress={()=>{setSelectedDateOverride(key);setShowDatePicker(false);}} style={[styles.datePickerDay,selected&&styles.datePickerDaySelected,today&&styles.datePickerDayToday]}><Text style={[styles.datePickerDayText,selected&&styles.datePickerDayTextSelected]}>{index+1}</Text></Pressable>;})}
          </View>
          <View style={styles.datePickerActions}>
            <Pressable accessibilityRole="button" onPress={()=>{setSelectedDateOverride(dayKey(new Date()));setShowDatePicker(false);}} style={styles.datePickerToday}><Text style={styles.datePickerTodayText}>{t('Oggi')}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={()=>setShowDatePicker(false)} style={styles.datePickerCancel}><Text style={styles.datePickerCancelText}>{t('Annulla')}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
    {manageItem?<ManageSheet item={manageItem} onClose={()=>setManageId(null)}/>:null}
  </ScreenShell>;
}

const styles=StyleSheet.create({
  todayRow:{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:6},
  datePickerBackdrop:{flex:1,backgroundColor:'rgba(12,16,28,0.48)',justifyContent:'center',alignItems:'center',padding:20},
  datePickerCard:{width:'100%',maxWidth:360,borderRadius:22,padding:16,backgroundColor:palette.card,gap:12},
  datePickerHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  datePickerTitle:{fontSize:17,fontWeight:'800',color:palette.ink,textTransform:'capitalize'},
  datePickerNav:{width:44,height:44,borderRadius:12,backgroundColor:palette.soft,alignItems:'center',justifyContent:'center'},
  datePickerWeek:{flexDirection:'row'},datePickerWeekday:{width:'14.2857%',textAlign:'center',fontSize:12,fontWeight:'700',color:palette.muted,paddingVertical:6},
  datePickerGrid:{flexDirection:'row',flexWrap:'wrap'},
  datePickerDay:{width:'14.2857%',aspectRatio:1,alignItems:'center',justifyContent:'center',borderRadius:12},
  datePickerDaySelected:{backgroundColor:palette.primary},datePickerDayToday:{borderWidth:1,borderColor:palette.primary},
  datePickerDayText:{fontSize:14,fontWeight:'600',color:palette.ink},datePickerDayTextSelected:{color:'#FFFFFF',fontWeight:'800'},
  datePickerActions:{flexDirection:'row',justifyContent:'flex-end',gap:8},
  datePickerToday:{minHeight:40,paddingHorizontal:14,borderRadius:11,backgroundColor:palette.soft,justifyContent:'center'},datePickerTodayText:{color:palette.primary,fontWeight:'700'},
  datePickerCancel:{minHeight:40,paddingHorizontal:14,borderRadius:11,justifyContent:'center'},datePickerCancelText:{color:palette.muted,fontWeight:'700'},monthButton:{minHeight:44,paddingHorizontal:9,borderRadius:12,borderWidth:1,borderColor:palette.border,backgroundColor:palette.soft,flexDirection:'row',alignItems:'center',gap:5},monthButtonText:{fontSize:12,fontWeight:'700',color:palette.ink},
  todayButton:{backgroundColor:palette.primary,borderRadius:13,paddingHorizontal:16,paddingVertical:10,minHeight:44,justifyContent:'center'},
  navButton:{width:44,height:44,borderRadius:13,backgroundColor:palette.soft,alignItems:'center',justifyContent:'center'},navButtonText:{fontSize:26,lineHeight:30,fontWeight:'600',color:palette.primary},
  todayButtonText:{color:'#FFF',fontSize:14,fontWeight:'700'},
  weekCard:{padding:5,gap:3},
  monthTitle:{fontSize:18,lineHeight:22,fontWeight:'700',color:palette.primary,textTransform:'capitalize',paddingHorizontal:2},
  grid:{flexDirection:'row',gap:2,width:'100%'},
  dayBox:{flex:1,minWidth:0,minHeight:175,padding:2,borderRadius:7,borderWidth:1,borderColor:palette.border,backgroundColor:palette.card},
  todayBox:{backgroundColor:palette.soft,borderColor:'#BDB4F2'},
  selectedBox:{borderColor:palette.primary,borderWidth:2,backgroundColor:palette.card},
  dayHeader:{flexDirection:'row',alignItems:'center',gap:2,paddingBottom:3,borderBottomWidth:1,borderBottomColor:'#EEF0F5'},
  dayName:{fontSize:10,fontWeight:'700',color:palette.ink},
  dayNumber:{fontSize:15,lineHeight:17,fontWeight:'700',color:palette.ink},
  todayText:{color:palette.primary},
  dayActivities:{gap:2,paddingTop:3},
  item:{borderRadius:5,padding:2,borderWidth:1,gap:0},multiDayStart:{borderTopRightRadius:0,borderBottomRightRadius:0,marginRight:-2},multiDayMiddle:{borderRadius:0,marginHorizontal:-2},multiDayEnd:{borderTopLeftRadius:0,borderBottomLeftRadius:0,marginLeft:-2},
  itemTime:{fontSize:5,lineHeight:8,fontWeight:'700',color:palette.muted},itemDuration:{fontSize:5,lineHeight:7,fontWeight:'600',color:palette.muted},
  overdueTag:{fontSize:5,lineHeight:7,fontWeight:'700',color:palette.warning},
  itemTitleRow:{flexDirection:'row',alignItems:'flex-start',gap:2,minWidth:0},itemPriority:{fontSize:5,lineHeight:7,fontWeight:'700',color:palette.primary},itemTitle:{flex:1,minWidth:0,flexShrink:1,fontSize:6,lineHeight:8,fontWeight:'700',color:palette.ink},
  itemMeta:{fontSize:6,lineHeight:8,color:palette.muted},
  itemPressed:{opacity:.78}
});
