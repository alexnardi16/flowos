import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { loadCommitments } from './commitmentsRepository';
import { syncTodayWidget } from './widgetSync';
import { recordDiagnostic } from './diagnostics';
import { supabase } from './supabase';
import { requestNotificationPermission } from './notificationService';
import { useFlowStore } from './store';

export const GOOGLE_SYNC_PUSH_TASK='flowos-google-sync-push';
const EXPO_PROJECT_ID='95803fab-e55e-48a0-8e48-f8b504f6aeac';

TaskManager.defineTask<Notifications.NotificationTaskPayload>(GOOGLE_SYNC_PUSH_TASK, async ({ data, error }) => {
    if (error) { recordDiagnostic('google-push-background-task-error',error,'warn'); return; }
    const raw=(data as any)?.data?.dataString;
    let payload:any=((data as any)?.data??data);try{if(typeof raw==='string')payload=JSON.parse(raw);}catch{}
    if (payload?.source!=='google-sync') return;
    try {
      const commitments=await loadCommitments();
      await syncTodayWidget(commitments,new Date());
      await useFlowStore.getState().hydrateFromCloud();
      recordDiagnostic('google-push-background-sync-completed',{count:commitments.length});
    } catch (syncError) {
      recordDiagnostic('google-push-background-sync-failed',syncError,'warn');
    }
  });

export async function registerGooglePushBackgroundTask(){
  if (Platform.OS==='web') return;
  try {
    await Notifications.registerTaskAsync(GOOGLE_SYNC_PUSH_TASK);
    recordDiagnostic('google-push-background-task-registered');
  } catch(error) {
    recordDiagnostic('google-push-background-task-register-failed',error,'warn');
  }
}

export async function registerGooglePushToken(userId:string){
  if (Platform.OS==='web') return;
  try {
    const allowed=await requestNotificationPermission();
    if(!allowed)return;
    const token=(await Notifications.getExpoPushTokenAsync({projectId:EXPO_PROJECT_ID})).data;
    if(!token)return;
    const {error}=await supabase.from('device_push_tokens').upsert({user_id:userId,expo_push_token:token,platform:Platform.OS,updated_at:new Date().toISOString()},{onConflict:'user_id,expo_push_token'});
    if(error)throw error;
    await registerGooglePushBackgroundTask();
    recordDiagnostic('google-push-token-registered',{platform:Platform.OS});
  } catch(error) {
    recordDiagnostic('google-push-token-registration-failed',error,'warn');
  }
}
