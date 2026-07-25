import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildReminderPlan, summarizeTaskList, type ReminderPlan } from './reminderPlan';
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
 * Reconciles per-event reminders against the current plan: cancels every
 * previously scheduled reminder and re-schedules the current set. Simpler
 * and safer than diffing item-by-item, and — since it always starts from a
 * clean slate — it can never leave a duplicate pending for the same event.
 */
async function syncEventReminders(plan: ReminderPlan) {
  const previous = await readReminderMap();
  await Promise.all(
    Object.values(previous).map((entry) =>
      Notifications.cancelScheduledNotificationAsync(entry.notificationId).catch((error) =>
        logNotificationEvent('cancel-event-reminder-failed', error, 'warn'),
      ),
    ),
  );

  const next: ReminderMap = {};
  for (const reminder of plan.eventReminders) {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Tra 10 minuti: ${reminder.title}`,
        body: 'Il tuo evento sta per iniziare.',
        data: { source: 'event-reminder', commitmentId: reminder.commitmentId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(reminder.triggerAt),
        ...(Platform.OS === 'android' ? { channelId: EVENT_REMINDER_CHANNEL } : null),
      },
    });
    next[reminder.commitmentId] = { notificationId: identifier, triggerAt: reminder.triggerAt };
  }
  await writeReminderMap(next);
  await logNotificationEvent('event-reminders-synced', { count: plan.eventReminders.length });
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
  const raw = await AsyncStorage.getItem(storageKey);
  const stored = raw ? (JSON.parse(raw) as { notificationId: string; hash: string }) : null;

  if (tasks.length === 0) {
    if (stored) {
      await Notifications.cancelScheduledNotificationAsync(stored.notificationId).catch((error) =>
        logNotificationEvent(`cancel-${source}-failed`, error, 'warn'),
      );
      await AsyncStorage.removeItem(storageKey);
    }
    return;
  }

  if (stored && stored.hash === hash) {
    // Same set of tasks as last time — nothing new to tell the person.
    return;
  }
  if (stored) {
    await Notifications.cancelScheduledNotificationAsync(stored.notificationId).catch((error) =>
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
    trigger: Platform.OS === 'android' ? { channelId: channel, seconds: 1, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, repeats: false } : null,
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
export async function runReminderEngine(commitments: Commitment[], now: Date = new Date()): Promise<ReminderPlan | null> {
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

  await syncEventReminders(plan);
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
    events: plan.eventReminders.length,
    dueSoon: plan.dueSoon.length,
    overdue: plan.overdue.length,
  });
  return plan;
}
