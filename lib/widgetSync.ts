import React from 'react';
import { Platform } from 'react-native';
import { buildTodayGlance } from './widgetData';
import { logNotificationEvent } from './notificationLog';
import type { Commitment } from '../types';

export async function syncTodayWidget(commitments: Commitment[], now: Date = new Date()) {
  try {
    const glance=buildTodayGlance(commitments,now);
    if(Platform.OS==='ios'){
      const {default:TodayWidget}=await import('../widgets/TodayWidget');
      TodayWidget.updateSnapshot(glance);
      await logNotificationEvent('today-widget-updated',{platform:'ios',dateKey:glance.dateKey,count:glance.items.length});
      return;
    }
    if(Platform.OS==='android'){
      const {requestWidgetUpdate}=await import('react-native-android-widget');
      const {TodayWidget}=await import('../widgets/android/TodayWidget');
      const items=glance.items.map(item=>({id:item.id,title:item.title,time:item.time,kind:item.kind==='event'?'Evento':item.kind==='task'?'Task':'Reminder'}));
      await requestWidgetUpdate({widgetName:'TodayAndroidWidget',renderWidget:()=>React.createElement(TodayWidget,{items,overdueCount:glance.overdueCount})});
      await logNotificationEvent('today-widget-updated',{platform:'android',dateKey:glance.dateKey,count:items.length});
    }
  }catch(error){await logNotificationEvent('today-widget-update-failed',error,'warn');}
}
