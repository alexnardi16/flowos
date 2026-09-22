import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DailySummary } from './dailySummary';
import { logNotificationEvent } from './notificationLog';
import { hasRecoveredToday } from './notificationDedup';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export { hasRecoveredToday };

export const NOTIFICATIONS_SUPPORTED_HERE = Platform.OS !== 'web';
export const DAILY_SUMMARY_CHANNEL = 'flowos-daily-summary';
export const DEFAULT_DAILY_SUMMARY_HOUR = 7;
export const DEFAULT_DAILY_SUMMARY_MINUTE = 30;
export const DAILY_SUMMARY_HOUR = DEFAULT_DAILY_SUMMARY_HOUR;
export const DAILY_SUMMARY_MINUTE = DEFAULT_DAILY_SUMMARY_MINUTE;
export const TOMORROW_SUMMARY_HOUR = 8;
export const TOMORROW_SUMMARY_MINUTE = 0;

export type DailySummaryTime = { hour: number; minute: number };

const SCHEDULED_ID_KEY = 'flowos:notifications:daily-summary-scheduled-id';
const TOMORROW_SCHEDULED_ID_KEY = 'flowos:notifications:tomorrow-summary-scheduled-id';
const LAST_RECOVERY_DATE_KEY = 'flowos:notifications:daily-summary-last-recovery-date';
const ENABLED_KEY = 'flowos:notifications:daily-summary-enabled';
const TIME_KEY = 'flowos:notifications:daily-summary-time';

type NotificationData = Record<string, unknown>;

function notificationSource(notification: Notifications.NotificationRequest | Notifications.Notification): string | null {
  const data = 'request' in notification
    ? notification.request.content.data
    : notification.content.data;
  const record = data as NotificationData | null | undefined;
  return typeof record?.source === 'string' ? record.source : null;
}

export async function ensureDailySummaryChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(DAILY_SUMMARY_CHANNEL, {
    name: 'Riepilogo giornaliero FlowOS',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!NOTIFICATIONS_SUPPORTED_HERE) return false;
  const current = await Notifications.getPermissionsAsync();
  await logNotificationEvent('notification-permission-state', {
    granted: current.granted,
    status: current.status,
    canAskAgain: current.canAskAgain,
  });
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  await logNotificationEvent('notification-permission-request-result', {
    granted: requested.granted,
    status: requested.status,
    canAskAgain: requested.canAskAgain,
  });
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

export async function getDailySummaryTime(): Promise<DailySummaryTime> {
  const raw = await AsyncStorage.getItem(TIME_KEY);
  if (!raw) return { hour: DEFAULT_DAILY_SUMMARY_HOUR, minute: DEFAULT_DAILY_SUMMARY_MINUTE };
  try {
    const parsed = JSON.parse(raw) as Partial<DailySummaryTime>;
    if (
      Number.isInteger(parsed.hour) &&
      Number.isInteger(parsed.minute) &&
      parsed.hour! >= 0 &&
      parsed.hour! <= 23 &&
      parsed.minute! >= 0 &&
      parsed.minute! <= 59
    ) {
      return { hour: parsed.hour!, minute: parsed.minute! };
    }
  } catch {}
  return { hour: DEFAULT_DAILY_SUMMARY_HOUR, minute: DEFAULT_DAILY_SUMMARY_MINUTE };
}

export async function setDailySummaryTime(hour: number, minute: number) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error('Orario non valido.');
  }
  await AsyncStorage.setItem(TIME_KEY, JSON.stringify({ hour, minute }));
  await logNotificationEvent('daily-summary-time-changed', {
    hour,
    minute,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
  });
}

function looksLikeLegacyDailySummaryTitle(title: string): boolean {
  return (
    /^Oggi hai \\d+ impegn/.test(title) ||
    /^Domani hai \\d+ impegn/.test(title) ||
    /^Nessun impegno pianificato per (oggi|domani)$/.test(title) ||
    /^Domani mattina · /.test(title)
  );
}

async function cancelScheduledNotificationsBySource(sources: string[]) {
  if (!NOTIFICATIONS_SUPPORTED_HERE) return;
  const sourceSet = new Set(sources);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    const source = notificationSource(notification);
    const title = notification.request.content.title ?? '';
    const matchesKnownSource = Boolean(source && sourceSet.has(source));
    const matchesLegacySummary =
      sources.includes('daily-summary') &&
      looksLikeLegacyDailySummaryTitle(title);
    const matchesLegacyTomorrow =
      sources.includes('tomorrow-morning') &&
      looksLikeLegacyDailySummaryTitle(title);
    if (!matchesKnownSource && !matchesLegacySummary && !matchesLegacyTomorrow) continue;
    await Notifications.cancelScheduledNotificationAsync(notification.identifier).catch((error) =>
      logNotificationEvent('cancel-summary-scheduled-notification-failed', error, 'warn'),
    );
  }
}

function isFlowOSDailySummary(notification: Notifications.Notification): boolean {
  const source = notificationSource(notification);
  if (source === 'daily-summary' || source === 'daily-summary-recovered' || source === 'tomorrow-morning') return true;

  // Older FlowOS builds did not always attach a source to the notification.
  // Recognize their stable Italian summary titles so an app upgrade can
  // clean up stale/duplicate summaries already shown by the previous build.
  const title = notification.request.content.title ?? '';
  return (
    /^Oggi hai \\d+ impegn/.test(title) ||
    /^Domani hai \\d+ impegn/.test(title) ||
    /^Nessun impegno pianificato per (oggi|domani)$/.test(title) ||
    /^Domani mattina · /.test(title)
  );
}

