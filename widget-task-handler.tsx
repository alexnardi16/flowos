import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { TodayWidget, type AndroidTodayWidgetProps } from './widgets/android/TodayWidget';
import { CalendarWidget, type AndroidCalendarWidgetProps } from './widgets/android/CalendarWidget';
import { buildCalendarWidgetData } from './lib/calendarWidgetData';
import { getGoogleWorkspaceStatus, syncGoogleWorkspace } from './lib/googleWorkspace';
import { flushOfflineQueue, loadCommitments, pushPendingToGoogle, saveCommitment, deleteCommitmentAlsoFromGoogle, removeCommitmentOnlyFromFlowOS } from './lib/commitmentsRepository';
import { findBestVoiceMatch, type VoiceCommand } from './lib/voiceCommands';
import type { Commitment } from './types';
import { recordDiagnostic } from './lib/diagnostics';
import { normalizeTaskPriorities } from './lib/taskPriority';
import { sortCommitments } from './lib/activityOrdering';
import { getLanguage, getTranslateActivities, widgetStrings } from './lib/i18n';
import { getDisplayTitleMap } from './lib/activityTranslations';

const STORAGE_KEY='flowos-store-v2';
const CALENDAR_CACHE_KEY='flowos-calendar-widget-v2';

function dateKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function kindLabel(kind:string,language='it' as import('./lib/i18n').Language){const labels=widgetStrings(language);return kind==='event'?labels.event:labels.task;}
function readCommitments(raw:string|null){try{const parsed=raw?JSON.parse(raw):null;return Array.isArray(parsed?.state?.commitments)?parsed.state.commitments:[];}catch{return[];}}
async function writeCommitments(commitments:Commitment[]){
  const raw=await AsyncStorage.getItem(STORAGE_KEY);
  let parsed:any={state:{},version:0};
  try{parsed=raw?JSON.parse(raw):parsed;}catch{}
  parsed.state={...(parsed.state??{}),commitments};
  await AsyncStorage.setItem(STORAGE_KEY,JSON.stringify(parsed));
}
function todayData(raw:string|null,language='it' as import('./lib/i18n').Language,titleMap:Record<string,string>={}):Omit<AndroidTodayWidgetProps,'language'>{
  const commitments=readCommitments(raw),now=new Date();
  const todayItems=commitments.filter((item:any)=>item&&item.status!=='done'&&item.status!=='completed'&&!item.deletedAt)
    .filter((item:any)=>{const date=item.scheduledAt??item.dueAt;if(!date)return false;const d=new Date(date);return item.allDay?d.getUTCFullYear()===now.getFullYear()&&d.getUTCMonth()===now.getMonth()&&d.getUTCDate()===now.getDate():dateKey(d)===dateKey(now);});
  const items=sortCommitments(todayItems as Commitment[])
    .map((item:any)=>{const date=item.scheduledAt??item.dueAt;return {id:item.id,title:titleMap[item.id]??item.title,time:item.allDay?widgetStrings(language).allDay:new Date(date).toLocaleTimeString(language==='it'?'it-IT':language==='fr'?'fr-FR':language==='es'?'es-ES':'en-US',{hour:'2-digit',minute:'2-digit'}),kind:kindLabel(item.kind,language),priority:item.kind==='task'?item.priority:undefined};});
  return{items};
}
async function loadCalendarCache(language:string,translateActivities:boolean){try{const raw=await AsyncStorage.getItem(CALENDAR_CACHE_KEY);if(!raw)return null;const parsed=JSON.parse(raw);return parsed?.dateKey===dateKey(new Date())&&parsed?.language===language&&parsed?.translateActivities===translateActivities&&Array.isArray(parsed?.weeks)?{weeks:parsed.weeks as AndroidCalendarWidgetProps['weeks']}:null;}catch{return null;}}
async function saveCalendarCache(data:AndroidCalendarWidgetProps,language:string,translateActivities:boolean){try{await AsyncStorage.setItem(CALENDAR_CACHE_KEY,JSON.stringify({dateKey:dateKey(new Date()),language,translateActivities,...data}));}catch{}}

