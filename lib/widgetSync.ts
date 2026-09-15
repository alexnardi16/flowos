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
      const {CalendarWidget}=await import('../widgets/android/CalendarWidget');
      const items=glance.items.map(item=>({id:item.id,title:item.title,time:item.time,kind:item.kind==='event'?'Evento':item.kind==='task'?'Task':'Reminder'}));
      await requestWidgetUpdate({widgetName:'TodayAndroidWidget',renderWidget:()=>React.createElement(TodayWidget,{items,overdueCount:glance.overdueCount})});
      const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate());monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
      const months=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];const dayNames=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];const active=commitments.filter(item=>item.status!=='done'&&!item.deletedAt);const weeks=[];
      for(let w=0;w<4;w++){const start=new Date(monday);start.setDate(monday.getDate()+w*7);const end=new Date(start);end.setDate(start.getDate()+6);const title=`${months[start.getMonth()]} ${start.getFullYear()}${start.getMonth()!==end.getMonth()||start.getFullYear()!==end.getFullYear()?` - ${months[end.getMonth()]} ${end.getFullYear()}`:''}`;const days=[];for(let i=0;i<7;i++){const day=new Date(start);day.setDate(start.getDate()+i);const key=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;const dayItems=active.filter(item=>{const value=item.scheduledAt??item.dueAt;if(!value)return false;const d=new Date(value);const itemKey=item.allDay?`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;return itemKey===key;}).sort((a,b)=>new Date(a.scheduledAt??a.dueAt!).getTime()-new Date(b.scheduledAt??b.dueAt!).getTime()).map(item=>({id:item.id,title:item.title,time:item.allDay?'Tutto il giorno':new Date(item.scheduledAt??item.dueAt!).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}),kind:item.kind==='event'?'Evento':item.kind==='task'?'Task':'Reminder'}));days.push({label:`${dayNames[i]} ${day.getDate()}`,items:dayItems});}weeks.push({title,days});}
      await requestWidgetUpdate({widgetName:'CalendarAndroidWidget',renderWidget:()=>React.createElement(CalendarWidget,{weeks})});
      await logNotificationEvent('today-widget-updated',{platform:'android',dateKey:glance.dateKey,count:items.length});
    }
  }catch(error){await logNotificationEvent('today-widget-update-failed',error,'warn');}
}
