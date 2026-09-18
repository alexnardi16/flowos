import React from 'react';
import { Platform } from 'react-native';
import { buildTodayGlance } from './widgetData';
import { logNotificationEvent } from './notificationLog';
import type { Commitment } from '../types';
import type { AndroidCalendarDay, AndroidCalendarWeek } from '../widgets/android/CalendarWidget';

type AndroidCalendarItem = AndroidCalendarDay['items'][number];

export async function syncTodayWidget(commitments: Commitment[], now: Date = new Date()) {
  try {
    const glance = buildTodayGlance(commitments, now);
    if (Platform.OS === 'ios') {
      const { default: TodayWidget } = await import('../widgets/TodayWidget');
      TodayWidget.updateSnapshot(glance);
      await logNotificationEvent('today-widget-updated', { platform: 'ios', dateKey: glance.dateKey, count: glance.items.length });
      return;
    }
    if (Platform.OS === 'android') {
      const { requestWidgetUpdate } = await import('react-native-android-widget');
      const { TodayWidget } = await import('../widgets/android/TodayWidget');
      const { CalendarWidget } = await import('../widgets/android/CalendarWidget');
      const { getGoogleWorkspaceStatus } = await import('./googleWorkspace');
      let syncEndDate = new Date(now.getFullYear() + 1, 11, 31);
      try { const googleStatus = await getGoogleWorkspaceStatus(); if (googleStatus.range?.endDate) syncEndDate = new Date(`${googleStatus.range.endDate}T23:59:59`); } catch (error) { await logNotificationEvent('calendar-widget-range-load-failed', error, 'warn'); }
      const items: AndroidCalendarItem[] = glance.items.map((item) => ({ id: item.id, title: item.title, time: item.time, kind: item.kind === 'event' ? 'Evento' : item.kind === 'task' ? 'Task' : 'Reminder' }));
      await requestWidgetUpdate({ widgetName: 'TodayAndroidWidget', renderWidget: () => React.createElement(TodayWidget, { items }) });

      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const months = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
      const dayNames = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
      const todayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const active = commitments.filter((item) => item.status !== 'done' && !item.deletedAt);
      const weeks: AndroidCalendarWeek[] = [];

      // Render every week from the current week through the final week of the configured Google sync range.
      for (let w = 0; ; w += 1) {
        const start = new Date(monday); start.setDate(monday.getDate() + w * 7);
        if (start.getTime() > syncEndDate.getTime()) break;
        const days: AndroidCalendarDay[] = [];
        for (let i = 0; i < 7; i += 1) {
          const day = new Date(start); day.setDate(start.getDate() + i);
          const key = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
          const dayItems: AndroidCalendarItem[] = active.filter((item) => {
            const value = item.scheduledAt ?? item.dueAt; if (!value) return false;
            const date = new Date(value);
            const itemKey = item.allDay
              ? `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`
              : `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
            return itemKey === key;
          }).sort((a,b)=>new Date(a.scheduledAt ?? a.dueAt!).getTime()-new Date(b.scheduledAt ?? b.dueAt!).getTime()).map((item)=>({
            id:item.id,title:item.title,time:item.allDay?'':new Date(item.scheduledAt ?? item.dueAt!).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}),kind:item.kind==='event'?'Evento':item.kind==='task'?'Task':'Reminder'
          }));
          days.push({dateKey:key,label:`${dayNames[i]} ${day.getDate()}`,isToday:key===todayKey,items:dayItems});
        }
        const monthStart = days.find(day => Number(day.dateKey.slice(-2)) === 1);
        const monthTitle = w === 0 ? `${months[start.getMonth()]} ${start.getFullYear()}` : monthStart ? `${months[Number(monthStart.dateKey.slice(5,7))-1]} ${monthStart.dateKey.slice(0,4)}` : '';
        weeks.push({title:monthTitle,days});
      }
      await requestWidgetUpdate({ widgetName:'CalendarAndroidWidget', renderWidget:()=>React.createElement(CalendarWidget,{weeks}) });
      await logNotificationEvent('today-widget-updated',{platform:'android',dateKey:glance.dateKey,count:items.length,calendarWeeks:weeks.length,calendarDays:weeks.reduce((sum,week)=>sum+week.days.length,0),equalWidthDays:true});
    }
  } catch (error) { await logNotificationEvent('today-widget-update-failed', error, 'warn'); }
}
