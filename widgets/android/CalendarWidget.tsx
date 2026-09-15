import React from 'react';
import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';

export type AndroidCalendarDay = { label: string; items: { id: string; title: string; time: string; kind: string }[] };
export type AndroidCalendarWeek = { title: string; days: AndroidCalendarDay[] };
export type AndroidCalendarWidgetProps = { weeks: AndroidCalendarWeek[] };

export function CalendarWidget({ weeks }: AndroidCalendarWidgetProps) {
  return <FlexWidget style={{ width:'match_parent',height:'match_parent',padding:12,backgroundColor:'#F7F8FC',borderRadius:20,flexDirection:'column' }} clickAction="OPEN_APP" accessibilityLabel="FlowOS: calendario">
    <FlexWidget style={{ width:'match_parent',flexDirection:'row',justifyContent:'space-between',alignItems:'center' }}>
      <TextWidget text="Calendario" style={{ fontSize:20,fontWeight:'bold',color:'#172033' }}/><TextWidget text="FlowOS" style={{ fontSize:10,color:'#5B6475' }}/>
    </FlexWidget>
    <ListWidget style={{ width:'match_parent',height:'match_parent',marginTop:7,backgroundColor:'#F7F8FC' }}>
      {weeks.map(week=><FlexWidget key={week.title} style={{ width:'match_parent',flexDirection:'column',paddingVertical:4 }}>
        <TextWidget text={week.title} style={{ fontSize:12,fontWeight:'bold',color:'#4254C5' }}/>
        {week.days.map(day=><FlexWidget key={day.label} style={{ width:'match_parent',flexDirection:'row',paddingVertical:3 }}>
          <TextWidget text={day.label} style={{ width:62,fontSize:10,fontWeight:'bold',color:'#697386' }}/>
          <FlexWidget style={{ flex:1,flexDirection:'column' }}>
            {day.items.length?day.items.slice(0,2).map(item=><TextWidget key={item.id} text={`${item.time} · ${item.kind} · ${item.title}`} style={{ fontSize:10,color:'#172033' }}/>):<TextWidget text="Nessuna attività" style={{ fontSize:9,color:'#9AA1AE' }}/>} 
            {day.items.length>2?<TextWidget text={`+${day.items.length-2} altre`} style={{ fontSize:9,color:'#4254C5' }}/>:null}
          </FlexWidget>
        </FlexWidget>)}
      </FlexWidget>)}
    </ListWidget>
  </FlexWidget>;
}
