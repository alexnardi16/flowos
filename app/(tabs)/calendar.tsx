import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, ScreenShell, palette } from '@/components/ui';
import { ManageSheet } from '@/components/ManageSheet';
import { friendlyCalendarName, getGoogleWorkspaceStatus, type GoogleWorkspaceStatus } from '@/lib/googleWorkspace';
import { useFlowStore } from '@/lib/store';
import type { Commitment } from '@/types';
import { sortCommitmentsAlphabetically } from '@/lib/activityOrdering';

const DAY_NAMES=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
const MONTH_NAMES=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const SOURCE_COLORS=['#E8F0FF','#E9F8EF','#FFF0D9','#F3E9FF','#FFE8EE','#E7F6F5','#F1F1E8','#EDEAFF'];

function dayKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function itemDate(item:Commitment){return item.scheduledAt??item.dueAt;}
function formatItemTime(item:Commitment){
  if(item.allDay)return '';
  const value=itemDate(item);if(!value)return '';
  const start=new Date(value);
  const startText=start.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  if(!item.scheduledAt||!item.durationMinutes)return startText;
  const end=new Date(start.getTime()+item.durationMinutes*60000);
  return `${startText} - ${end.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`;
}
function monthLabelForWeek(week:Date[],weekIndex:number){if(weekIndex===0){const now=new Date();return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;}const firstDay=week.find(day=>day.getDate()===1);return firstDay?`${MONTH_NAMES[firstDay.getMonth()]} ${firstDay.getFullYear()}`:'';}
function sourceKey(item:Commitment){if(item.kind==='task'&&item.googleTaskListId)return `task:${item.googleTaskListId}`;if(item.googleCalendarId)return `calendar:${item.googleCalendarId}`;return 'flowos';}
function sourceStyle(item:Commitment,sourceColors:Map<string,string>){
  const key=sourceKey(item);
  if(key==='flowos')return styles.flowosItem;
  return {backgroundColor:sourceColors.get(key)??SOURCE_COLORS[0],borderColor:'#D9DDE7'};
}

