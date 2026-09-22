import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildReminderPlan, summarizeTaskList, type ReminderPlan } from './reminderPlan';
import { buildCustomReminders, dedupeScheduledReminders, formatReminderOffsetLabel } from './customReminders';
import { ensureDailySummaryChannel, NOTIFICATIONS_SUPPORTED_HERE, requestNotificationPermission } from './notificationService';
import { syncTodayWidget } from './widgetSync';
import { logNotificationEvent } from './notificationLog';
import type { Commitment } from '../types';

export const EVENT_REMINDER_CHANNEL = 'flowos-event-reminders';
export const REMINDER_ACTION_CATEGORY = 'flowos_reminder_actions';
export const REMINDER_ACTION_POSTPONE = 'reminder_postpone';
export const REMINDER_ACTION_COMPLETE = 'reminder_complete';
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

export async function ensureReminderNotificationCategory() {
  await Notifications.setNotificationCategoryAsync(REMINDER_ACTION_CATEGORY, [
    {
      identifier: REMINDER_ACTION_POSTPONE,
      buttonTitle: 'Rimanda',
      options: { opensAppToForeground: true },
    },
    {
      identifier: REMINDER_ACTION_COMPLETE,
      buttonTitle: 'Completa',
      options: { isDestructive: false, opensAppToForeground: false },
    },
  ]);
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
/**
 * Reconciles event reminders idempotently against the OS queue.
 *
 * The old implementation cancelled every reminder and then recreated every
 * reminder. That is vulnerable to concurrent foreground/background passes:
 * two passes can both observe an empty queue and both schedule the same event.
 *
 * This implementation instead:
 * 1. derives one desired reminder per logical reminder key;
 * 2. keeps an existing notification when it already represents that key/time;
 * 3. cancels stale and duplicate OS entries;
 * 4. schedules only missing reminders;
 * 5. performs a final OS-level reconciliation, so concurrent passes converge
 *    to one notification per logical reminder.
 */
async function syncEventReminders(commitments: Commitment[], now: Date) {
  const reminders = dedupeScheduledReminders(buildCustomReminders(commitments, now));
  const desiredByKey = new Map(reminders.map((reminder) => [reminder.id, reminder]));
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const kept = new Set<string>();

  const getReminderKey = (notification: Notifications.NotificationRequest) => {
    const data = notification.content.data as Record<string, unknown> | null | undefined;
    if (data?.source !== 'reminder') return null;
    const commitmentId = typeof data.commitmentId === 'string' ? data.commitmentId : null;
    const reminderId = typeof data.reminderId === 'string' ? data.reminderId : null;
    if (!commitmentId || !reminderId) return null;
    return reminderId.startsWith(`${commitmentId}:`) ? reminderId : `${commitmentId}:${reminderId}`;
  };

  const getTriggerAt = (notification: Notifications.NotificationRequest): number | null => {
    const trigger = notification.trigger as { date?: Date | string | number } | null;
    if (!trigger || trigger.date === undefined) return null;
    const time = new Date(trigger.date).getTime();
    return Number.isFinite(time) ? time : null;
  };

  for (const notification of scheduled) {
    const key = getReminderKey(notification);
    if (!key) {
      if (notification.content.data?.source === 'reminder') {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier).catch((error) =>
          logNotificationEvent('cancel-event-reminder-invalid-failed', error, 'warn'),
        );
      }
      continue;
    }

    const desired = desiredByKey.get(key);
    if (!desired) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier).catch((error) =>
        logNotificationEvent('cancel-event-reminder-stale-failed', error, 'warn'),
      );
      continue;
    }

    const desiredTime = new Date(desired.triggerAt).getTime();
    const actualTime = getTriggerAt(notification);
    const sameTrigger = actualTime !== null && Math.abs(actualTime - desiredTime) < 1000;

    if (kept.has(key) || !sameTrigger) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier).catch((error) =>
        logNotificationEvent('cancel-event-reminder-duplicate-failed', error, 'warn'),
      );
      continue;
    }

    kept.add(key);
  }

  for (const reminder of reminders) {
    if (kept.has(reminder.id)) continue;

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: `Tra ${formatReminderOffsetLabel(reminder.minutesBefore)}`,
        data: {
          source: 'reminder',
          commitmentId: reminder.commitmentId,
          reminderKey: reminder.id,
          reminderId: reminder.id.split(':').slice(1).join(':'),
        },
        categoryIdentifier: REMINDER_ACTION_CATEGORY,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(reminder.triggerAt),
        ...(Platform.OS === 'android' ? { channelId: EVENT_REMINDER_CHANNEL } : null),
      },
    });
    kept.add(reminder.id);
  }

  // Final reconciliation closes the race window between two independent
  // foreground/background executions. Whichever pass runs last leaves exactly
  // one notification for every desired logical reminder.
  const finalScheduled = await Notifications.getAllScheduledNotificationsAsync();
  const finalKept = new Set<string>();
  const next: ReminderMap = {};

  for (const notification of finalScheduled) {
    const key = getReminderKey(notification);
    if (!key) continue;

    const desired = desiredByKey.get(key);
    if (!desired) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier).catch((error) =>
        logNotificationEvent('cancel-event-reminder-final-stale-failed', error, 'warn'),
      );
      continue;
    }

    if (finalKept.has(key)) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier).catch((error) =>
        logNotificationEvent('cancel-event-reminder-final-duplicate-failed', error, 'warn'),
      );
      continue;
    }

    finalKept.add(key);
    next[key] = {
      notificationId: notification.identifier,
      triggerAt: desired.triggerAt,
    };
  }

  await writeReminderMap(next);
  await logNotificationEvent('event-reminders-synced', {
    count: reminders.length,
    scheduled: finalKept.size,
    removed: Math.max(0, finalScheduled.filter((notification) => getReminderKey(notification)).length - finalKept.size),
  });
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
  await ensureReminderNotificationCategory();

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
