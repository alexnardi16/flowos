import React from 'react';
import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';

export type AndroidWidgetItem = { id: string; title: string; time: string; kind: string };
export type AndroidTodayWidgetProps = { items: AndroidWidgetItem[]; heightDp?: number };
const BG = '#F1F4FF'; const INK = '#172033'; const MUTED = '#697386'; const PRIMARY = '#4254C5'; const BORDER = '#C8CEDA';
const uri=(action:string,id:string)=>`flowos://today?widgetAction=${action}&id=${encodeURIComponent(id)}`;
function compact(text:string,max=34){return text.length<=max?text:`${text.slice(0,max-1)}…`;}
export function TodayWidget({ items }: AndroidTodayWidgetProps) {
  return <FlexWidget style={{ width:'match_parent', height:'match_parent', padding:10, backgroundColor:BG, borderRadius:20, flexDirection:'column' }} clickAction="OPEN_URI" clickActionData={{ uri:'flowos://today' }} accessibilityLabel="FlowOS: attività di oggi">
    <FlexWidget style={{ width:'match_parent', flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingBottom:5 }}>
      <TextWidget text="Oggi" style={{ fontSize:19, fontWeight:'bold', color:INK }}/>
      <FlexWidget style={{ flexDirection:'row', alignItems:'center' }}>
        <FlexWidget style={{ width:30, height:26, marginRight:4, borderRadius:13, backgroundColor:'#DDE2FF', justifyContent:'center', alignItems:'center' }} clickAction="SYNC_GOOGLE" accessibilityLabel="Sincronizza FlowOS e Google"><TextWidget text="↻" style={{ fontSize:16, fontWeight:'bold', color:INK }}/></FlexWidget>
        <FlexWidget style={{ width:30, height:26, borderRadius:13, backgroundColor:'#DDE2FF', justifyContent:'center', alignItems:'center' }} clickAction="VOICE_COMMAND" accessibilityLabel="Comando vocale"><TextWidget text="🎙" style={{ fontSize:14 }}/></FlexWidget>
        <FlexWidget style={{ height:26, paddingHorizontal:9, borderRadius:13, backgroundColor:PRIMARY, justifyContent:'center', alignItems:'center' }} clickAction="OPEN_URI" clickActionData={{ uri:'flowos://capture' }}><TextWidget text="+" style={{ fontSize:10, fontWeight:'bold', color:'#FFFFFF' }}/></FlexWidget>
      </FlexWidget>
    </FlexWidget>
    <ListWidget style={{ width:'match_parent', height:'match_parent', backgroundColor:BG }}>
      {items.length ? items.map((item)=><FlexWidget key={item.id} style={{ width:'match_parent', height:46, marginVertical:2, paddingHorizontal:8, paddingVertical:4, borderRadius:11, borderWidth:1, borderColor:BORDER, backgroundColor:'#FFFFFF', flexDirection:'row', alignItems:'center' }}>
        <FlexWidget style={{ width:4, height:28, marginRight:7, borderRadius:2, backgroundColor:item.kind==='Evento'?'#6C7BE8':item.kind==='Task'?'#E5A73B':'#45B887' }}/>
        <FlexWidget style={{ flex:1, flexDirection:'column', justifyContent:'center' }} clickAction="OPEN_URI" clickActionData={{ uri:uri('manage',item.id) }}><TextWidget text={compact(item.title)} style={{ fontSize:12, fontWeight:'bold', color:INK }}/><TextWidget text={`${item.time} · ${item.kind}`} style={{ fontSize:9, color:MUTED }}/></FlexWidget>
        <FlexWidget style={{ width:28, height:28, marginLeft:5, borderRadius:9, backgroundColor:'#ECEEF4', justifyContent:'center', alignItems:'center' }} clickAction="OPEN_URI" clickActionData={{ uri:uri('postpone',item.id) }}><TextWidget text="+1g" style={{ fontSize:9, fontWeight:'bold', color:INK }}/></FlexWidget>
        <FlexWidget style={{ width:28, height:28, marginLeft:4, borderRadius:9, backgroundColor:PRIMARY, justifyContent:'center', alignItems:'center' }} clickAction="OPEN_URI" clickActionData={{ uri:uri('complete',item.id) }}><TextWidget text="✓" style={{ fontSize:11, fontWeight:'bold', color:'#FFFFFF' }}/></FlexWidget>
      </FlexWidget>) : <FlexWidget style={{ width:'match_parent', height:50, justifyContent:'center', alignItems:'center' }}><TextWidget text="Nessuna attività oggi" style={{ fontSize:12, color:MUTED }}/></FlexWidget>}
    </ListWidget>
  </FlexWidget>;
}
