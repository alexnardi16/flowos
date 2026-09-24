import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { buildDailySummary, toDateKey } from './dailySummary';
import { loadCommitments, pushPendingToGoogle, saveCommitment } from './commitmentsRepository';
import { syncGoogleTasksIncremental, syncGoogleWorkspace } from './googleWorkspace';
import { syncTodayWidget } from './widgetSync';
import { runReminderEngine } from './reminderEngine';
import { runIntelligentReplan } from './replanEngine';
import { autoCompleteExpiredEvents } from './autoCompleteEvents';
import { isSupabaseConfigured, supabase } from './supabase';
import { logNotificationEvent } from './notificationLog';
import { rolloverIncompleteTasks } from './taskRollover';
import { getDailySummaryTime, getLastRecoveryDateKey, hasRecoveredToday, reconcilePresentedDailySummary, isDailySummaryEnabledStored, markRecovered, scheduleDailySummaryNotification, scheduleTomorrowMorningSummary, sendImmediateSummaryNotification } from './notificationService';

export const DAILY_SUMMARY_TASK = 'flowos-daily-summary-sync';
export const GOOGLE_TASKS_BACKGROUND_TASK = 'flowos-google-tasks-sync';
export const TASK_ROLLOVER_BACKGROUND_TASK = 'flowos-task-rollover';
async function isPastDailySummaryTime(now: Date): Promise<boolean> {
  const { hour, minute } = await getDailySummaryTime();
  return now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= minute);
}
async function hasAuthenticatedSession(): Promise<boolean> { if (!isSupabaseConfigured) return false; const { data } = await supabase.auth.getSession(); return Boolean(data.session); }
async function loadFreshData(now: Date) {
  const loaded = await loadCommitments();
  const completed = await autoCompleteExpiredEvents(loaded, now);
  let commitments = completed.commitments;
  try { const replanned = await runIntelligentReplan(loaded, undefined, now); if (replanned) commitments = replanned; }
  catch (error) { await logNotificationEvent('intelligent-replan-failed', error, 'warn'); }
  return { commitments, summary: buildDailySummary(commitments, now) };
}
async function safeRunReminderEngine(commitments: Parameters<typeof runReminderEngine>[0], now: Date) { try { return await runReminderEngine(commitments, now); } catch (error) { await logNotificationEvent('reminder-engine-failed', error, 'warn'); return null; } }

let dailySummaryRefreshInFlight: Promise<ReturnType<typeof buildDailySummary> | null> | null = null;

