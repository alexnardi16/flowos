import React from 'react';
import { FlexWidget, ImageWidget, ListWidget, TextWidget } from 'react-native-android-widget';

export type AndroidWidgetItem = { id: string; title: string; time: string; kind: string; priority?: number };
export type AndroidTodayWidgetProps = { items: AndroidWidgetItem[]; heightDp?: number };
const BG = '#F1F4FF'; const INK = '#172033'; const MUTED = '#697386'; const PRIMARY = '#4254C5'; const BORDER = '#C8CEDA';
const uri=(action:string,id:string)=>`flowos://today?widgetAction=${action}&id=${encodeURIComponent(id)}`;
function titleLines(text:string,maxChars=32){
  const clean=text.trim();
  if(!clean)return [''];
  const words=clean.split(/\s+/);
  const lines:string[]=[];
  let current='';
  for(const word of words){
    if(word.length>maxChars){
      if(current){lines.push(current);current='';}
      for(let index=0;index<word.length;index+=maxChars)lines.push(word.slice(index,index+maxChars));
      continue;
    }
    const candidate=current?`${current} ${word}`:word;
    if(candidate.length<=maxChars)current=candidate;
    else{lines.push(current);current=word;}
  }
  if(current)lines.push(current);
  return lines;
}
function itemHeight(title:string){
  return Math.max(48,12+titleLines(title).length*15+12+8);
}
export function TodayWidget({ items }: AndroidTodayWidgetProps) {
  return <FlexWidget style={{ width:'match_parent', height:'match_parent', padding:10, backgroundColor:BG, borderRadius:20, flexDirection:'column' }} clickAction="OPEN_URI" clickActionData={{ uri:'flowos://today' }} accessibilityLabel={`FlowOS: attività di oggi, ${items.length} attività`}>
    <FlexWidget style={{ width:'match_parent', flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingBottom:5 }}>
      <FlexWidget style={{ flexDirection:'row', alignItems:'center', flex:1 }}><ImageWidget image={require("../../assets/flowos-app-icon-512-store.png")} imageWidth={26} imageHeight={26} style={{ width:26, height:26, marginRight:7 }} radius={7} resizeMode="contain" /><TextWidget text="Oggi" style={{ fontSize:19, fontWeight:'bold', color:INK,marginRight:5 }}/><TextWidget text={`${items.length}`} style={{ fontSize:10,fontWeight:'bold',color:MUTED }}/></FlexWidget>
      <FlexWidget style={{ flexDirection:'row', alignItems:'center' }}>
        <FlexWidget style={{ width:30, height:26, marginRight:4, borderRadius:13, backgroundColor:'#DDE2FF', justifyContent:'center', alignItems:'center' }} clickAction="SYNC_GOOGLE" accessibilityLabel="Sincronizza FlowOS e Google"><TextWidget text="↻" style={{ fontSize:16, fontWeight:'bold', color:INK }}/></FlexWidget>
        <FlexWidget style={{ width:30, height:26, borderRadius:13, backgroundColor:'#DDE2FF', justifyContent:'center', alignItems:'center' }} clickAction="VOICE_COMMAND" accessibilityLabel="Comando vocale"><TextWidget text="🎙" style={{ fontSize:14 }}/></FlexWidget>
        <FlexWidget style={{ height:26, paddingHorizontal:9, borderRadius:13, backgroundColor:PRIMARY, justifyContent:'center', alignItems:'center' }} clickAction="QUICK_ADD"><TextWidget text="+" style={{ fontSize:10, fontWeight:'bold', color:'#FFFFFF' }}/></FlexWidget>
      </FlexWidget>
    </FlexWidget>
    <ListWidget style={{ width:'match_parent', height:'match_parent', backgroundColor:BG }}>
      {items.length ? items.map((item)=>{const lines=titleLines(item.title);return <FlexWidget key={item.id} style={{ width:'match_parent', height:itemHeight(item.title), marginVertical:2, paddingHorizontal:8, paddingVertical:4, borderRadius:11, borderWidth:1, borderColor:BORDER, backgroundColor:'#FFFFFF', flexDirection:'row', alignItems:'center' }}>
        <FlexWidget style={{ width:4, height:28, marginRight:7, borderRadius:2, backgroundColor:item.kind==='Evento'?'#6C7BE8':item.kind==='Task'?'#E5A73B':'#45B887' }}/>
        <FlexWidget style={{ flex:1, flexDirection:'column', justifyContent:'center' }} clickAction="OPEN_URI" clickActionData={{ uri:uri('manage',item.id) }}>{item.priority ? <TextWidget text={`#${item.priority}`} style={{ fontSize:10, lineHeight:12, fontWeight:'bold', color:PRIMARY }} /> : null}{lines.map((line,index)=><TextWidget key={`${item.id}-title-${index}`} text={line} style={{ fontSize:12, lineHeight:15, fontWeight:'bold', color:INK }}/>)}<TextWidget text={`${item.time} · ${item.kind}`} style={{ fontSize:9, lineHeight:12, color:MUTED }}/></FlexWidget>
        <FlexWidget style={{ width:28, height:28, marginLeft:5, borderRadius:9, backgroundColor:'#ECEEF4', justifyContent:'center', alignItems:'center' }} clickAction="POSTPONE" clickActionData={{ id:item.id }}><TextWidget text="+1g" style={{ fontSize:9, fontWeight:'bold', color:INK }}/></FlexWidget>
        <FlexWidget style={{ width:28, height:28, marginLeft:4, borderRadius:9, backgroundColor:PRIMARY, justifyContent:'center', alignItems:'center' }} clickAction="OPEN_URI" clickActionData={{ uri:uri('complete',item.id) }}><TextWidget text="✓" style={{ fontSize:11, fontWeight:'bold', color:'#FFFFFF' }}/></FlexWidget>
      </FlexWidget>}) : <FlexWidget style={{ width:'match_parent', height:50, justifyContent:'center', alignItems:'center' }}><TextWidget text="Nessuna attività oggi" style={{ fontSize:12, color:MUTED }}/></FlexWidget>}
      <FlexWidget style={{ width:'match_parent',height:18 }}/>
    </ListWidget>
  </FlexWidget>;
}
