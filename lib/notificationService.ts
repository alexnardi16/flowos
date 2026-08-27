import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DailySummary } from './dailySummary';
import { logNotificationEvent } from './notificationLog';
import { hasRecoveredToday } from './notificationDedup';

export { hasRecoveredToday };
export const NOTIFICATIONS_SUPPORTED_HERE = Platform.OS !== 'web';
export const DAILY_SUMMARY_CHANNEL = 'flowos-daily-summary';
export const DAILY_SUMMARY_HOUR = 7;
export const DAILY_SUMMARY_MINUTE = 30;
export const TOMORROW_SUMMARY_HOUR = 8;
export const TOMORROW_SUMMARY_MINUTE = 0;

const SCHEDULED_ID_KEY = 'flowos:notifications:daily-summary-scheduled-id';
const TOMORROW_SCHEDULED_ID_KEY = 'flowos:notifications:tomorrow-summary-scheduled-id';
const LAST_RECOVERY_DATE_KEY = 'flowos:notifications:daily-summary-last-recovery-date';
const ENABLED_KEY = 'flowos:notifications:daily-summary-enabled';

export async function ensureDailySummaryChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(DAILY_SUMMARY_CHANNEL, { name: 'Riepilogo giornaliero FlowOS', importance: Notifications.AndroidImportance.DEFAULT });
}
export async function requestNotificationPermission(): Promise<boolean> {
  if (!NOTIFICATIONS_SUPPORTED_HERE) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}
export async function isDailySummaryEnabledStored(): Promise<boolean> { const raw = await AsyncStorage.getItem(ENABLED_KEY); return raw === null ? true : raw === '1'; }
export async function setDailySummaryEnabledStored(enabled: boolean) { await AsyncStorage.setItem(ENABLED_KEY, enabled ? '1' : '0'); await logNotificationEvent('daily-summary-preference-changed', { enabled }); }
export async function getLastRecoveryDateKey(): Promise<string | null> { return AsyncStorage.getItem(LAST_RECOVERY_DATE_KEY); }
export async function markRecovered(dateKey: string) { await AsyncStorage.setItem(LAST_RECOVERY_DATE_KEY, dateKey); }

async function cancelStoredNotification(key: string, logEvent: string) {
  if (!NOTIFICATIONS_SUPPORTED_HERE) return;
  const previousId = await AsyncStorage.getItem(key);
  if (!previousId) return;
  try { await Notifications.cancelScheduledNotificationAsync(previousId); }
  catch (error) { await logNotificationEvent(logEvent, error, 'warn'); }
  await AsyncStorage.removeItem(key);
}

async function cancelPreviousScheduledSummary() { await cancelStoredNotification(SCHEDULED_ID_KEY, 'cancel-previous-summary-failed'); }

export async function scheduleDailySummaryNotification(summary: DailySummary): Promise<string | null> {
  const allowed = await requestNotificationPermission();
  if (!allowed) { await logNotificationEvent(NOTIFICATIONS_SUPPORTED_HERE ? 'schedule-summary-permission-denied' : 'schedule-summary-skipped-web-unsupported', undefined, NOTIFICATIONS_SUPPORTED_HERE ? 'warn' : 'info'); return null; }
  await ensureDailySummaryChannel();
  await cancelPreviousScheduledSummary();
  const identifier = await Notifications.scheduleNotificationAsync({
    content: { title: summary.title, body: summary.body, data: { source: 'daily-summary', dateKey: summary.dateKey } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, hour: DAILY_SUMMARY_HOUR, minute: DAILY_SUMMARY_MINUTE, repeats: true, ...(Platform.OS === 'android' ? { channelId: DAILY_SUMMARY_CHANNEL } : null) },
  });
  await AsyncStorage.setItem(SCHEDULED_ID_KEY, identifier);
  await logNotificationEvent('daily-summary-scheduled', { dateKey: summary.dateKey, identifier });
  return identifier;
}

/** Schedules a fresh, one-shot preview of tomorrow every morning at 08:00 local time. Re-running after sync replaces the previous snapshot. */
export async function scheduleTomorrowMorningSummary(summary: DailySummary, now: Date = new Date()): Promise<string | null> {
  const allowed = await requestNotificationPermission();
  if (!allowed) return null;
  await ensureDailySummaryChannel();
  await cancelStoredNotification(TOMORROW_SCHEDULED_ID_KEY, 'cancel-previous-tomorrow-summary-failed');
  const triggerAt = new Date(now);
  triggerAt.setDate(triggerAt.getDate() + 1);
  triggerAt.setHours(TOMORROW_SUMMARY_HOUR, TOMORROW_SUMMARY_MINUTE, 0, 0);
  const identifier = await Notifications.scheduleNotificationAsync({
    content: { title: `Domani mattina · ${summary.title.replace(/^Domani /, '')}`, body: summary.body, data: { source: 'tomorrow-morning', dateKey: summary.dateKey } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerAt, ...(Platform.OS === 'android' ? { channelId: DAILY_SUMMARY_CHANNEL } : null) },
  });
  await AsyncStorage.setItem(TOMORROW_SCHEDULED_ID_KEY, identifier);
  await logNotificationEvent('tomorrow-morning-summary-scheduled', { dateKey: summary.dateKey, identifier, triggerAt: triggerAt.toISOString() });
  return identifier;
}

export async function disableDailySummaryNotification() {
  await cancelPreviousScheduledSummary();
  await cancelStoredNotification(TOMORROW_SCHEDULED_ID_KEY, 'cancel-tomorrow-summary-failed');
  await logNotificationEvent('daily-summary-disabled');
}

export async function sendImmediateSummaryNotification(summary: DailySummary, test = false): Promise<string | null> {
  const allowed = await requestNotificationPermission();
  if (!allowed) { await logNotificationEvent(NOTIFICATIONS_SUPPORTED_HERE ? 'send-immediate-summary-permission-denied' : 'send-immediate-summary-skipped-web-unsupported', undefined, NOTIFICATIONS_SUPPORTED_HERE ? 'warn' : 'info'); return null; }
  await ensureDailySummaryChannel();
  const identifier = await Notifications.scheduleNotificationAsync({
    content: { title: test ? `[Prova] ${summary.title}` : summary.title, body: summary.body, data: { source: test ? 'daily-summary-test' : 'daily-summary-recovered', dateKey: summary.dateKey } },
    trigger: null,
  });
  await logNotificationEvent(test ? 'daily-summary-test-sent' : 'daily-summary-recovered-sent', { dateKey: summary.dateKey, identifier });
  return identifier;
}
