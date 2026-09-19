import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { buildTodayGlance } from './widgetData';
import { logNotificationEvent } from './notificationLog';
import { recordDiagnostic } from './diagnostics';
import type { Commitment } from '../types';
import { buildCalendarWidgetData } from './calendarWidgetData';

export async function syncTodayWidget(commitments: Commitment[], now: Date = new Date()) {
  const startedAt=Date.now();
  try {
    const glance = buildTodayGlance(commitments, now);
    const items = glance.items.map((item) => ({ id:item.id, title:item.title, time:item.time, kind:item.kind === 'event' ? 'Evento' : item.kind === 'task' ? 'Task' : 'Reminder' }));
    if (Platform.OS === 'ios') {
      const { default: TodayWidget } = await import('../widgets/TodayWidget');
      TodayWidget.updateSnapshot(glance);
      await logNotificationEvent('today-widget-updated', { platform: 'ios', dateKey: glance.dateKey, count: glance.items.length });
      recordDiagnostic('widget-sync-completed',{platform:'ios',durationMs:Date.now()-startedAt,count:glance.items.length});
      return;
    }
    if (Platform.OS === 'android') {
      const { requestWidgetUpdate } = await import('react-native-android-widget');
      const { TodayWidget } = await import('../widgets/android/TodayWidget');
      const { CalendarWidget } = await import('../widgets/android/CalendarWidget');
      const { getGoogleWorkspaceStatus } = await import('./googleWorkspace');
      let syncEndDate = new Date(now.getFullYear() + 1, 11, 31);
      try { const googleStatus = await getGoogleWorkspaceStatus(); if (googleStatus.range?.endDate) syncEndDate = new Date(`${googleStatus.range.endDate}T23:59:59`); } catch (error) { await logNotificationEvent('calendar-widget-range-load-failed', error, 'warn'); }
      await requestWidgetUpdate({ widgetName: 'TodayAndroidWidget', renderWidget: () => React.createElement(TodayWidget, { items }) });

      const { weeks } = buildCalendarWidgetData(commitments, syncEndDate, now);
      await AsyncStorage.setItem('flowos-calendar-widget-v1',JSON.stringify({dateKey:glance.dateKey,weeks}));
      await requestWidgetUpdate({ widgetName:'CalendarAndroidWidget', renderWidget:()=>React.createElement(CalendarWidget,{weeks}) });
      await logNotificationEvent('today-widget-updated',{platform:'android',dateKey:glance.dateKey,count:items.length,calendarWeeks:weeks.length,calendarDays:weeks.reduce((sum,week)=>sum+week.days.length,0),equalWidthDays:true});
      recordDiagnostic('widget-sync-completed',{platform:'android',durationMs:Date.now()-startedAt,count:items.length,calendarWeeks:weeks.length});
    }
  } catch (error) {
    recordDiagnostic('widget-sync-failed',{durationMs:Date.now()-startedAt,error},'warn');
    await logNotificationEvent('today-widget-update-failed', error, 'warn');
  }
}
