import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { TodayWidget, type AndroidTodayWidgetProps } from './widgets/android/TodayWidget';
import { CalendarWidget, type AndroidCalendarWidgetProps } from './widgets/android/CalendarWidget';
import { syncGoogleWorkspace } from './lib/googleWorkspace';
import { flushOfflineQueue, loadCommitments, pushPendingToGoogle, saveCommitment, deleteCommitmentAlsoFromGoogle, removeCommitmentOnlyFromFlowOS } from './lib/commitmentsRepository';
import { parseVoiceCommand, listenForVoiceCommand, type VoiceCommand } from './lib/voiceCommands';
import type { Commitment } from './types';

const STORAGE_KEY='flowos-store-v2';

function dateKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function kindLabel(kind:string){return kind==='event'?'Evento':kind==='task'?'Task':'Reminder';}
function readCommitments(raw:string|null){try{const parsed=raw?JSON.parse(raw):null;return Array.isArray(parsed?.state?.commitments)?parsed.state.commitments:[];}catch{return[];}}
async function writeCommitments(commitments:Commitment[]){
  const raw=await AsyncStorage.getItem(STORAGE_KEY);
  let parsed:any={state:{},version:0};
  try{parsed=raw?JSON.parse(raw):parsed;}catch{}
  parsed.state={...(parsed.state??{}),commitments};
  await AsyncStorage.setItem(STORAGE_KEY,JSON.stringify(parsed));
}
function todayData(raw:string|null):Omit<AndroidTodayWidgetProps,'heightDp'>{
  const commitments=readCommitments(raw),now=new Date();
  const items=commitments.filter((item:any)=>item&&item.status!=='done'&&!item.deletedAt)
    .map((item:any)=>({item,date:item.scheduledAt??item.dueAt}))
    .filter(({item,date}:any)=>{if(!date)return false;const d=new Date(date);return item.allDay?d.getUTCFullYear()===now.getFullYear()&&d.getUTCMonth()===now.getMonth()&&d.getUTCDate()===now.getDate():dateKey(d)===dateKey(now);})
    .sort((a:any,b:any)=>new Date(a.date).getTime()-new Date(b.date).getTime())
    .map(({item,date}:any)=>({id:item.id,title:item.title,time:item.allDay?'Tutto il giorno':new Date(date).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}),kind:kindLabel(item.kind)}));
  return{items};
}
function calendarData(raw:string|null):Omit<AndroidCalendarWidgetProps,'heightDp'>{
  const commitments=readCommitments(raw).filter((item:any)=>item&&item.status!=='done'&&!item.deletedAt),now=new Date();
  const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate());monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
  const weeks:any[]=[];
  const months=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const dayNames=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
  const syncEnd=new Date(now.getFullYear()+1,11,31);
  for(let w=0;w<60;w++){
    const start=new Date(monday);start.setDate(monday.getDate()+w*7);
    if(start.getTime()>syncEnd.getTime())break;
    const days=[];
    for(let i=0;i<7;i++){
      const day=new Date(start);day.setDate(start.getDate()+i);const key=dateKey(day);
      const items=commitments.filter((item:any)=>{const value=item.scheduledAt??item.dueAt;if(!value)return false;const d=new Date(value);const itemKey=item.allDay?`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`:dateKey(d);return itemKey===key;})
        .sort((a:any,b:any)=>new Date(a.scheduledAt??a.dueAt).getTime()-new Date(b.scheduledAt??b.dueAt).getTime())
        .map((item:any)=>({id:item.id,title:item.title,time:item.allDay?'':new Date(item.scheduledAt??item.dueAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}),kind:kindLabel(item.kind)}));
      days.push({label:`${dayNames[i]} ${day.getDate()}`,dateKey:key,isToday:key===dateKey(now),items});
    }
    const title=w===0?`${months[start.getMonth()]} ${start.getFullYear()}`:(days.some((day:any)=>day.dateKey.endsWith('-01'))?(()=>{const d=days.find((day:any)=>day.dateKey.endsWith('-01'));return `${months[Number(d.dateKey.slice(5,7))-1]} ${d.dateKey.slice(0,4)}`;})():'');
    weeks.push({title,days});
  }
  return{weeks};
}
async function refreshFromGoogle(){
  await flushOfflineQueue();
  await syncGoogleWorkspace();
  const remote=await loadCommitments();
  await writeCommitments(remote);
  return remote;
}
function findVoiceItem(items:Commitment[],query:string){
  const normalize=(v:string)=>v.toLocaleLowerCase('it-IT').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const q=normalize(query);
  const active=items.filter(item=>item.status!=='done'&&!item.deletedAt);
  return active.find(item=>normalize(item.title)===q)||active.find(item=>normalize(item.title).includes(q)||q.includes(normalize(item.title)))||null;
}
function localWhen(value?:string){return value?new Date(value):undefined;}
async function executeVoice(command:VoiceCommand,items:Commitment[]){
  const status=await import('./lib/googleWorkspace').then(m=>m.getGoogleWorkspaceStatus());
  const writable=status.calendars.filter(c=>c.selected&&['owner','writer'].includes(c.access_role));
  const lists=status.taskLists.filter(l=>l.selected);
  if(command.type==='add'){
    const when=localWhen(command.when);
    const calendar=writable.find(c=>c.is_default)||writable[0];
    const list=lists.find(l=>l.is_default)||lists[0];
    if((command.kind==='event'&&!calendar)||(command.kind!=='event'&&!list))throw new Error('Nessuna destinazione Google scrivibile configurata.');
    const id=crypto.randomUUID();
    const item:Commitment={id,title:command.title,kind:command.kind,status:command.kind==='event'?'scheduled':'active',durationMinutes:30,allDay:false,energy:'medium',context:command.kind==='event'?'Calendario':command.kind==='task'?'Google Tasks':'Reminder',scheduledAt:command.kind==='event'&&when?when.toISOString():undefined,dueAt:command.kind!=='event'&&when?when.toISOString():undefined,fixed:command.kind==='event',confidence:1,googleCalendarId:command.kind==='event'?calendar?.google_calendar_id:undefined,googleTaskListId:command.kind!=='event'?list?.google_task_list_id:undefined,syncStatus:'pending'};
    await saveCommitment(item);await refreshFromGoogle();return;
  }
  const item=findVoiceItem(items,command.query);
  if(!item)throw new Error(`Non trovo un'attività corrispondente a «${command.query}».`);
  if(command.type==='complete'){const updated={...item,status:'done' as const};await saveCommitment(updated);await pushPendingToGoogle();await refreshFromGoogle();return;}
  if(command.type==='postpone'){const base=item.scheduledAt??item.dueAt;if(!base)throw new Error('L’attività non ha una data da posticipare.');const next=new Date(new Date(base).getTime()+86400000).toISOString();await saveCommitment({...item,status:item.kind==='event'?'scheduled':item.status,scheduledAt:item.scheduledAt?next:undefined,dueAt:item.dueAt?next:undefined});await pushPendingToGoogle();await refreshFromGoogle();return;}
  if(command.type==='rename'){await saveCommitment({...item,title:command.title,confidence:1});await pushPendingToGoogle();await refreshFromGoogle();return;}
  if(command.type==='move'){const next=command.when;await saveCommitment({...item,status:item.kind==='event'?'scheduled':item.status,scheduledAt:item.scheduledAt?next:undefined,dueAt:item.dueAt?next:undefined});await pushPendingToGoogle();await refreshFromGoogle();return;}
  if(command.type==='delete'){if(item.externalId)await deleteCommitmentAlsoFromGoogle(item);else await removeCommitmentOnlyFromFlowOS(item.id);await refreshFromGoogle();}
}
async function runWidgetSync(){
  try{await refreshFromGoogle();}catch{}
}
async function runWidgetVoice(){
  try{
    const transcript=await listenForVoiceCommand();
    if(!transcript)return;
    const command=parseVoiceCommand(transcript);
    if(!command)throw new Error('Comando vocale non riconosciuto.');
    const items=await loadCommitments();
    await executeVoice(command,items);
  }catch{}
}
export async function widgetTaskHandler(props:WidgetTaskHandlerProps){
  if(props.widgetAction==='WIDGET_CLICK'&&(props.clickAction==='SYNC_GOOGLE'||props.clickAction==='VOICE_COMMAND')){
    if(props.clickAction==='SYNC_GOOGLE')await runWidgetSync();
    else await runWidgetVoice();
  }
  const raw=await AsyncStorage.getItem(STORAGE_KEY);
  const heightDp=props.widgetInfo.height;
  if(props.widgetInfo.widgetName==='TodayAndroidWidget'){
    const data=todayData(raw);
    switch(props.widgetAction){case 'WIDGET_ADDED':case 'WIDGET_UPDATE':case 'WIDGET_RESIZED':case 'WIDGET_CLICK':props.renderWidget(<TodayWidget {...data} heightDp={heightDp}/>);break;default:break;}
  }else if(props.widgetInfo.widgetName==='CalendarAndroidWidget'){
    const data=calendarData(raw);
    switch(props.widgetAction){case 'WIDGET_ADDED':case 'WIDGET_UPDATE':case 'WIDGET_RESIZED':case 'WIDGET_CLICK':props.renderWidget(<CalendarWidget {...data} heightDp={heightDp}/>);break;default:break;}
  }
}