export async function reconcilePresentedDailySummary(summary: DailySummary): Promise<boolean> {
  if (!NOTIFICATIONS_SUPPORTED_HERE) return false;
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    const matching = presented.filter(isFlowOSDailySummary);

    if (
      matching.length === 1 &&
      matching[0].request.content.title === summary.title &&
      matching[0].request.content.body === summary.body
    ) {
      return true;
    }

    // Remove every stale/duplicate FlowOS summary, regardless of dateKey.
    // This is important after upgrades: old scheduled notifications may have
    // been created before the current source/dateKey metadata existed.
    for (const notification of matching) {
      await Notifications.dismissNotificationAsync(notification.request.identifier).catch((error) =>
        logNotificationEvent('dismiss-stale-summary-failed', error, 'warn'),
      );
    }
    return false;
  } catch (error) {
    await logNotificationEvent('presented-summary-reconcile-failed', error, 'warn');
    return false;
  }
}

export async function getLastRecoveryDateKey() {
  return AsyncStorage.getItem(LAST_RECOVERY_DATE_KEY);
}

export async function markRecovered(dateKey: string) {
  await AsyncStorage.setItem(LAST_RECOVERY_DATE_KEY, dateKey);
}

export async function scheduleDailySummaryNotification(summary: DailySummary): Promise<string | null> {
  const allowed = await requestNotificationPermission();
  if (!allowed) {
    await logNotificationEvent(
      NOTIFICATIONS_SUPPORTED_HERE ? 'schedule-summary-permission-denied' : 'schedule-summary-skipped-web-unsupported',
      undefined,
      NOTIFICATIONS_SUPPORTED_HERE ? 'warn' : 'info',
    );
    return null;
  }

  await ensureDailySummaryChannel();
  // Cancel every queued summary from older/racing runs, not only the last
  // identifier stored in AsyncStorage.
  await cancelScheduledNotificationsBySource(['daily-summary']);

  const { hour, minute } = await getDailySummaryTime();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: summary.title,
      body: summary.body,
      data: { source: 'daily-summary', dateKey: summary.dateKey, hour, minute, timeZone },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      ...(Platform.OS === 'android' ? { channelId: DAILY_SUMMARY_CHANNEL } : null),
    },
  });
  await AsyncStorage.setItem(SCHEDULED_ID_KEY, identifier);
  await logNotificationEvent('daily-summary-scheduled', {
    dateKey: summary.dateKey,
    identifier,
    hour,
    minute,
    timeZone,
  });
  return identifier;
}

export async function scheduleTomorrowMorningSummary(summary: DailySummary, now: Date = new Date()): Promise<string | null> {
  const allowed = await requestNotificationPermission();
  if (!allowed) return null;

  await ensureDailySummaryChannel();
  await cancelScheduledNotificationsBySource(['tomorrow-morning']);

  const triggerAt = new Date(now);
  triggerAt.setDate(triggerAt.getDate() + 1);
  triggerAt.setHours(TOMORROW_SUMMARY_HOUR, TOMORROW_SUMMARY_MINUTE, 0, 0);

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Domani mattina · ${summary.title.replace(/^Domani /, '')}`,
      body: summary.body,
      data: { source: 'tomorrow-morning', dateKey: summary.dateKey },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerAt,
      ...(Platform.OS === 'android' ? { channelId: DAILY_SUMMARY_CHANNEL } : null),
    },
  });
  await AsyncStorage.setItem(TOMORROW_SCHEDULED_ID_KEY, identifier);
  await logNotificationEvent('tomorrow-morning-summary-scheduled', {
    dateKey: summary.dateKey,
    identifier,
    triggerAt: triggerAt.toISOString(),
  });
  return identifier;
}

export async function disableDailySummaryNotification() {
  await cancelScheduledNotificationsBySource(['daily-summary', 'tomorrow-morning']);
  await AsyncStorage.removeItem(SCHEDULED_ID_KEY);
  await AsyncStorage.removeItem(TOMORROW_SCHEDULED_ID_KEY);
  await logNotificationEvent('daily-summary-disabled');
}

export async function sendImmediateSummaryNotification(summary: DailySummary, test = false): Promise<string | null> {
  const allowed = await requestNotificationPermission();
  if (!allowed) {
    await logNotificationEvent(
      NOTIFICATIONS_SUPPORTED_HERE ? 'send-immediate-summary-permission-denied' : 'send-immediate-summary-skipped-web-unsupported',
      undefined,
      NOTIFICATIONS_SUPPORTED_HERE ? 'warn' : 'info',
    );
    return null;
  }

  await ensureDailySummaryChannel();
  await logNotificationEvent('send-immediate-summary-scheduling', { test, foreground: true });
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: test ? `[Prova] ${summary.title}` : summary.title,
        body: summary.body,
        data: { source: test ? 'daily-summary-test' : 'daily-summary-recovered', dateKey: summary.dateKey },
      },
      trigger: null,
    });
    await logNotificationEvent(test ? 'daily-summary-test-scheduled' : 'daily-summary-recovered-scheduled', {
      dateKey: summary.dateKey,
      identifier,
    });
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await logNotificationEvent('send-immediate-summary-verified', { identifier, scheduledCount: scheduled.length });
    return identifier;
  } catch (error) {
    await logNotificationEvent('send-immediate-summary-schedule-failed', error, 'error');
    throw error;
  }
}
