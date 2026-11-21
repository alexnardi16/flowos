import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { parseVoiceCommand } from './voiceParser';
import { getGoogleWorkspaceStatus } from './googleWorkspace';
import { flushOfflineQueue, loadCommitments, pushPendingToGoogle, saveCommitment } from './commitmentsRepository';
import { syncTodayWidget } from './widgetSync';
import type { Commitment } from '../types';
import { recordDiagnostic } from './diagnostics';
import { createUuid } from './uuid';

export const WIDGET_QUICK_ADD_CATEGORY='flowos_widget_quick_add';
export const WIDGET_QUICK_ADD_ACTION='widget_quick_add_submit';
export const WIDGET_QUICK_ADD_TASK='flowos-widget-quick-add';

export async function ensureWidgetQuickAddCategory(){
  await Notifications.setNotificationCategoryAsync(WIDGET_QUICK_ADD_CATEGORY,[{
    identifier:WIDGET_QUICK_ADD_ACTION,
    buttonTitle:'Aggiungi',
    textInput:{placeholder:'Es. visita dentista domani alle 15',submitButtonTitle:'Aggiungi'},
    options:{opensAppToForeground:false},
  }]);
}

export async function promptWidgetQuickAdd(){
  if(Platform.OS!=='android')return;
  await ensureWidgetQuickAddCategory();
  await Notifications.scheduleNotificationAsync({
    content:{
      title:'Aggiungi attività',
      body:'Scrivi cosa vuoi aggiungere a FlowOS.',
      data:{source:'widget-quick-add'},
      categoryIdentifier:WIDGET_QUICK_ADD_CATEGORY,
      autoDismiss:true,
    },
    trigger:null,
  });
}

const STORE_KEY='flowos-store-v2';
async function readStoredCommitments():Promise<Commitment[]>{
  try{
    const raw=await AsyncStorage.getItem(STORE_KEY);
    const parsed=raw?JSON.parse(raw):null;
    return Array.isArray(parsed?.state?.commitments)?parsed.state.commitments as Commitment[]:[];
  }catch{return[];}
}
async function writeStoredCommitments(commitments:Commitment[]){
  const raw=await AsyncStorage.getItem(STORE_KEY);
  let parsed:any={state:{},version:0};
  try{parsed=raw?JSON.parse(raw):parsed;}catch{}
  parsed.state={...(parsed.state??{}),commitments};
  await AsyncStorage.setItem(STORE_KEY,JSON.stringify(parsed));
}

async function createFromText(text:string){
  const command=parseVoiceCommand(`aggiungi ${text}`);
  if(!command||command.type!=='add'||!command.title.trim())throw new Error('Testo di aggiunta non riconosciuto.');
  let status:any=null;
  try{status=await getGoogleWorkspaceStatus();}catch{}
  const calendar=status?.calendars?.find((c:any)=>c.selected&&c.is_default&&['owner','writer'].includes(c.access_role))??status?.calendars?.find((c:any)=>c.selected&&['owner','writer'].includes(c.access_role));
  const list=status?.taskLists?.find((l:any)=>l.selected&&l.is_default)??status?.taskLists?.find((l:any)=>l.selected);
  const when=command.when;
  const item:Commitment={
    id:createUuid(),
    title:command.title,
    kind:command.kind,
    status:command.kind==='event'?'scheduled':'active',
    durationMinutes:30,
    energy:'medium',
    context:command.kind==='event'?'Calendario':'Google Tasks',
    confidence:1,
    fixed:command.kind==='event',
    allDay:false,
    scheduledAt:command.kind==='event'?when:undefined,
    dueAt:command.kind==='task'?when:undefined,
    googleCalendarId:command.kind==='event'?calendar?.google_calendar_id:undefined,
    googleTaskListId:command.kind==='task'?list?.google_task_list_id:undefined,
    syncStatus:'pending',
  };
  await saveCommitment(item);
  let current=await readStoredCommitments();
  if(!current.length)current=await loadCommitments().catch(()=>[]);
  const next=[item,...current.filter(candidate=>candidate.id!==item.id)];
  await writeStoredCommitments(next);
  // Refresh the native widget before waiting for the Google network round trip.
  void syncTodayWidget(next,new Date()).catch(()=>undefined);
  await flushOfflineQueue();
  await pushPendingToGoogle(item.id);
  const refreshed=await loadCommitments().catch(()=>null);
  if(refreshed){
    await writeStoredCommitments(refreshed);
    void syncTodayWidget(refreshed,new Date()).catch(()=>undefined);
  }
  return item;
}

export async function handleWidgetQuickAddResponse(response:Notifications.NotificationResponse){
  const data=response.notification.request.content.data as Record<string,unknown>|undefined;
  if(data?.source!=='widget-quick-add'||response.actionIdentifier!==WIDGET_QUICK_ADD_ACTION)return false;
  const text=String(response.userText??'').trim();
  if(!text)return true;
  try{await createFromText(text);recordDiagnostic('widget-quick-add-completed',{text});}
  catch(error){recordDiagnostic('widget-quick-add-failed',error,'error');}
  return true;
}

TaskManager.defineTask<Notifications.NotificationTaskPayload>(WIDGET_QUICK_ADD_TASK,async({data,error})=>{
  if(error){recordDiagnostic('widget-quick-add-task-error',error,'warn');return;}
  const response=data as any;
  if(response?.actionIdentifier)await handleWidgetQuickAddResponse(response as Notifications.NotificationResponse);
});

if(Platform.OS==='android'){
  void Notifications.registerTaskAsync(WIDGET_QUICK_ADD_TASK).catch(error=>recordDiagnostic('widget-quick-add-task-register-failed',error,'warn'));
  Notifications.addNotificationResponseReceivedListener(response=>{void handleWidgetQuickAddResponse(response);});
}
