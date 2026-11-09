import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { buildTodayGlance } from './widgetData';
import { friendlyCalendarName, getGoogleWorkspaceStatus } from './googleWorkspace';
import { logNotificationEvent } from './notificationLog';
import { recordDiagnostic } from './diagnostics';
import type { Commitment } from '../types';
import { buildCalendarWidgetData } from './calendarWidgetData';
import { getCalendarWidgetPage } from './calendarWidgetPaging';
import { getLanguage, widgetStrings } from './i18n';
import { activitySourceKey } from './activityColors';
import { colorWithOpacity, getWidgetAppearance, sourceAppearanceColor } from './widgetAppearance';

async function performWidgetSync(commitments: Commitment[], now: Date = new Date()) {
  const startedAt=Date.now();
  try {
    const language=await getLanguage();
    let calendarNames:Map<string,string>|undefined;
    try { const status=await getGoogleWorkspaceStatus(); calendarNames=new Map(status.calendars.map(calendar=>[calendar.google_calendar_id,friendlyCalendarName(calendar.summary,status.connection?.google_email,language)])); } catch {}
    const glance = buildTodayGlance(commitments, now, calendarNames, language);
    const appearance=await getWidgetAppearance();
    const labels=widgetStrings(language);
    const commitmentById=new Map(commitments.map(item=>[item.id,item]));
    const items = glance.items.map((item) => {const source=commitmentById.get(item.id);return { id:item.id, title:item.title, time:item.time, kind:item.kind === 'event' ? labels.event : labels.task, priority:item.priority, sourceColor:source?sourceAppearanceColor(activitySourceKey(source),item.sourceColor??'#F3F4F7',appearance):item.sourceColor };});
    const todayBackgroundColor=colorWithOpacity(appearance.today.backgroundColor,appearance.today.backgroundOpacity);
    const calendarBackgroundColor=colorWithOpacity(appearance.calendar.backgroundColor,appearance.calendar.backgroundOpacity);
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
      let syncEndDate = new Date(now.getFullYear() + 1, 11, 31);
      try { const cachedRange=await AsyncStorage.getItem('flowos-calendar-widget-range-v1'); if(cachedRange){const parsed=JSON.parse(cachedRange);if(parsed?.endDate)syncEndDate=new Date(`${parsed.endDate}T23:59:59`);} } catch {}
      await requestWidgetUpdate({ widgetName: 'TodayAndroidWidget', renderWidget: () => React.createElement(TodayWidget, { items, language, backgroundColor:todayBackgroundColor, textColor:colorWithOpacity(appearance.today.textColor,appearance.today.textOpacity), buttonBackgroundColor:colorWithOpacity(appearance.today.buttonBackgroundColor,appearance.today.buttonBackgroundOpacity), buttonTextColor:colorWithOpacity(appearance.today.buttonTextColor,appearance.today.buttonTextOpacity) }) });

      const { weeks: rawWeeks } = buildCalendarWidgetData(commitments, syncEndDate, now, calendarNames, language);
      const allWeeks=rawWeeks.map(week=>({...week,days:week.days.map(day=>({...day,items:day.items.map(item=>{const source=commitmentById.get(item.id);return {...item,sourceColor:source?sourceAppearanceColor(activitySourceKey(source),String(item.sourceColor),appearance):item.sourceColor};})}))}));
      await AsyncStorage.setItem('flowos-calendar-widget-v2',JSON.stringify({dateKey:glance.dateKey,weeks:allWeeks,language}));
      const page = getCalendarWidgetPage(allWeeks);
      await AsyncStorage.setItem('flowos-calendar-widget-page-v1',String(page.startIndex));
      await requestWidgetUpdate({ widgetName:'CalendarAndroidWidget', renderWidget:()=>React.createElement(CalendarWidget,{weeks:page.weeks,hasOlderWeeks:page.hasOlderWeeks,hasNewerWeeks:page.hasNewerWeeks,language,backgroundColor:calendarBackgroundColor,textColor:colorWithOpacity(appearance.calendar.textColor,appearance.calendar.textOpacity),buttonBackgroundColor:colorWithOpacity(appearance.calendar.buttonBackgroundColor,appearance.calendar.buttonBackgroundOpacity),buttonTextColor:colorWithOpacity(appearance.calendar.buttonTextColor,appearance.calendar.buttonTextOpacity)}) });
      await logNotificationEvent('today-widget-updated',{platform:'android',dateKey:glance.dateKey,count:items.length,calendarWeeks:allWeeks.length,calendarRenderedWeeks:page.weeks.length,calendarDays:allWeeks.reduce((sum,week)=>sum+week.days.length,0),equalWidthDays:true});
      recordDiagnostic('widget-sync-completed',{platform:'android',durationMs:Date.now()-startedAt,count:items.length,calendarWeeks:allWeeks.length,calendarRenderedWeeks:page.weeks.length});
    }
  } catch (error) {
    recordDiagnostic('widget-sync-failed',{durationMs:Date.now()-startedAt,error},'warn');
    await logNotificationEvent('today-widget-update-failed', error, 'warn');
  }
}


let widgetSyncTimer: ReturnType<typeof setTimeout> | null = null;
let widgetSyncRunning = false;
let widgetSyncPending = false;
let latestWidgetCommitments: Commitment[] | null = null;
let latestWidgetNow = new Date();
let widgetSyncWaiters: Array<() => void> = [];

async function flushWidgetSyncQueue() {
  if (widgetSyncRunning) return;
  widgetSyncRunning = true;
  try {
    do {
      widgetSyncPending = false;
      const commitments = latestWidgetCommitments ?? [];
      const now = latestWidgetNow;
      latestWidgetCommitments = null;
      await performWidgetSync(commitments, now);
    } while (widgetSyncPending || latestWidgetCommitments);
  } finally {
    widgetSyncRunning = false;
    const waiters = widgetSyncWaiters.splice(0);
    waiters.forEach(resolve => resolve());
  }
}

export function syncTodayWidget(commitments: Commitment[], now: Date = new Date()): Promise<void> {
  latestWidgetCommitments = commitments;
  latestWidgetNow = now;
  widgetSyncPending = true;
  if (widgetSyncTimer) clearTimeout(widgetSyncTimer);
  const promise = new Promise<void>(resolve => widgetSyncWaiters.push(resolve));
  widgetSyncTimer = setTimeout(() => {
    widgetSyncTimer = null;
    void flushWidgetSyncQueue();
  }, 150);
  return promise;
}
