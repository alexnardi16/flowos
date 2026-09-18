import React from 'react';
import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';
export type AndroidCalendarItem = { id: string; title: string; time: string; kind: string };
export type AndroidCalendarDay = { dateKey: string; label: string; isToday: boolean; items: AndroidCalendarItem[] };
export type AndroidCalendarWeek = { title: string; days: AndroidCalendarDay[] };
export type AndroidCalendarWidgetProps = { weeks: AndroidCalendarWeek[]; heightDp?: number };
const BG='#F1F4FF'; const INK='#172033'; const MUTED='#697386'; const PRIMARY='#4254C5';
function estimatedLines(text:string,charsPerLine=18){return Math.max(1,Math.ceil(text.length/charsPerLine));}
function itemHeight(item:AndroidCalendarItem){return Math.max(16,estimatedLines(`${item.time ? `${item.time} ` : ''}${item.title}`)*9+3);}
function dayHeight(day:AndroidCalendarDay){return Math.max(82,35+day.items.reduce((sum,item)=>sum+itemHeight(item),0));}
export function CalendarWidget({ weeks }: AndroidCalendarWidgetProps) {
  return <FlexWidget style={{ width:'match_parent',height:'match_parent',padding:10,backgroundColor:BG,borderRadius:20,flexDirection:'column' }} clickAction="OPEN_URI" clickActionData={{ uri:'flowos://calendar' }} accessibilityLabel="FlowOS: calendario">
    <FlexWidget style={{ width:'match_parent',flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingBottom:5 }}>
      <TextWidget text="Calendario" style={{ fontSize:19,fontWeight:'bold',color:INK }}/>
      <FlexWidget style={{ flexDirection:'row',alignItems:'center' }}>
        <FlexWidget style={{ width:30,height:26,borderRadius:13,backgroundColor:'#DDE2FF',justifyContent:'center',alignItems:'center' }} clickAction="OPEN_URI" clickActionData={{ uri:'flowos://capture?voice=1' }} accessibilityLabel="Comando vocale"><TextWidget text="🎙" style={{ fontSize:14 }}/></FlexWidget>
        <FlexWidget style={{ height:26,paddingHorizontal:9,borderRadius:13,backgroundColor:PRIMARY,justifyContent:'center',alignItems:'center' }} clickAction="OPEN_URI" clickActionData={{ uri:'flowos://capture' }}><TextWidget text="Aggiungi" style={{ fontSize:10,fontWeight:'bold',color:'#FFFFFF' }}/></FlexWidget>
      </FlexWidget>
    </FlexWidget>
    <ListWidget style={{ width:'match_parent',height:'match_parent',backgroundColor:BG }}>
      {weeks.map(week=>{const height=Math.max(...week.days.map(dayHeight));return <FlexWidget key={`${week.title}-${week.days[0]?.dateKey}`} style={{ width:'match_parent',flexDirection:'column',marginVertical:2 }}>
        {week.title?<TextWidget text={week.title} style={{ fontSize:10,fontWeight:'bold',color:PRIMARY,marginBottom:3 }}/>:null}
        <FlexWidget style={{ width:'match_parent',flexDirection:'row',alignItems:'stretch' }}>
          {week.days.slice(0,7).map(day=><FlexWidget key={day.dateKey} style={{ flex:1,height,marginHorizontal:1,padding:3,borderRadius:8,backgroundColor:day.isToday?'#E8ECFF':'#FFFFFF',flexDirection:'column' }}>
            <FlexWidget style={{ width:'match_parent',flexDirection:'row',alignItems:'center' }}>
              <TextWidget text={day.label} style={{ fontSize:8,fontWeight:'bold',color:day.isToday?PRIMARY:MUTED }}/>
            </FlexWidget>
            {day.items.map(item=><FlexWidget key={item.id} style={{ width:'match_parent',marginTop:2 }}><TextWidget text={`${item.time ? `${item.time} ` : ''}${item.title}`} style={{ width:'match_parent',fontSize:7,color:INK }}/></FlexWidget>)}
            {!day.items.length?<TextWidget text="·" style={{ fontSize:9,color:'#B8BFCC',marginTop:3 }}/>:null}
          </FlexWidget>)}
        </FlexWidget>
      </FlexWidget>})}
    </ListWidget>
  </FlexWidget>;
}
