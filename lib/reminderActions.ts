import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useFlowStore } from './store';
import { logNotificationEvent } from './notificationLog';
import { ensureReminderNotificationCategory, EVENT_REMINDER_CHANNEL, REMINDER_ACTION_COMPLETE, REMINDER_ACTION_POSTPONE, REMINDER_ACTION_CATEGORY } from './reminderEngine';

export const PENDING_REMINDER_SNOOZE_KEY = 'flowos:notifications:pending-snooze';

export type PendingReminderSnooze = {
  commitmentId: string;
  notificationId: string;
  title: string;
};

export async function handleReminderNotificationResponse(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  if (data?.source !== 'reminder' && data?.source !== 'reminder-snoozed') return false;

  const commitmentId = typeof data?.commitmentId === 'string' ? data.commitmentId : undefined;
  if (!commitmentId) return false;

  await Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => undefined);

  if (response.actionIdentifier === REMINDER_ACTION_COMPLETE) {
    const item = useFlowStore.getState().commitments.find((entry) => entry.id === commitmentId);
    if (!item) return true;
    await useFlowStore.getState().updateCommitment({
      ...item,
      reminderDismissedAt: new Date().toISOString(),
    });
    await logNotificationEvent('reminder-completed-from-notification', { commitmentId });
    return true;
  }

  if (response.actionIdentifier === REMINDER_ACTION_POSTPONE) {
    const pending: PendingReminderSnooze = {
      commitmentId,
      notificationId: response.notification.request.identifier,
      title: response.notification.request.content.title ?? 'Promemoria FlowOS',
    };
    await AsyncStorage.setItem(PENDING_REMINDER_SNOOZE_KEY, JSON.stringify(pending));
    router.push({
      pathname: '/reminder-snooze',
      params: { commitmentId, notificationId: pending.notificationId },
    });
    return true;
  }

  const item = useFlowStore.getState().commitments.find((entry) => entry.id === commitmentId);
  if (item) {
    router.replace({ pathname: '/today', params: { widgetAction: 'manage', id: commitmentId } });
  }
  return true;
}

export async function scheduleSnoozedReminder(commitmentId: string, notificationId: string, triggerAt: Date) {
  const item = useFlowStore.getState().commitments.find((entry) => entry.id === commitmentId);
  if (!item) throw new Error('Attività non trovata.');
  if (triggerAt.getTime() <= Date.now()) throw new Error('Scegli una data e un orario futuri.');

  await ensureReminderNotificationCategory();
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: item.title,
      body: 'Promemoria FlowOS rimandato',
      data: {
        source: 'reminder-snoozed',
        commitmentId,
        originalNotificationId: notificationId,
      },
      categoryIdentifier: REMINDER_ACTION_CATEGORY,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerAt,
      ...(Platform.OS === 'android' ? { channelId: EVENT_REMINDER_CHANNEL } : null),
    },
  });

  await AsyncStorage.removeItem(PENDING_REMINDER_SNOOZE_KEY);
  await logNotificationEvent('reminder-snoozed', { commitmentId, originalNotificationId: notificationId, identifier, triggerAt: triggerAt.toISOString() });
  return identifier;
}
