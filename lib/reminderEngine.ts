import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildReminderPlan, summarizeTaskList, type ReminderPlan } from './reminderPlan';
import { buildCustomReminders, formatReminderOffsetLabel } from './customReminders';
import { ensureDailySummaryChannel, NOTIFICATIONS_SUPPORTED_HERE, requestNotificationPermission } from './notificationService';
import { syncTodayWidget } from './widgetSync';
import { logNotificationEvent } from './notificationLog';
import type { Commitment } from '../types';

export const EVENT_REMINDER_CHANNEL = 'flowos-event-reminders';
export const DUE_SOON_CHANNEL = 'flowos-due-soon';
export const OVERDUE_CHANNEL = 'flowos-overdue';

const EVENT_REMINDER_MAP_KEY = 'flowos:notifications:event-reminder-map';
const DUE_SOON_ID_KEY = 'flowos:notifications:due-soon-scheduled-id';
const OVERDUE_ID_KEY = 'flowos:notifications:overdue-scheduled-id';

let reminderEngineInFlight: Promise<ReminderPlan | null> | null = null;

type ReminderMap = Record<string, { notificationId: string; triggerAt: string }>;

async function ensureReminderChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(EVENT_REMINDER_CHANNEL, {
    name: 'Promemoria eventi',
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync(DUE_SOON_CHANNEL, {
    name: 'Task in scadenza',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync(OVERDUE_CHANNEL, {
    name: 'Task scadute',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function readReminderMap(): Promise<ReminderMap> {
  try {
    const raw = await AsyncStorage.getItem(EVENT_REMINDER_MAP_KEY);
    return raw ? (JSON.parse(raw) as ReminderMap) : {};
  } catch {
    return {};
  }
}

async function writeReminderMap(map: ReminderMap) {
  await AsyncStorage.setItem(EVENT_REMINDER_MAP_KEY, JSON.stringify(map));
}

/**
 * Reconciles configurable per-item reminders against the current
 * commitments: cancels every previously scheduled reminder and re-schedules
 * the current set. Simpler and safer than diffing item-by-item, and —
 * since it always starts from a clean slate — it can never leave a
 * duplicate pending for the same reminder.
 */
async function syncEventReminders(commitments: Commitment[], now: Date) {
  // Reconcile against the OS queue itself so duplicate reminders from older
  // racing runs are removed before the current desired set is scheduled.
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    if (notification.content.data?.source === 'reminder') {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier).catch((error) =>
        logNotificationEvent('cancel-event-reminder-failed', error, 'warn'),
      );
    }
  }

  const reminders = buildCustomReminders(commitments, now);
  const next: ReminderMap = {};

  for (const reminder of reminders) {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: `Tra ${formatReminderOffsetLabel(reminder.minutesBefore)}`,
        data: { source: 'reminder', commitmentId: reminder.commitmentId, reminderId: reminder.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(reminder.triggerAt),
        ...(Platform.OS === 'android' ? { channelId: EVENT_REMINDER_CHANNEL } : null),
      },
    });
    next[reminder.id] = { notificationId: identifier, triggerAt: reminder.triggerAt };
  }
  await writeReminderMap(next);
  await logNotificationEvent('event-reminders-synced', { count: reminders.length, reused: 0 });
}
/**
 * One grouped notification instead of one per task. Re-fires only when the
 * actual set of task ids changes since last time (content-hash dedup) — the
 * engine can run on every foreground/sync without re-alerting the person
 * for the exact same overdue tasks they already saw five minutes ago.
 */
async function syncGroupedNotification(
  storageKey: string,
  channel: string,
  tasks: { id: string }[],
  title: (n: number) => string,
  body: string,
  source: string,
) {
  const hash = tasks.map((task) => task.id).sort().join(',');
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const matching = scheduled.filter((notification) => notification.content.data?.source === source);

  let previousHash: string | null = null;
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (raw) previousHash = (JSON.parse(raw) as { hash?: string }).hash ?? null;
  } catch {
    previousHash = null;
  }

  if (tasks.length === 0) {
    for (const notification of matching) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier).catch((error) =>
        logNotificationEvent(`cancel-${source}-failed`, error, 'warn'),
      );
    }
    await AsyncStorage.removeItem(storageKey);
    return;
  }

  // The grouped notification is intentionally one-shot. Once the same set of
  // task IDs has already been notified, running the engine again must not
  // schedule the same alert again — even if the previous one has already fired.
  if (previousHash === hash) {
    // If an old version left multiple pending copies, keep at most one.
    for (const notification of matching.slice(1)) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier).catch((error) =>
        logNotificationEvent(`cancel-${source}-duplicate-failed`, error, 'warn'),
      );
    }
    return;
  }

  for (const notification of matching) {
    await Notifications.cancelScheduledNotificationAsync(notification.identifier).catch((error) =>
      logNotificationEvent(`cancel-${source}-failed`, error, 'warn'),
    );
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: title(tasks.length),
      body,
      data: { source },
      ...(Platform.OS === 'ios' ? { threadIdentifier: source } : null),
    },
    trigger: Platform.OS === 'android'
      ? { channelId: channel, seconds: 1, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, repeats: false }
      : null,
  });
  await AsyncStorage.setItem(storageKey, JSON.stringify({ notificationId: identifier, hash }));
  await logNotificationEvent(`${source}-scheduled`, { count: tasks.length, identifier });
}
async function syncBadge(count: number) {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    await logNotificationEvent('badge-update-failed', error, 'warn');
  }
}