async function runDailySummaryRefreshInternal(now: Date): Promise<ReturnType<typeof buildDailySummary> | null> {
  if (!(await hasAuthenticatedSession())) {
    await logNotificationEvent('daily-summary-refresh-skipped-no-session');
    return null;
  }

  await logNotificationEvent('daily-summary-refresh-started');
  try {
    await syncGoogleWorkspace();
    await logNotificationEvent('daily-summary-google-sync-ok');
  } catch (error) {
    await logNotificationEvent('daily-summary-google-sync-failed', error, 'warn');
  }

  const { commitments, summary } = await loadFreshData(now);
  try {
    await syncTodayWidget(commitments, now);
  } catch (error) {
    await logNotificationEvent('background-widget-refresh-failed', error, 'warn');
  }
  await safeRunReminderEngine(commitments, now);

  if (!(await isDailySummaryEnabledStored())) {
    await logNotificationEvent('daily-summary-refresh-skipped-disabled');
    return summary;
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowSummary = buildDailySummary(commitments, now, tomorrow);
  const afterConfiguredTime = await isPastDailySummaryTime(now);

  // A DAILY trigger fires at the next occurrence. If today's configured time
  // has already passed, its content must describe tomorrow, not today's data.
  await scheduleDailySummaryNotification(afterConfiguredTime ? tomorrowSummary : summary);
  await scheduleTomorrowMorningSummary(tomorrowSummary, now);
  await logNotificationEvent('daily-summary-refresh-completed', {
    dateKey: summary.dateKey,
    tomorrowDateKey: tomorrowSummary.dateKey,
    scheduledSummaryDateKey: afterConfiguredTime ? tomorrowSummary.dateKey : summary.dateKey,
  });
  return summary;
}

export async function runDailySummaryRefresh(now: Date = new Date()) {
  if (dailySummaryRefreshInFlight) return dailySummaryRefreshInFlight;
  dailySummaryRefreshInFlight = runDailySummaryRefreshInternal(now).finally(() => {
    dailySummaryRefreshInFlight = null;
  });
  return dailySummaryRefreshInFlight;
}

export async function refreshReminders(now: Date = new Date()) { if (!(await hasAuthenticatedSession())) return null; const { commitments } = await loadFreshData(now); return safeRunReminderEngine(commitments, now); }

let dailySummaryRecoveryInFlight: Promise<void> | null = null;

async function checkAndRecoverMissedDailySummaryInternal(now: Date): Promise<void> {
  if (!(await isDailySummaryEnabledStored())) return;
  if (!(await isPastDailySummaryTime(now))) return;
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

  const { commitments, summary } = await loadFreshData(now);
  try {
    await syncTodayWidget(commitments, now);
  } catch (error) {
    await logNotificationEvent('recovery-widget-refresh-failed', error, 'warn');
  }

  // Compare any already-presented summary with the freshly synchronized
  // FlowOS state. Keep one only when it is exactly current; otherwise remove
  // stale/duplicate summaries and send one corrected notification.
  if (await reconcilePresentedDailySummary(summary)) {
    await markRecovered(dateKey);
    await logNotificationEvent('daily-summary-recovery-skipped-already-current', { dateKey });
    return;
  }

  await sendImmediateSummaryNotification(summary);
  await markRecovered(dateKey);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  await scheduleDailySummaryNotification(buildDailySummary(commitments, now, tomorrow));
  await scheduleTomorrowMorningSummary(buildDailySummary(commitments, now, tomorrow), now);
  await logNotificationEvent('daily-summary-recovery-completed', { dateKey });
}

export async function checkAndRecoverMissedDailySummary(now: Date = new Date()) {
  if (dailySummaryRecoveryInFlight) return dailySummaryRecoveryInFlight;
  dailySummaryRecoveryInFlight = checkAndRecoverMissedDailySummaryInternal(now).finally(() => {
    dailySummaryRecoveryInFlight = null;
  });
  return dailySummaryRecoveryInFlight;
}

TaskManager.defineTask(TASK_ROLLOVER_BACKGROUND_TASK, async () => {
  try {
    if (!(await hasAuthenticatedSession())) return BackgroundTask.BackgroundTaskResult.Success;
    const commitments = await loadCommitments();
    const result = rolloverIncompleteTasks(commitments, new Date());
    if (!result.changed.length) return BackgroundTask.BackgroundTaskResult.Success;
    for (const item of result.changed) await saveCommitment(item);
    try { await pushPendingToGoogle(); } catch (error) { await logNotificationEvent('task-rollover-google-push-failed', error, 'warn'); }
    await syncTodayWidget(result.commitments, new Date());
    await logNotificationEvent('task-rollover-background-completed', { count: result.changed.length });
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    await logNotificationEvent('task-rollover-background-failed', error, 'warn');
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

TaskManager.defineTask(GOOGLE_TASKS_BACKGROUND_TASK, async () => {
  try {
    if (!(await hasAuthenticatedSession())) return BackgroundTask.BackgroundTaskResult.Success;
    await syncGoogleTasksIncremental();
    const commitments = await loadCommitments();
    await syncTodayWidget(commitments, new Date());
    await logNotificationEvent('google-tasks-background-sync-completed');
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    await logNotificationEvent('google-tasks-background-sync-failed', error, 'warn');
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

TaskManager.defineTask(DAILY_SUMMARY_TASK, async () => {
  try {
    const now = new Date();
    // The OS decides when the background task actually runs. Keep the existing
    // broad morning window to avoid turning a 15-minute background task into a
    // continuous Google sync. The actual notification time is scheduled by the
    // local calendar trigger using the user's configured wall-clock time.
    if (now.getHours() < 5 || now.getHours() > 11) { await logNotificationEvent('background-task-skipped-outside-window', { hour: now.getHours() }); return BackgroundTask.BackgroundTaskResult.Success; }
    await runDailySummaryRefresh(now);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) { await logNotificationEvent('background-task-failed', error, 'error'); return BackgroundTask.BackgroundTaskResult.Failed; }
});

export async function registerBackgroundSync() {
  if (Platform.OS === 'web') { await logNotificationEvent('background-task-skipped-web-unsupported'); return; }
  try {
    if (!(await TaskManager.isTaskRegisteredAsync(DAILY_SUMMARY_TASK))) {
      await BackgroundTask.registerTaskAsync(DAILY_SUMMARY_TASK, { minimumInterval: 15 });
    }
    if (!(await TaskManager.isTaskRegisteredAsync(GOOGLE_TASKS_BACKGROUND_TASK))) {
      await BackgroundTask.registerTaskAsync(GOOGLE_TASKS_BACKGROUND_TASK, { minimumInterval: 15 });
    }
    if (!(await TaskManager.isTaskRegisteredAsync(TASK_ROLLOVER_BACKGROUND_TASK))) {
      await BackgroundTask.registerTaskAsync(TASK_ROLLOVER_BACKGROUND_TASK, { minimumInterval: 15 });
    }
    await logNotificationEvent('background-task-registered');
  } catch (error) { await logNotificationEvent('background-task-register-failed', error, 'error'); }
}
export async function unregisterBackgroundSync() {
  if (Platform.OS === 'web') return;
  try { const already = await TaskManager.isTaskRegisteredAsync(DAILY_SUMMARY_TASK); if (already) await BackgroundTask.unregisterTaskAsync(DAILY_SUMMARY_TASK); const tasksAlready = await TaskManager.isTaskRegisteredAsync(GOOGLE_TASKS_BACKGROUND_TASK); if (tasksAlready) await BackgroundTask.unregisterTaskAsync(GOOGLE_TASKS_BACKGROUND_TASK); await logNotificationEvent('background-task-unregistered'); }
  catch (error) { await logNotificationEvent('background-task-unregister-failed', error, 'warn'); }
}
