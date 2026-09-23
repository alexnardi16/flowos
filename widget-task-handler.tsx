import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { TodayWidget, type AndroidTodayWidgetProps } from './widgets/android/TodayWidget';
import { CalendarWidget, type AndroidCalendarWidgetProps } from './widgets/android/CalendarWidget';
import { buildCalendarWidgetData } from './lib/calendarWidgetData';
import { syncGoogleWorkspace } from './lib/googleWorkspace';
import { flushOfflineQueue, loadCommitments, pushPendingToGoogle, saveCommitment, deleteCommitmentAlsoFromGoogle, removeCommitmentOnlyFromFlowOS } from './lib/commitmentsRepository';
import { parseVoiceCommand, listenForVoiceCommand, findBestVoiceMatch, type VoiceCommand } from './lib/voiceCommands';
import type { Commitment } from './types';
import { recordDiagnostic } from './lib/diagnostics';
import { promptWidgetQuickAdd } from './lib/widgetQuickAdd';

const STORAGE_KEY='flowos-store-v2';
const CALENDAR_CACHE_KEY='flowos-calendar-widget-v1';

function dateKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function kindLabel(kind:string){return kind==='event'?'Evento':'Task';}
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
async function loadCalendarCache(){try{const raw=await AsyncStorage.getItem(CALENDAR_CACHE_KEY);if(!raw)return null;const parsed=JSON.parse(raw);return parsed?.dateKey===dateKey(new Date())&&Array.isArray(parsed?.weeks)?{weeks:parsed.weeks as AndroidCalendarWidgetProps['weeks']}:null;}catch{return null;}}
async function saveCalendarCache(data:Omit<AndroidCalendarWidgetProps,'heightDp'>){try{await AsyncStorage.setItem(CALENDAR_CACHE_KEY,JSON.stringify({dateKey:dateKey(new Date()),...data}));}catch{}}

async function refreshFromGoogle(){
  await flushOfflineQueue();
  await syncGoogleWorkspace();
  const remote=await loadCommitments();
  await writeCommitments(remote);
  return remote;
}
async function runWidgetPostpone(id:string){
  const items=await loadCommitments();
  const item=items.find(candidate=>candidate.id===id);
  if(!item)return;
  const base=item.scheduledAt??item.dueAt;
  if(!base)return;
  const nextDay=new Date(new Date(base).getTime()+86400000).toISOString();
  const updated={...item,status:item.kind==='event'?'scheduled':item.status,scheduledAt:item.scheduledAt?nextDay:undefined,dueAt:item.dueAt?nextDay:undefined} as Commitment;
  await saveCommitment(updated);
  await pushPendingToGoogle();
  const refreshed=await loadCommitments();
  await writeCommitments(refreshed);
}
function findVoiceItem(items:Commitment[],query:string){return findBestVoiceMatch(items,query);}
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
    const id=`widget-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
    const item:Commitment={id,title:command.title,kind:command.kind,status:command.kind==='event'?'scheduled':'active',durationMinutes:30,allDay:false,energy:'medium',context:command.kind==='event'?'Calendario':'Google Tasks',scheduledAt:command.kind==='event'&&when?when.toISOString():undefined,dueAt:command.kind==='task'&&when?when.toISOString():undefined,fixed:command.kind==='event',confidence:1,googleCalendarId:command.kind==='event'?calendar?.google_calendar_id:undefined,googleTaskListId:command.kind==='task'?list?.google_task_list_id:undefined,syncStatus:'pending'};
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
  try{await refreshFromGoogle();recordDiagnostic('widget-google-sync-completed');}
  catch(error){recordDiagnostic('widget-google-sync-failed',error,'error');}
}
async function runWidgetVoice(){
  try{
    const transcript=await listenForVoiceCommand();
    if(!transcript){recordDiagnostic('widget-voice-command-empty',undefined,'warn');return;}
    const command=parseVoiceCommand(transcript);
    recordDiagnostic('widget-voice-command-parsed',{transcript,type:command?.type??null});
    if(!command)throw new Error('Comando vocale non riconosciuto.');
    const items=await loadCommitments();
    await executeVoice(command,items);
    recordDiagnostic('widget-voice-command-completed',{type:command.type});
  }catch(error){recordDiagnostic('widget-voice-command-failed',error,'error');}
}
export async function widgetTaskHandler(props:WidgetTaskHandlerProps){
  if(props.widgetAction==='WIDGET_CLICK'){
    if(props.clickAction==='SYNC_GOOGLE')await runWidgetSync();
    else if(props.clickAction==='VOICE_COMMAND')await runWidgetVoice();
    else if(props.clickAction==='POSTPONE'){
      const id=String((props.clickActionData as Record<string,unknown>|undefined)?.id??'');
      if(id)try{await runWidgetPostpone(id);recordDiagnostic('widget-postpone-completed',{id});}catch(error){recordDiagnostic('widget-postpone-failed',error,'warn');}
    }else if(props.clickAction==='QUICK_ADD'){
      try{await promptWidgetQuickAdd();recordDiagnostic('widget-quick-add-prompted');}catch(error){recordDiagnostic('widget-quick-add-prompt-failed',error,'warn');}
    }
  }
  const raw=await AsyncStorage.getItem(STORAGE_KEY);
  const heightDp=props.widgetInfo.height;
  if(props.widgetInfo.widgetName==='TodayAndroidWidget'){
    const data=todayData(raw);
    switch(props.widgetAction){case 'WIDGET_ADDED':case 'WIDGET_UPDATE':case 'WIDGET_RESIZED':case 'WIDGET_CLICK':props.renderWidget(<TodayWidget {...data} heightDp={heightDp}/>);break;default:break;}
  }else if(props.widgetInfo.widgetName==='CalendarAndroidWidget'){
    let data=await loadCalendarCache();
    if(!data) {
      props.renderWidget(<CalendarWidget weeks={[]} heightDp={heightDp}/>);
      let syncEnd=new Date(new Date().getFullYear()+1,11,31);
      try { const status=await import('./lib/googleWorkspace').then(m=>m.getGoogleWorkspaceStatus()); if(status.range?.endDate)syncEnd=new Date(`${status.range.endDate}T23:59:59`); } catch(error) { recordDiagnostic('widget-calendar-range-load-failed',error,'warn'); }
      data=buildCalendarWidgetData(readCommitments(raw),syncEnd,new Date());
      await saveCalendarCache(data);
    }
    switch(props.widgetAction){case 'WIDGET_ADDED':case 'WIDGET_UPDATE':case 'WIDGET_RESIZED':case 'WIDGET_CLICK':props.renderWidget(<CalendarWidget {...data} heightDp={heightDp}/>);break;default:break;}
    if(props.widgetAction==='WIDGET_UPDATE'){
      try{
        const remote=await refreshFromGoogle();
        let syncEnd=new Date(new Date().getFullYear()+1,11,31);
        try {
          const status=await import('./lib/googleWorkspace').then(m=>m.getGoogleWorkspaceStatus());
          if(status.range?.endDate)syncEnd=new Date(`${status.range.endDate}T23:59:59`);
        } catch(error) { recordDiagnostic('widget-calendar-range-load-failed',error,'warn'); }
        const refreshed=buildCalendarWidgetData(remote,syncEnd,new Date());
        await saveCalendarCache(refreshed);
        props.renderWidget(<CalendarWidget {...refreshed} heightDp={heightDp}/>);
      }catch(error){recordDiagnostic('widget-calendar-background-refresh-failed',error,'warn');}
    }
  }
}
