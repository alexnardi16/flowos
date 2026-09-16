import React from 'react';
import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';

export type AndroidWidgetItem = { id: string; title: string; time: string; kind: string };
export type AndroidTodayWidgetProps = { items: AndroidWidgetItem[]; overdueCount: number };
const uri=(action:string,id:string)=>`flowos://today?widgetAction=${action}&id=${encodeURIComponent(id)}`;
export function TodayWidget({ items }: AndroidTodayWidgetProps) {
  const visible = items.slice(0, 4);
  return <FlexWidget style={{ width:'match_parent', height:'match_parent', padding:14, backgroundColor:'#F1F4FF', borderRadius:22, flexDirection:'column' }} clickAction="OPEN_APP" accessibilityLabel="FlowOS: attività di oggi">
    <FlexWidget style={{ width:'match_parent', flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingBottom:6 }}>
      <FlexWidget style={{ flexDirection:'row', alignItems:'center' }}><TextWidget text="Oggi" style={{ fontSize:20, fontWeight:'bold', color:'#172033' }}/><TextWidget text="  ·  FlowOS" style={{ fontSize:11, fontWeight:'bold', color:'#5B6475' }}/></FlexWidget>
      <TextWidget text="Piano del giorno" style={{ fontSize:10, fontWeight:'bold', color:'#4254C5' }}/>
    </FlexWidget>
    <ListWidget style={{ width:'match_parent', height:'match_parent', backgroundColor:'#F1F4FF' }}>
      {visible.length ? visible.map((item)=><FlexWidget key={item.id} style={{ width:'match_parent', minHeight:74, marginVertical:4, padding:9, borderRadius:16, backgroundColor:item.kind==='Evento'?'#E8ECFF':item.kind==='Task'?'#FFF2D9':'#E6F8EF', flexDirection:'column' }}>
        <FlexWidget style={{ width:'match_parent', flexDirection:'row', alignItems:'center' }} clickAction="OPEN_URI" clickActionData={{ uri:uri('manage',item.id) }}>
          <FlexWidget style={{ flex:1, flexDirection:'column' }}><TextWidget text={item.title} style={{ fontSize:13, fontWeight:'bold', color:'#172033' }}/><TextWidget text={`${item.time} · ${item.kind}`} style={{ fontSize:10, color:'#697386' }}/></FlexWidget>
        </FlexWidget>
        <FlexWidget style={{ width:'match_parent', flexDirection:'row', marginTop:6 }}>
          <FlexWidget style={{ flex:1, height:30, marginRight:5, borderRadius:9, justifyContent:'center', alignItems:'center', backgroundColor:'#E7E9F0' }} clickAction="OPEN_URI" clickActionData={{ uri:uri('postpone',item.id) }}><TextWidget text="Rimanda di 1 giorno" style={{ fontSize:9, fontWeight:'bold', color:'#172033' }}/></FlexWidget>
          <FlexWidget style={{ flex:1, height:30, borderRadius:9, justifyContent:'center', alignItems:'center', backgroundColor:'#4254C5' }} clickAction="OPEN_URI" clickActionData={{ uri:uri('complete',item.id) }}><TextWidget text="Completa" style={{ fontSize:10, fontWeight:'bold', color:'#FFFFFF' }}/></FlexWidget>
        </FlexWidget>
      </FlexWidget>) : <FlexWidget style={{ width:'match_parent', height:70, justifyContent:'center', alignItems:'center' }}><TextWidget text="Nessuna attività in programma" style={{ fontSize:13, color:'#697386' }}/></FlexWidget>}
    </ListWidget>
  </FlexWidget>;
}
