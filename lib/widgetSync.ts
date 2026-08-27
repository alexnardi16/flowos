import React from 'react';
import { Platform } from 'react-native';
import { buildTodayGlance } from './widgetData';
import { logNotificationEvent } from './notificationLog';
import type { Commitment } from '../types';

export async function syncTodayWidget(commitments: Commitment[], now: Date = new Date()) {
  try {
    if (Platform.OS === 'ios') {
      const { default: TodayWidget } = await import('../widgets/TodayWidget');
      const glance = buildTodayGlance(commitments, now);
      TodayWidget.updateSnapshot(glance);
      await logNotificationEvent('today-widget-updated', { platform: 'ios', dateKey: glance.dateKey });
      return;
    }
    if (Platform.OS === 'android') {
      const { requestWidgetUpdate } = await import('react-native-android-widget');
      const { TodayWidget } = await import('../widgets/android/TodayWidget');
      const active = commitments.filter((item) => item.status !== 'done' && !item.deletedAt);
      const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const items = active
        .map((item) => ({ item, date: item.scheduledAt ?? item.dueAt }))
        .filter(({ item, date }) => {
          if (!date) return false;
          const d = new Date(date);
          return item.allDay
            ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}` === dayKey
            : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === dayKey;
        })
        .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
        .map(({ item, date }) => ({
          id: item.id,
          title: item.title,
          time: item.allDay ? 'Tutto il giorno' : new Date(date!).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
          kind: item.kind === 'event' ? 'Evento' : item.kind === 'task' ? 'Task' : 'Reminder',
        }));
      const overdueCount = active.filter((item) => item.dueAt && new Date(item.dueAt).getTime() < now.getTime()).length;
      await requestWidgetUpdate({ widgetName: 'TodayAndroidWidget', renderWidget: () => React.createElement(TodayWidget, { items, overdueCount }) });
      await logNotificationEvent('today-widget-updated', { platform: 'android', dateKey: dayKey, count: items.length });
    }
  } catch (error) {
    await logNotificationEvent('today-widget-update-failed', error, 'warn');
  }
}
