import React from 'react';
import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';
export type AndroidCalendarItem = { id: string; title: string; time: string; kind: string };
export type AndroidCalendarDay = { dateKey: string; label: string; isToday: boolean; items: AndroidCalendarItem[] };
export type AndroidCalendarWeek = { title: string; days: AndroidCalendarDay[] };
export type AndroidCalendarWidgetProps = { weeks: AndroidCalendarWeek[]; heightDp?: number };
const BG='#F1F4FF'; const INK='#172033'; const MUTED='#697386'; const PRIMARY='#4254C5'; const DAY_WIDTH=40; const BORDER='#C8CEDA';
function capitalizeMonthTitle(value:string){const [month,...year]=value.split(' ');return month?`${month.charAt(0).toUpperCase()}${month.slice(1)} ${year.join(' ')}`:value;}
function compact(text:string,max=22){return text.length<=max?text:`${text.slice(0,max-1)}…`;}
function weekHeight(week:AndroidCalendarWeek){const maxItems=Math.max(0,...week.days.map(day=>day.items.length));return Math.max(92,Math.min(170,38+maxItems*14));}
export function CalendarWidget({ weeks }: AndroidCalendarWidgetProps) {
  return <FlexWidget style={{ width:'match_parent',height:'match_parent',padding:8,backgroundColor:BG,borderRadius:20,flexDirection:'column' }} clickAction="OPEN_URI" clickActionData={{ uri:'flowos://calendar' }} accessibilityLabel="FlowOS: calendario">
    <FlexWidget style={{ width:'match_parent',flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingBottom:5 }}>
      <FlexWidget style={{ flexDirection:'row',alignItems:'center',gap:5 }}><TextWidget text="Calendario" style={{ fontSize:19,fontWeight:'bold',color:INK }}/><TextWidget text={`${weeks.length} sett.`} style={{ fontSize:9,fontWeight:'bold',color:MUTED }}/></FlexWidget>
      <FlexWidget style={{ flexDirection:'row',alignItems:'center' }}>
        <FlexWidget style={{ width:30,height:26,marginRight:4,borderRadius:13,backgroundColor:'#DDE2FF',justifyContent:'center',alignItems:'center' }} clickAction="SYNC_GOOGLE" accessibilityLabel="Sincronizza FlowOS e Google"><TextWidget text="↻" style={{ fontSize:16,fontWeight:'bold',color:INK }}/></FlexWidget>
        <FlexWidget style={{ width:30,height:26,borderRadius:13,backgroundColor:'#DDE2FF',justifyContent:'center',alignItems:'center' }} clickAction="VOICE_COMMAND" accessibilityLabel="Comando vocale"><TextWidget text="🎙" style={{ fontSize:14 }}/></FlexWidget>
        <FlexWidget style={{ height:26,paddingHorizontal:9,borderRadius:13,backgroundColor:PRIMARY,justifyContent:'center',alignItems:'center' }} clickAction="OPEN_URI" clickActionData={{ uri:'flowos://capture' }}><TextWidget text="+" style={{ fontSize:10,fontWeight:'bold',color:'#FFFFFF' }}/></FlexWidget>
      </FlexWidget>
    </FlexWidget>
    <ListWidget style={{ width:'match_parent',height:'match_parent',backgroundColor:BG }}>
      {weeks.slice(0,16).map(week=>{const height=weekHeight(week);return <FlexWidget key={`${week.title}-${week.days[0]?.dateKey}`} style={{ width:'match_parent',flexDirection:'column',marginVertical:2 }}>
        {week.title?<TextWidget text={capitalizeMonthTitle(week.title)} style={{ fontSize:10,fontWeight:'bold',color:PRIMARY,marginBottom:3 }}/>:null}
        <FlexWidget style={{ width:'match_parent',flexDirection:'row',justifyContent:'flex-start' }}>
          {Array.from({length:7},(_,index)=>week.days[index] ?? {dateKey:`${week.title}-${index}`,label:['Lun','Mar','Mer','Gio','Ven','Sab','Dom'][index],isToday:false,items:[]}).map(day=><FlexWidget key={day.dateKey} clickAction="OPEN_URI" clickActionData={{ uri:`flowos://calendar?date=${day.dateKey}` }} accessibilityLabel={`Apri ${day.label}`} style={{ width:DAY_WIDTH,height,marginHorizontal:1,padding:2,borderRadius:7,borderWidth:1,borderColor:BORDER,backgroundColor:day.isToday?'#E8ECFF':'#FFFFFF',flexDirection:'column' }}>
            <FlexWidget style={{ width:'match_parent',flexDirection:'row',alignItems:'center' }}>
              <TextWidget text={day.label} style={{ fontSize:7,fontWeight:'bold',color:day.isToday?PRIMARY:MUTED }}/>
            </FlexWidget>
            {day.items.map(item=><FlexWidget key={item.id} style={{ width:'match_parent',marginTop:2 }}><TextWidget text={compact(`${item.time ? `${item.time} ` : ''}${item.title}`)} style={{ width:'match_parent',fontSize:6,color:INK }}/></FlexWidget>)}
            {!day.items.length?<TextWidget text="·" style={{ fontSize:9,color:'#B8BFCC',marginTop:3 }}/>:null}
          </FlexWidget>)}
        </FlexWidget>
      </FlexWidget>})}
    </ListWidget>
  </FlexWidget>;
}
