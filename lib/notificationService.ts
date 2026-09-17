import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DailySummary } from './dailySummary';
import { logNotificationEvent } from './notificationLog';
import { hasRecoveredToday } from './notificationDedup';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export { hasRecoveredToday };
export const NOTIFICATIONS_SUPPORTED_HERE = Platform.OS !== 'web';
export const DAILY_SUMMARY_CHANNEL = 'flowos-daily-summary';
export const DEFAULT_DAILY_SUMMARY_HOUR = 7;
export const DEFAULT_DAILY_SUMMARY_MINUTE = 30;
export const DAILY_SUMMARY_HOUR = DEFAULT_DAILY_SUMMARY_HOUR;
export const DAILY_SUMMARY_MINUTE = DEFAULT_DAILY_SUMMARY_MINUTE;
export const TOMORROW_SUMMARY_HOUR = 8;
export const TOMORROW_SUMMARY_MINUTE = 0;
export type DailySummaryTime = { hour: number; minute: number };
const SCHEDULED_ID_KEY = 'flowos:notifications:daily-summary-scheduled-id';
const TOMORROW_SCHEDULED_ID_KEY = 'flowos:notifications:tomorrow-summary-scheduled-id';
const LAST_RECOVERY_DATE_KEY = 'flowos:notifications:daily-summary-last-recovery-date';
const ENABLED_KEY = 'flowos:notifications:daily-summary-enabled';
const TIME_KEY = 'flowos:notifications:daily-summary-time';
export async function ensureDailySummaryChannel() { if (Platform.OS !== 'android') return; await Notifications.setNotificationChannelAsync(DAILY_SUMMARY_CHANNEL,{name:'Riepilogo giornaliero FlowOS',importance:Notifications.AndroidImportance.HIGH}); }
export async function requestNotificationPermission(): Promise<boolean> { if(!NOTIFICATIONS_SUPPORTED_HERE)return false; const current=await Notifications.getPermissionsAsync(); await logNotificationEvent('notification-permission-state',{granted:current.granted,status:current.status,canAskAgain:current.canAskAgain}); if(current.granted)return true; const requested=await Notifications.requestPermissionsAsync(); await logNotificationEvent('notification-permission-request-result',{granted:requested.granted,status:requested.status,canAskAgain:requested.canAskAgain}); return requested.granted; }
export async function isDailySummaryEnabledStored(): Promise<boolean> { const raw=await AsyncStorage.getItem(ENABLED_KEY); return raw===null?true:raw==='1'; }
export async function setDailySummaryEnabledStored(enabled:boolean){await AsyncStorage.setItem(ENABLED_KEY,enabled?'1':'0');await logNotificationEvent('daily-summary-preference-changed',{enabled});}
export async function getDailySummaryTime():Promise<DailySummaryTime>{const raw=await AsyncStorage.getItem(TIME_KEY);if(!raw)return{hour:DEFAULT_DAILY_SUMMARY_HOUR,minute:DEFAULT_DAILY_SUMMARY_MINUTE};try{const parsed=JSON.parse(raw) as Partial<DailySummaryTime>;if(Number.isInteger(parsed.hour)&&Number.isInteger(parsed.minute)&&parsed.hour!>=0&&parsed.hour!<=23&&parsed.minute!>=0&&parsed.minute!<=59)return{hour:parsed.hour!,minute:parsed.minute!};}catch{}return{hour:DEFAULT_DAILY_SUMMARY_HOUR,minute:DEFAULT_DAILY_SUMMARY_MINUTE};}
export async function setDailySummaryTime(hour:number,minute:number){if(!Number.isInteger(hour)||hour<0||hour>23||!Number.isInteger(minute)||minute<0||minute>59)throw new Error('Orario non valido.');await AsyncStorage.setItem(TIME_KEY,JSON.stringify({hour,minute}));await logNotificationEvent('daily-summary-time-changed',{hour,minute,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||null});}
export async function getLastRecoveryDateKey(){return AsyncStorage.getItem(LAST_RECOVERY_DATE_KEY);} export async function markRecovered(dateKey:string){await AsyncStorage.setItem(LAST_RECOVERY_DATE_KEY,dateKey);}
async function cancelStoredNotification(key:string,logEvent:string){if(!NOTIFICATIONS_SUPPORTED_HERE)return;const previousId=await AsyncStorage.getItem(key);if(!previousId)return;try{await Notifications.cancelScheduledNotificationAsync(previousId);}catch(error){await logNotificationEvent(logEvent,error,'warn');}await AsyncStorage.removeItem(key);}
async function cancelPreviousScheduledSummary(){await cancelStoredNotification(SCHEDULED_ID_KEY,'cancel-previous-summary-failed');}
export async function scheduleDailySummaryNotification(summary:DailySummary):Promise<string|null>{const allowed=await requestNotificationPermission();if(!allowed){await logNotificationEvent(NOTIFICATIONS_SUPPORTED_HERE?'schedule-summary-permission-denied':'schedule-summary-skipped-web-unsupported',undefined,NOTIFICATIONS_SUPPORTED_HERE?'warn':'info');return null;}await ensureDailySummaryChannel();await cancelPreviousScheduledSummary();const{hour,minute}=await getDailySummaryTime();const timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone||null;const identifier=await Notifications.scheduleNotificationAsync({content:{title:summary.title,body:summary.body,data:{source:'daily-summary',dateKey:summary.dateKey,hour,minute,timeZone}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DAILY,hour,minute,repeats:true,...(Platform.OS==='android'?{channelId:DAILY_SUMMARY_CHANNEL}:null)}});await AsyncStorage.setItem(SCHEDULED_ID_KEY,identifier);await logNotificationEvent('daily-summary-scheduled',{dateKey:summary.dateKey,identifier,hour,minute,timeZone});return identifier;}
export async function scheduleTomorrowMorningSummary(summary:DailySummary,now:Date=new Date()):Promise<string|null>{const allowed=await requestNotificationPermission();if(!allowed)return null;await ensureDailySummaryChannel();await cancelStoredNotification(TOMORROW_SCHEDULED_ID_KEY,'cancel-previous-tomorrow-summary-failed');const triggerAt=new Date(now);triggerAt.setDate(triggerAt.getDate()+1);triggerAt.setHours(TOMORROW_SUMMARY_HOUR,TOMORROW_SUMMARY_MINUTE,0,0);const identifier=await Notifications.scheduleNotificationAsync({content:{title:`Domani mattina · ${summary.title.replace(/^Domani /,'')}`,body:summary.body,data:{source:'tomorrow-morning',dateKey:summary.dateKey}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:triggerAt,...(Platform.OS==='android'?{channelId:DAILY_SUMMARY_CHANNEL}:null)}});await AsyncStorage.setItem(TOMORROW_SCHEDULED_ID_KEY,identifier);await logNotificationEvent('tomorrow-morning-summary-scheduled',{dateKey:summary.dateKey,identifier,triggerAt:triggerAt.toISOString()});return identifier;}
export async function disableDailySummaryNotification(){await cancelPreviousScheduledSummary();await cancelStoredNotification(TOMORROW_SCHEDULED_ID_KEY,'cancel-tomorrow-summary-failed');await logNotificationEvent('daily-summary-disabled');}
export async function sendImmediateSummaryNotification(summary:DailySummary,test=false):Promise<string|null>{const allowed=await requestNotificationPermission();if(!allowed){await logNotificationEvent(NOTIFICATIONS_SUPPORTED_HERE?'send-immediate-summary-permission-denied':'send-immediate-summary-skipped-web-unsupported',undefined,NOTIFICATIONS_SUPPORTED_HERE?'warn':'info');return null;}await ensureDailySummaryChannel();await logNotificationEvent('send-immediate-summary-scheduling',{test,foreground:true});try{const identifier=await Notifications.scheduleNotificationAsync({content:{title:test?`[Prova] ${summary.title}`:summary.title,body:summary.body,data:{source:test?'daily-summary-test':'daily-summary-recovered',dateKey:summary.dateKey}},trigger:null});await logNotificationEvent(test?'daily-summary-test-scheduled':'daily-summary-recovered-scheduled',{dateKey:summary.dateKey,identifier});const scheduled=await Notifications.getAllScheduledNotificationsAsync();await logNotificationEvent('send-immediate-summary-verified',{identifier,scheduledCount:scheduled.length});return identifier;}catch(error){await logNotificationEvent('send-immediate-summary-schedule-failed',error,'error');throw error;}}
