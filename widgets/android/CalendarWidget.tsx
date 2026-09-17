import React from 'react';
import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';
export type AndroidCalendarDay = { label: string; items: { id: string; title: string; time: string; kind: string }[] };
export type AndroidCalendarWeek = { title: string; days: AndroidCalendarDay[] };
export type AndroidCalendarWidgetProps = { weeks: AndroidCalendarWeek[]; heightDp?: number };
const BG='#F1F4FF'; const INK='#172033'; const MUTED='#697386'; const PRIMARY='#4254C5';
function compact(text:string,max=15){return text.length<=max?text:`${text.slice(0,max-1)}…`;}
function weekCount(heightDp=260){return Math.max(1,Math.min(6,Math.floor((heightDp-38)/74)));}
export function CalendarWidget({ weeks, heightDp }: AndroidCalendarWidgetProps) {
  const visibleWeeks=weeks.slice(0,weekCount(heightDp));
  return <FlexWidget style={{ width:'match_parent',height:'match_parent',padding:10,backgroundColor:BG,borderRadius:20,flexDirection:'column' }} clickAction="OPEN_URI" clickActionData={{ uri:'flowos://calendar' }} accessibilityLabel="FlowOS: calendario">
    <FlexWidget style={{ width:'match_parent',flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingBottom:5 }}><TextWidget text="Calendario" style={{ fontSize:19,fontWeight:'bold',color:INK }}/><FlexWidget style={{ flexDirection:'row',alignItems:'center' }}><FlexWidget style={{ width:30,height:26,borderRadius:13,backgroundColor:'#DDE2FF',justifyContent:'center',alignItems:'center' }} clickAction="OPEN_URI" clickActionData={{ uri:'flowos://capture?voice=1' }} accessibilityLabel="Comando vocale"><TextWidget text="🎙" style={{ fontSize:14 }}/></FlexWidget><FlexWidget style={{ height:26,paddingHorizontal:9,borderRadius:13,backgroundColor:PRIMARY,justifyContent:'center',alignItems:'center' }} clickAction="OPEN_URI" clickActionData={{ uri:'flowos://capture' }}><TextWidget text="Aggiungi" style={{ fontSize:10,fontWeight:'bold',color:'#FFFFFF' }}/></FlexWidget></FlexWidget></FlexWidget>
    <ListWidget style={{ width:'match_parent',height:'match_parent',backgroundColor:BG }}>
      {visibleWeeks.map(week=><FlexWidget key={week.title} style={{ width:'match_parent',flexDirection:'column',marginVertical:2 }}>
        <TextWidget text={week.title} style={{ fontSize:10,fontWeight:'bold',color:PRIMARY,marginBottom:3 }}/>
        <FlexWidget style={{ width:'match_parent',flexDirection:'row' }}>
          {week.days.slice(0,7).map((day,index)=><FlexWidget key={`${week.title}-${day.label}`} style={{ flex:1,height:68,marginHorizontal:index===0?0:1,padding:3,borderRadius:8,backgroundColor:index===0?'#E8ECFF':'#FFFFFF' }}>
            <TextWidget text={day.label.split(' ')[0]} style={{ fontSize:8,fontWeight:'bold',color:MUTED }}/>
            <TextWidget text={day.label.split(' ')[1]??''} style={{ fontSize:10,fontWeight:'bold',color:INK }}/>
            {day.items.slice(0,2).map(item=><TextWidget key={item.id} text={`${item.time} ${compact(item.title)}`} style={{ fontSize:7,color:PRIMARY,marginTop:2 }}/>) }
            {!day.items.length?<TextWidget text="·" style={{ fontSize:9,color:'#B8BFCC',marginTop:3 }}/>:null}
            {day.items.length>2?<TextWidget text={`+${day.items.length-2}`} style={{ fontSize:7,fontWeight:'bold',color:MUTED,marginTop:1 }}/>:null}
          </FlexWidget>)}
        </FlexWidget>
      </FlexWidget>)}
    </ListWidget>
  </FlexWidget>;
}
