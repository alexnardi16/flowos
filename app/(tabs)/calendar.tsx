import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, ScreenShell, palette } from '@/components/ui';
import { CommitmentSourceTag } from '@/components/CommitmentSourceTag';
import { ManageSheet } from '@/components/ManageSheet';
import { getGoogleWorkspaceStatus, type GoogleWorkspaceStatus } from '@/lib/googleWorkspace';
import { useFlowStore } from '@/lib/store';
import type { Commitment } from '@/types';

const DAY_NAMES=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
const MONTH_NAMES=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
function dayKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function itemDate(item:Commitment){return item.scheduledAt??item.dueAt;}
function monthLabelForWeek(week:Date[]){const firstDay=week.find(day=>day.getDate()===1);return firstDay?`${MONTH_NAMES[firstDay.getMonth()]} ${firstDay.getFullYear()}`:'';}

export default function Calendar(){
  const commitments=useFlowStore(state=>state.commitments);
  const[manageId,setManageId]=useState<string|null>(null);
  const[google,setGoogle]=useState<GoogleWorkspaceStatus|null>(null);

  useEffect(()=>{void getGoogleWorkspaceStatus().then(setGoogle).catch(()=>setGoogle(null));},[]);

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
  },[google?.range?.endDate]);

  const byDay=useMemo(()=>{
    const map=new Map<string,Commitment[]>();
    for(const item of commitments.filter(item=>!item.deletedAt&&item.status!=='done')){
      const value=itemDate(item);if(!value)continue;
      const d=new Date(value);
      const key=item.allDay?`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`:dayKey(d);
      const list=map.get(key)??[];list.push(item);map.set(key,list);
    }
    for(const list of map.values())list.sort((a,b)=>new Date(itemDate(a)??0).getTime()-new Date(itemDate(b)??0).getTime());
    return map;
  },[commitments]);

  const manageItem=manageId?commitments.find(item=>item.id===manageId)??null:null;

  return <ScreenShell title="Calendario" subtitle="Vista mensile in stile Google Calendar. Scorri orizzontalmente per leggere i sette giorni.">
    {weeks.map((week,index)=>{
      const monthTitle=monthLabelForWeek(week);
      return <Card key={index} style={styles.weekCard}>
        {monthTitle?<Text style={styles.monthTitle}>{monthTitle}</Text>:null}
        <Text style={styles.weekRange}>{week[0].toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'})} → {week[6].toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'})}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.gridScroll}>
          <View style={styles.grid}>
            {week.map((date,dayIndex)=>{
              const items=byDay.get(dayKey(date))??[];
              const today=dayKey(date)===dayKey(new Date());
              return <View key={date.toISOString()} style={[styles.dayBox,today&&styles.todayBox]}>
                <View style={styles.dayHeader}>
                  <Text style={[styles.dayName,today&&styles.todayText]}>{DAY_NAMES[dayIndex]}</Text>
                  <Text style={[styles.dayNumber,today&&styles.todayText]}>{date.getDate()}</Text>
                </View>
                <View style={styles.dayActivities}>
                  {items.map(item=><Pressable key={item.id} onPress={()=>setManageId(item.id)} style={({pressed})=>[styles.item,pressed&&styles.itemPressed]}>
                    <Text style={styles.itemTime}>{item.allDay?'':new Date(itemDate(item)!).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</Text>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    {item.location?<Text style={styles.itemMeta}>{item.location}</Text>:null}
                    <CommitmentSourceTag item={item} google={google}/>
                  </Pressable>)}
                </View>
              </View>;
            })}
          </View>
        </ScrollView>
      </Card>;
    })}
    {manageItem?<ManageSheet item={manageItem} onClose={()=>setManageId(null)}/>:null}
  </ScreenShell>;
}

const styles=StyleSheet.create({
  weekCard:{padding:10,gap:6},
  monthTitle:{fontSize:19,lineHeight:24,fontWeight:'900',color:palette.primary,textTransform:'capitalize',paddingHorizontal:4},
  weekRange:{fontSize:11,fontWeight:'800',color:palette.muted,paddingHorizontal:4},
  gridScroll:{paddingBottom:3},
  grid:{flexDirection:'row',gap:4,minWidth:1050},
  dayBox:{width:145,minHeight:190,padding:7,borderRadius:10,borderWidth:1,borderColor:'#E7E9EF',backgroundColor:'#FFF'},
  todayBox:{backgroundColor:'#F0EEFF',borderColor:'#D6D0FF'},
  dayHeader:{flexDirection:'row',alignItems:'center',gap:5,paddingBottom:6,borderBottomWidth:1,borderBottomColor:'#EEF0F5'},
  dayName:{fontSize:12,fontWeight:'900',color:palette.ink},
  dayNumber:{fontSize:18,lineHeight:20,fontWeight:'900',color:palette.ink},
  todayText:{color:palette.primary},
  dayActivities:{gap:5,paddingTop:6},
  item:{borderRadius:8,padding:6,backgroundColor:'#F4F5F8',borderWidth:1,borderColor:'#E4E6EC',gap:2},
  itemPressed:{opacity:.8},
  itemTime:{fontSize:10,fontWeight:'800',color:palette.muted,minHeight:12},
  itemTitle:{fontSize:13,lineHeight:17,fontWeight:'900',color:palette.ink},
  itemMeta:{fontSize:10,lineHeight:14,color:palette.muted}
});