export default function Calendar(){
  const commitments=useFlowStore(state=>state.commitments); const syncWithGoogle=useFlowStore(state=>state.syncWithGoogle);
  const[manageId,setManageId]=useState<string|null>(null);
  const[google,setGoogle]=useState<GoogleWorkspaceStatus|null>(null);
  const params=useLocalSearchParams<{widgetAction?:string;date?:string}>();
  const scrollRef=useRef<import('react-native').ScrollView|null>(null);
  const weekOffsets=useRef(new Map<number,number>());

  useEffect(()=>{void getGoogleWorkspaceStatus().then(setGoogle).catch(()=>setGoogle(null));},[]);
  useEffect(()=>{const action=typeof params.widgetAction==='string'?params.widgetAction:undefined;if(action==='sync')void syncWithGoogle();},[params.widgetAction,syncWithGoogle]);

  const weeks=useMemo(()=>{
    const now=new Date();
    const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
    const end=google?.range?.endDate?new Date(`${google.range.endDate}T23:59:59`):new Date(now.getFullYear()+1,11,31);
    const result:Date[][]=[];
    for(let i=0;;i+=1){
      const start=new Date(monday);start.setDate(monday.getDate()+i*7);
      if(start.getTime()>end.getTime())break;
      result.push(Array.from({length:7},(_,j)=>{const d=new Date(start);d.setDate(start.getDate()+j);return d;}));
    }
    return result;
  },[google]);

  const sourceColors=useMemo(()=>{
    const map=new Map<string,string>();let next=0;
    for(const item of commitments.filter(item=>!item.deletedAt&&item.status!=='done')){
      const key=sourceKey(item);if(key==='flowos'||map.has(key))continue;
      map.set(key,SOURCE_COLORS[next%SOURCE_COLORS.length]);next+=1;
    }
    return map;
  },[commitments]);

  const byDay=useMemo(()=>{
    const map=new Map<string,Commitment[]>();
    for(const item of commitments.filter(item=>!item.deletedAt&&item.status!=='done')){
      const value=itemDate(item);if(!value)continue;
      const d=new Date(value);
      const key=item.allDay?`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`:dayKey(d);
      const list=map.get(key)??[];list.push(item);map.set(key,list);
    }
    for(const [key,list] of map) map.set(key,sortCommitmentsAlphabetically(list));
    return map;
  },[commitments]);

  const manageItem=manageId?commitments.find(item=>item.id===manageId)??null:null;
  const requestedDate=typeof params.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(params.date)?params.date:null;
  const selectedDateKey=requestedDate??dayKey(new Date());
  const selectedWeekIndex=weeks.findIndex(week=>week.some(date=>dayKey(date)===selectedDateKey));
  const scrollToSelectedWeek=useCallback(()=>{if(selectedWeekIndex<0)return;const offset=weekOffsets.current.get(selectedWeekIndex);if(offset===undefined)return;requestAnimationFrame(()=>scrollRef.current?.scrollTo({y:Math.max(0,offset-8),animated:false}));},[selectedWeekIndex]);
  useEffect(()=>{scrollToSelectedWeek();},[scrollToSelectedWeek,selectedDateKey]);

  return <ScreenShell title="Calendario" subtitle="Vista mensile in stile Google Calendar. Ogni settimana mostra sempre tutti e sette i giorni." scrollRef={scrollRef}>
    {weeks.map((week,index)=>{
      const monthTitle=monthLabelForWeek(week,index);
      return <Card key={index} style={styles.weekCard} onLayout={(event)=>{weekOffsets.current.set(index,event.nativeEvent.layout.y);if(index===selectedWeekIndex)scrollToSelectedWeek();}}>
        {monthTitle?<Text style={styles.monthTitle}>{monthTitle}</Text>:null}
        <View style={styles.grid}>
          {week.map((date,dayIndex)=>{
            const items=sortCommitments(byDay.get(dayKey(date))??[],new Map((google?.calendars??[]).map(calendar=>[calendar.google_calendar_id,friendlyCalendarName(calendar.summary,google?.connection?.google_email)])));
            const today=dayKey(date)===dayKey(new Date());
            const selected=dayKey(date)===selectedDateKey;
            return <View key={date.toISOString()} style={[styles.dayBox,today&&styles.todayBox,selected&&styles.selectedBox]}>
              <View style={styles.dayHeader}>
                <Text style={[styles.dayName,today&&styles.todayText]}>{DAY_NAMES[dayIndex]}</Text>
                <Text style={[styles.dayNumber,today&&styles.todayText]}>{date.getDate()}</Text>
              </View>
              <View style={styles.dayActivities}>
                {items.map(item=><Pressable key={item.id} onPress={()=>setManageId(item.id)} style={({pressed})=>[styles.item,sourceStyle(item,sourceColors),pressed&&styles.itemPressed]}>
                  {formatItemTime(item) ? <Text style={styles.itemTime}>{formatItemTime(item)}</Text> : null}
                  <View style={styles.itemTitleRow}>{item.kind==='task'&&item.priority ? <Text style={styles.itemPriority}>{item.priority}</Text> : null}<Text style={styles.itemTitle}>{item.title}</Text></View>
                  {item.location?<Text style={styles.itemMeta}>📍 {item.location}</Text>:null}
                </Pressable>)}
              </View>
            </View>;
          })}
        </View>
      </Card>;
    })}
    {manageItem?<ManageSheet item={manageItem} onClose={()=>setManageId(null)}/>:null}
  </ScreenShell>;
}

const styles=StyleSheet.create({
  weekCard:{padding:5,gap:3},
  monthTitle:{fontSize:18,lineHeight:22,fontWeight:'900',color:palette.primary,textTransform:'capitalize',paddingHorizontal:2},
  grid:{flexDirection:'row',gap:2,width:'100%'},
  dayBox:{flex:1,minWidth:0,minHeight:175,padding:2,borderRadius:7,borderWidth:1,borderColor:'#E1E4EC',backgroundColor:'#FFF'},
  todayBox:{backgroundColor:'#F0EEFF',borderColor:'#D6D0FF'},
  selectedBox:{borderColor:palette.primary,borderWidth:2,backgroundColor:'#F7F5FF'},
  dayHeader:{flexDirection:'row',alignItems:'center',gap:2,paddingBottom:3,borderBottomWidth:1,borderBottomColor:'#EEF0F5'},
  dayName:{fontSize:10,fontWeight:'900',color:palette.ink},
  dayNumber:{fontSize:15,lineHeight:17,fontWeight:'900',color:palette.ink},
  todayText:{color:palette.primary},
  dayActivities:{gap:2,paddingTop:3},
  item:{borderRadius:5,padding:2,borderWidth:1,gap:0},
  flowosItem:{backgroundColor:'#F3F4F7',borderColor:'#E0E2E8'},
  itemTime:{fontSize:4,lineHeight:7,fontWeight:'800',color:palette.muted},
  itemTitleRow:{flexDirection:'row',alignItems:'flex-start',gap:2,minWidth:0},itemPriority:{fontSize:5,lineHeight:7,fontWeight:'900',color:palette.primary},itemTitle:{flex:1,minWidth:0,flexShrink:1,fontSize:5,lineHeight:7,fontWeight:'900',color:palette.ink},
  itemMeta:{fontSize:6,lineHeight:8,color:palette.muted},
  itemPressed:{opacity:.78}
});
