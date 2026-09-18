import { Platform } from 'react-native';
import type { DailySummary } from './dailySummary';

export const NOTIFICATIONS_SUPPORTED_HERE=Platform.OS!=='web';
export const DEFAULT_DAILY_SUMMARY_HOUR=7;
export const DEFAULT_DAILY_SUMMARY_MINUTE=30;

async function nativeService(){
  if(Platform.OS==='web')return null;
  return import('./notificationService');
}

export async function isDailySummaryEnabledStored(){const service=await nativeService();if(!service)return true;return service.isDailySummaryEnabledStored();}
export async function setDailySummaryEnabledStored(enabled:boolean){const service=await nativeService();if(service)await service.setDailySummaryEnabledStored(enabled);}
export async function getDailySummaryTime(){const service=await nativeService();if(!service)return{hour:DEFAULT_DAILY_SUMMARY_HOUR,minute:DEFAULT_DAILY_SUMMARY_MINUTE};return service.getDailySummaryTime();}
export async function setDailySummaryTime(hour:number,minute:number){const service=await nativeService();if(service)await service.setDailySummaryTime(hour,minute);}
export async function getLastRecoveryDateKey(){const service=await nativeService();if(!service)return null;return service.getLastRecoveryDateKey();}
export async function disableDailySummaryNotification(){const service=await nativeService();if(service)await service.disableDailySummaryNotification();}
export async function sendImmediateSummaryNotification(summary:DailySummary,test=false){const service=await nativeService();if(!service)return null;return service.sendImmediateSummaryNotification(summary,test);}