/**
 * Runs the full ReminderEngine pass: recomputes the plan from the current
 * commitments and reconciles event reminders, the two grouped due/overdue
 * notifications, and the app badge against it. Safe to call repeatedly
 * (foreground, after sync, after local edits) — every step is a
 * cancel-then-reschedule, so re-running never produces duplicates.
 */
async function runReminderEngineInternal(commitments: Commitment[], now: Date = new Date()): Promise<ReminderPlan | null> {
  const allowed = await requestNotificationPermission();
  if (!allowed) {
    await logNotificationEvent(
      NOTIFICATIONS_SUPPORTED_HERE ? 'reminder-engine-permission-denied' : 'reminder-engine-skipped-web-unsupported',
      undefined,
      NOTIFICATIONS_SUPPORTED_HERE ? 'warn' : 'info',
    );
    return null;
  }
  await ensureDailySummaryChannel();
  await ensureReminderChannels();

  const plan = buildReminderPlan(commitments, now);

  await syncEventReminders(commitments, now);
  await syncGroupedNotification(
    DUE_SOON_ID_KEY,
    DUE_SOON_CHANNEL,
    plan.dueSoon,
    (n) => `${n} task in scadenza`,
    summarizeTaskList(plan.dueSoon),
    'due-soon',
  );
  await syncGroupedNotification(
    OVERDUE_ID_KEY,
    OVERDUE_CHANNEL,
    plan.overdue,
    (n) => `${n} task scadut${n === 1 ? 'a' : 'e'}`,
    summarizeTaskList(plan.overdue),
    'overdue',
  );
  await syncBadge(plan.badgeCount);
  await syncTodayWidget(commitments, now);

  await logNotificationEvent('reminder-engine-completed', {
    events: buildCustomReminders(commitments, now).length,
    dueSoon: plan.dueSoon.length,
    overdue: plan.overdue.length,
  });
  return plan;
}

export async function runReminderEngine(commitments: Commitment[], now: Date = new Date()): Promise<ReminderPlan | null> {
  if (reminderEngineInFlight) return reminderEngineInFlight;
  reminderEngineInFlight = runReminderEngineInternal(commitments, now).finally(() => {
    reminderEngineInFlight = null;
  });
  return reminderEngineInFlight;
}
