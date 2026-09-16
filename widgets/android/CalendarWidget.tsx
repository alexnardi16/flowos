import React from 'react';
import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';
export type AndroidCalendarDay = { label: string; items: { id: string; title: string; time: string; kind: string }[] };
export type AndroidCalendarWeek = { title: string; days: AndroidCalendarDay[] };
export type AndroidCalendarWidgetProps = { weeks: AndroidCalendarWeek[] };
export function CalendarWidget({ weeks }: AndroidCalendarWidgetProps) {
  const visibleWeeks=weeks.slice(0,2);
  return <FlexWidget style={{ width:'match_parent',height:'match_parent',padding:12,backgroundColor:'#F1F4FF',borderRadius:22,flexDirection:'column' }} clickAction="OPEN_APP" accessibilityLabel="FlowOS: calendario">
    <FlexWidget style={{ width:'match_parent',flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingBottom:6 }}><TextWidget text="Calendario" style={{ fontSize:20,fontWeight:'bold',color:'#172033' }}/><TextWidget text="6 settimane" style={{ fontSize:10,fontWeight:'bold',color:'#4254C5' }}/></FlexWidget>
    <ListWidget style={{ width:'match_parent',height:'match_parent',backgroundColor:'#F1F4FF' }}>
      {visibleWeeks.map(week=><FlexWidget key={week.title} style={{ width:'match_parent',flexDirection:'column',marginVertical:3 }}>
        <TextWidget text={week.title} style={{ fontSize:11,fontWeight:'bold',color:'#4254C5',marginBottom:4 }}/>
        <FlexWidget style={{ width:'match_parent',flexDirection:'row' }}>
          {week.days.map((day,index)=><FlexWidget key={`${week.title}-${day.label}`} style={{ flex:1,minHeight:72,marginHorizontal:index===0?0:2,padding:4,borderRadius:10,backgroundColor:index===0?'#E8ECFF':'#FFFFFF' }}>
            <TextWidget text={day.label.split(' ')[0]} style={{ fontSize:9,fontWeight:'bold',color:'#697386' }}/>
            <TextWidget text={day.label.split(' ').slice(1).join(' ')} style={{ fontSize:10,fontWeight:'bold',color:'#172033' }}/>
            {day.items.slice(0,2).map(item=><TextWidget key={item.id} text={`${item.time} ${item.title}`} numberOfLines={2} style={{ fontSize:8,color:'#4254C5',marginTop:3 }}/>) }
            {!day.items.length?<TextWidget text="·" style={{ fontSize:11,color:'#B8BFCC',marginTop:4 }}/>:null}
            {day.items.length>2?<TextWidget text={`+${day.items.length-2}`} style={{ fontSize:8,fontWeight:'bold',color:'#697386',marginTop:2 }}/>:null}
          </FlexWidget>)}
        </FlexWidget>
      </FlexWidget>)}
    </ListWidget>
  </FlexWidget>;
}