async function refreshFromGoogle(){
  await flushOfflineQueue();
  await syncGoogleWorkspace();
  const remote=await loadCommitments();
  await writeCommitments(remote);
  return remote;
}
async function runWidgetComplete(id:string){
  const items=await loadCommitments();
  const item=items.find(candidate=>candidate.id===id);
  if(!item)return;
  await saveCommitment({...item,status:'done' as const});
  await pushPendingToGoogle();
  const refreshed=await loadCommitments();
  await writeCommitments(normalizeTaskPriorities(refreshed));
}
async function runWidgetPostpone(id:string){
  const items=await loadCommitments();
  const item=items.find(candidate=>candidate.id===id);
  if(!item)return;
  const base=item.scheduledAt??item.dueAt;
  if(!base)return;
  const nextDay=new Date(new Date(base).getTime()+86400000).toISOString();
  const updated={...item,status:item.kind==='event'?'scheduled':item.status,scheduledAt:item.scheduledAt?nextDay:undefined,dueAt:item.dueAt?nextDay:undefined} as Commitment;
  const normalized=normalizeTaskPriorities(items.map(candidate=>candidate.id===id?updated:candidate));
  for(const changed of normalized){
    const previous=items.find(candidate=>candidate.id===changed.id);
    if(!previous||previous.priority!==changed.priority||changed.id===id)await saveCommitment(changed);
  }
  await flushOfflineQueue();
  await pushPendingToGoogle();
  const refreshed=await loadCommitments();
  await writeCommitments(normalizeTaskPriorities(refreshed));
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
    const item:Commitment={id,title:command.title,kind:command.kind,status:command.kind==='event'?'scheduled':'active',durationMinutes:60,allDay:false,energy:'medium',context:command.kind==='event'?'Calendario':'Google Tasks',scheduledAt:command.kind==='event'&&when?when.toISOString():undefined,dueAt:command.kind==='task'&&when?when.toISOString():undefined,fixed:command.kind==='event',confidence:1,googleCalendarId:command.kind==='event'?calendar?.google_calendar_id:undefined,googleTaskListId:command.kind==='task'?list?.google_task_list_id:undefined,syncStatus:'pending'};
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
  try{const refreshed=await refreshFromGoogle();await (await import('./lib/widgetSync')).syncTodayWidget(refreshed,new Date());recordDiagnostic('widget-google-sync-completed');}
  catch(error){recordDiagnostic('widget-google-sync-failed',error,'error');}
}
export async function widgetTaskHandler(props:WidgetTaskHandlerProps){
  if(props.widgetAction==='WIDGET_CLICK'){
    if(props.clickAction==='SYNC_GOOGLE'){await runWidgetSync();return;}
    else if(props.clickAction==='COMPLETE'){
      const id=String((props.clickActionData as Record<string,unknown>|undefined)?.id??'');
      if(id)try{await runWidgetComplete(id);recordDiagnostic('widget-complete-completed',{id});}catch(error){recordDiagnostic('widget-complete-failed',error,'warn');}
    }else if(props.clickAction==='POSTPONE'){
      const id=String((props.clickActionData as Record<string,unknown>|undefined)?.id??'');
      if(id)try{await runWidgetPostpone(id);recordDiagnostic('widget-postpone-completed',{id});}catch(error){recordDiagnostic('widget-postpone-failed',error,'warn');}
  }
  const raw=await AsyncStorage.getItem(STORAGE_KEY);
  const language=await getLanguage();
  const translateActivities=await getTranslateActivities();
  const titleMap=await getDisplayTitleMap(readCommitments(raw));
  if(props.widgetInfo.widgetName==='TodayAndroidWidget'){
    const data=todayData(raw,language,titleMap);
    switch(props.widgetAction){case 'WIDGET_ADDED':case 'WIDGET_UPDATE':case 'WIDGET_RESIZED':case 'WIDGET_CLICK':props.renderWidget(<TodayWidget {...data} language={language}/>);break;default:break;}
  }else if(props.widgetInfo.widgetName==='CalendarAndroidWidget'){
    let data=await loadCalendarCache(language,translateActivities);
    if(!data) {
      props.renderWidget(<CalendarWidget weeks={[]} language={language}/>);
      let syncEnd=new Date(new Date().getFullYear()+1,11,31);
      try { const status=await import('./lib/googleWorkspace').then(m=>m.getGoogleWorkspaceStatus()); if(status.range?.endDate)syncEnd=new Date(`${status.range.endDate}T23:59:59`); } catch(error) { recordDiagnostic('widget-calendar-range-load-failed',error,'warn'); }
      let calendarNames:Map<string,string>|undefined;
      try { const status=await getGoogleWorkspaceStatus(); calendarNames=new Map(status.calendars.map(calendar=>[calendar.google_calendar_id,calendar.summary])); } catch {}
      data=buildCalendarWidgetData(readCommitments(raw),syncEnd,new Date(),calendarNames,titleMap,language);
      await saveCalendarCache(data,language,translateActivities);
    }
    switch(props.widgetAction){case 'WIDGET_ADDED':case 'WIDGET_UPDATE':case 'WIDGET_RESIZED':case 'WIDGET_CLICK':props.renderWidget(<CalendarWidget {...data} language={language}/>);break;default:break;}
    if(props.widgetAction==='WIDGET_UPDATE'){
      try{
        const remote=await refreshFromGoogle();
        const remoteTitleMap=await getDisplayTitleMap(remote);
        let syncEnd=new Date(new Date().getFullYear()+1,11,31);
        try {
          const status=await import('./lib/googleWorkspace').then(m=>m.getGoogleWorkspaceStatus());
          if(status.range?.endDate)syncEnd=new Date(`${status.range.endDate}T23:59:59`);
        } catch(error) { recordDiagnostic('widget-calendar-range-load-failed',error,'warn'); }
        let calendarNames:Map<string,string>|undefined;
        try { const status=await getGoogleWorkspaceStatus(); calendarNames=new Map(status.calendars.map(calendar=>[calendar.google_calendar_id,calendar.summary])); } catch {}
        const refreshed=buildCalendarWidgetData(remote,syncEnd,new Date(),calendarNames,remoteTitleMap,language);
        await saveCalendarCache(refreshed);
        props.renderWidget(<CalendarWidget {...refreshed} language={language}/>);
      }catch(error){recordDiagnostic('widget-calendar-background-refresh-failed',error,'warn');}
    }
  }
}
