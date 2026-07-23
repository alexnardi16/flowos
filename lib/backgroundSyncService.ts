import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { buildDailySummary, toDateKey } from './dailySummary';
import { loadCommitments } from './commitmentsRepository';
import { syncGoogleWorkspace } from './googleWorkspace';
import { runReminderEngine } from './reminderEngine';
import { isSupabaseConfigured, supabase } from './supabase';
import { logNotificationEvent } from './notificationLog';
import {
  DAILY_SUMMARY_HOUR,
  DAILY_SUMMARY_MINUTE,
  getLastRecoveryDateKey,
  hasRecoveredToday,
  isDailySummaryEnabledStored,
  markRecovered,
  scheduleDailySummaryNotification,
  sendImmediateSummaryNotification,
} from './notificationService';

export const DAILY_SUMMARY_TASK = 'flowos-daily-summary-sync';

function isPastDailySummaryTime(now: Date): boolean {
  return now.getHours() > DAILY_SUMMARY_HOUR || (now.getHours() === DAILY_SUMMARY_HOUR && now.getMinutes() >= DAILY_SUMMARY_MINUTE);
}

async function hasAuthenticatedSession(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

async function loadFreshData(now: Date) {
  const commitments = await loadCommitments();
  return { commitments, summary: buildDailySummary(commitments, now) };
}

/**
 * GoogleSyncService (lib/googleWorkspace.ts) + PlanningEngine's data source
 * (lib/commitmentsRepository.ts) + DailySummaryGenerator (lib/dailySummary.ts)
 * + ReminderEngine (lib/reminderEngine.ts), chained together and handed to
 * NotificationService. Shared by the OS background task and by the in-app
 * recovery check below, so both paths stay in sync.
 */
export async function runDailySummaryRefresh(now: Date = new Date()) {
  if (!(await hasAuthenticatedSession())) {
    await logNotificationEvent('daily-summary-refresh-skipped-no-session');
    return null;
  }

  await logNotificationEvent('daily-summary-refresh-started');
  try {
    await syncGoogleWorkspace();
    await logNotificationEvent('daily-summary-google-sync-ok');
  } catch (error) {
    // A stale local summary is still more useful than none — never let a
    // sync failure block the notification.
    await logNotificationEvent('daily-summary-google-sync-failed', error, 'warn');
  }

  const { commitments, summary } = await loadFreshData(now);
  await runReminderEngine(commitments, now);

  if (!(await isDailySummaryEnabledStored())) {
    await logNotificationEvent('daily-summary-refresh-skipped-disabled');
    return summary;
  }
  await scheduleDailySummaryNotification(summary);
  await logNotificationEvent('daily-summary-refresh-completed', { dateKey: summary.dateKey });
  return summary;
}

/**
 * Cheap, local-only refresh of event/due-task reminders (no Google sync),
 * meant to be called often — every foreground, not just once a day. Kept
 * independent of the daily-summary enabled flag: turning off the 07:30
 * riepilogo should not silently turn off event and due-task reminders too.
 */
export async function refreshReminders(now: Date = new Date()) {
  if (!(await hasAuthenticatedSession())) return null;
  const commitments = await loadCommitments();
  return runReminderEngine(commitments, now);
}

/**
 * Called on app foreground/launch. Covers the "device was off or offline at
 * 07:30" case: the recurring OS trigger only fires once and will not repeat
 * until tomorrow, so if we detect we're past 07:30 today and nothing has
 * been recovered yet, we generate and push the summary immediately here —
 * this path does not depend on background OS scheduling at all, which makes
 * it the most reliable part of the whole feature.
 */
export async function checkAndRecoverMissedDailySummary(now: Date = new Date()) {
  if (!(await isDailySummaryEnabledStored())) return;
  if (!isPastDailySummaryTime(now)) return;
  if (!(await hasAuthenticatedSession())) return;

  const dateKey = toDateKey(now);
  const lastRecovery = await getLastRecoveryDateKey();
  if (hasRecoveredToday(lastRecovery, dateKey)) return;

  await logNotificationEvent('daily-summary-recovery-triggered', { dateKey });
  try {
    await syncGoogleWorkspace();
  } catch (error) {
    await logNotificationEvent('daily-summary-recovery-google-sync-failed', error, 'warn');
  }

  const { summary } = await loadFreshData(now);
  await sendImmediateSummaryNotification(summary);
  await markRecovered(dateKey);
  // Keep tomorrow's recurring notification fresh too, otherwise it would
  // still be carrying whatever content was scheduled before the recovery.
  await scheduleDailySummaryNotification(summary);
  await logNotificationEvent('daily-summary-recovery-completed', { dateKey });
}

TaskManager.defineTask(DAILY_SUMMARY_TASK, async () => {
  try {
    const now = new Date();
    // The OS decides when to actually run a deferred background task and
    // may pick any hour of the day. We only want it doing real work in the
    // morning window; outside of it we report success without doing
    // anything so the OS keeps granting us future opportunities instead of
    // penalizing the task for looking unreliable.
    if (now.getHours() < 5 || now.getHours() > 11) {
      await logNotificationEvent('background-task-skipped-outside-window', { hour: now.getHours() });
      return BackgroundTask.BackgroundTaskResult.Success;
    }
    await runDailySummaryRefresh(now);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    await logNotificationEvent('background-task-failed', error, 'error');
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSync() {
  try {
    const already = await TaskManager.isTaskRegisteredAsync(DAILY_SUMMARY_TASK);
    if (already) return;
    // minimumInterval is in minutes and is only a lower bound: Android
    // WorkManager and iOS BGTaskScheduler both decide the actual run time
    // based on battery, network and usage patterns. 15 is the smallest unit
    // the API accepts; it does not mean the task runs every 15 minutes.
    await BackgroundTask.registerTaskAsync(DAILY_SUMMARY_TASK, { minimumInterval: 15 });
    await logNotificationEvent('background-task-registered');
  } catch (error) {
    await logNotificationEvent('background-task-register-failed', error, 'error');
  }
}

export async function unregisterBackgroundSync() {
  try {
    const already = await TaskManager.isTaskRegisteredAsync(DAILY_SUMMARY_TASK);
    if (!already) return;
    await BackgroundTask.unregisterTaskAsync(DAILY_SUMMARY_TASK);
    await logNotificationEvent('background-task-unregistered');
  } catch (error) {
    await logNotificationEvent('background-task-unregister-failed', error, 'warn');
  }
}
