import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DailySummary } from './dailySummary';
import { logNotificationEvent } from './notificationLog';
import { hasRecoveredToday } from './notificationDedup';

export { hasRecoveredToday };

export const DAILY_SUMMARY_CHANNEL = 'flowos-daily-summary';
export const DAILY_SUMMARY_HOUR = 7;
export const DAILY_SUMMARY_MINUTE = 30;

const SCHEDULED_ID_KEY = 'flowos:notifications:daily-summary-scheduled-id';
const LAST_RECOVERY_DATE_KEY = 'flowos:notifications:daily-summary-last-recovery-date';
const ENABLED_KEY = 'flowos:notifications:daily-summary-enabled';

export async function ensureDailySummaryChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(DAILY_SUMMARY_CHANNEL, {
    name: 'Riepilogo giornaliero FlowOS',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function isDailySummaryEnabledStored(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(ENABLED_KEY);
  return raw === null ? true : raw === '1';
}

export async function setDailySummaryEnabledStored(enabled: boolean) {
  await AsyncStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
  await logNotificationEvent('daily-summary-preference-changed', { enabled });
}

export async function getLastRecoveryDateKey(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_RECOVERY_DATE_KEY);
}

export async function markRecovered(dateKey: string) {
  await AsyncStorage.setItem(LAST_RECOVERY_DATE_KEY, dateKey);
}

async function cancelPreviousScheduledSummary() {
  const previousId = await AsyncStorage.getItem(SCHEDULED_ID_KEY);
  if (!previousId) return;
  try { await Notifications.cancelScheduledNotificationAsync(previousId); }
  catch (error) { await logNotificationEvent('cancel-previous-summary-failed', error, 'warn'); }
  await AsyncStorage.removeItem(SCHEDULED_ID_KEY);
}

/**
 * (Re)schedules the recurring 07:30 local notification. Cancels any
 * previously scheduled one first, so there is always at most one pending
 * daily-summary notification (prevents duplicates when this is called
 * repeatedly, e.g. once at app start and again after each background sync).
 *
 * Important honesty note: the trigger fires reliably close to 07:30 because
 * it is a native OS calendar alarm, not something FlowOS's own code has to
 * wake up for. But the *content* is a snapshot taken whenever this function
 * last ran — if no sync managed to run before 07:30, the notification still
 * fires on time, just with slightly stale data.
 */
export async function scheduleDailySummaryNotification(summary: DailySummary): Promise<string | null> {
  const allowed = await requestNotificationPermission();
  if (!allowed) {
    await logNotificationEvent('schedule-summary-permission-denied', undefined, 'warn');
    return null;
  }
  await ensureDailySummaryChannel();
  await cancelPreviousScheduledSummary();

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: summary.title,
      body: summary.body,
      data: { source: 'daily-summary', dateKey: summary.dateKey },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: DAILY_SUMMARY_HOUR,
      minute: DAILY_SUMMARY_MINUTE,
      repeats: true,
      ...(Platform.OS === 'android' ? { channelId: DAILY_SUMMARY_CHANNEL } : null),
    },
  });

  await AsyncStorage.setItem(SCHEDULED_ID_KEY, identifier);
  await logNotificationEvent('daily-summary-scheduled', { dateKey: summary.dateKey, identifier });
  return identifier;
}

export async function disableDailySummaryNotification() {
  await cancelPreviousScheduledSummary();
  await logNotificationEvent('daily-summary-disabled');
}

/**
 * Fires the summary right away instead of waiting for the recurring
 * trigger. Used for recovery (device off/offline at 07:30) and for the
 * "invia ora di prova" button in Settings → Notifiche.
 */
export async function sendImmediateSummaryNotification(summary: DailySummary, test = false): Promise<string | null> {
  const allowed = await requestNotificationPermission();
  if (!allowed) {
    await logNotificationEvent('send-immediate-summary-permission-denied', undefined, 'warn');
    return null;
  }
  await ensureDailySummaryChannel();
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: test ? `[Prova] ${summary.title}` : summary.title,
      body: summary.body,
      data: { source: test ? 'daily-summary-test' : 'daily-summary-recovered', dateKey: summary.dateKey },
    },
    trigger: null,
  });
  await logNotificationEvent(test ? 'daily-summary-test-sent' : 'daily-summary-recovered-sent', { dateKey: summary.dateKey, identifier });
  return identifier;
}
