import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { buildDailySummary, toDateKey } from './dailySummary';
import { loadCommitments } from './commitmentsRepository';
import { syncGoogleWorkspace } from './googleWorkspace';
import { runReminderEngine } from './reminderEngine';
import { runIntelligentReplan } from './replanEngine';
import { fetchTodayWeather } from './weather';
import { isSupabaseConfigured, supabase } from './supabase';
import { logNotificationEvent } from './notificationLog';
import { DAILY_SUMMARY_HOUR, DAILY_SUMMARY_MINUTE, getLastRecoveryDateKey, hasRecoveredToday, isDailySummaryEnabledStored, markRecovered, scheduleDailySummaryNotification, scheduleTomorrowMorningSummary, sendImmediateSummaryNotification } from './notificationService';

export const DAILY_SUMMARY_TASK = 'flowos-daily-summary-sync';
function isPastDailySummaryTime(now: Date): boolean { return now.getHours() > DAILY_SUMMARY_HOUR || (now.getHours() === DAILY_SUMMARY_HOUR && now.getMinutes() >= DAILY_SUMMARY_MINUTE); }
async function hasAuthenticatedSession(): Promise<boolean> { if (!isSupabaseConfigured) return false; const { data } = await supabase.auth.getSession(); return Boolean(data.session); }
async function loadFreshData(now: Date) {
  const loaded = await loadCommitments();
  let commitments = loaded;
  try { const replanned = await runIntelligentReplan(loaded, undefined, now); if (replanned) commitments = replanned; }
  catch (error) { await logNotificationEvent('intelligent-replan-failed', error, 'warn'); }
  return { commitments, summary: buildDailySummary(commitments, now) };
}
async function safeRunReminderEngine(commitments: Parameters<typeof runReminderEngine>[0], now: Date) { try { return await runReminderEngine(commitments, now); } catch (error) { await logNotificationEvent('reminder-engine-failed', error, 'warn'); return null; } }

export async function runDailySummaryRefresh(now: Date = new Date()) {
  if (!(await hasAuthenticatedSession())) { await logNotificationEvent('daily-summary-refresh-skipped-no-session'); return null; }
  await logNotificationEvent('daily-summary-refresh-started');
  try { await syncGoogleWorkspace(); await logNotificationEvent('daily-summary-google-sync-ok'); }
  catch (error) { await logNotificationEvent('daily-summary-google-sync-failed', error, 'warn'); }

  const { commitments, summary } = await loadFreshData(now);
  await safeRunReminderEngine(commitments, now);
  const weather = await fetchTodayWeather();
  const enrichedSummary = weather ? { ...summary, body: `${weather.text}. ${summary.body}`.trim() } : summary;

  if (!(await isDailySummaryEnabledStored())) { await logNotificationEvent('daily-summary-refresh-skipped-disabled'); return enrichedSummary; }
  await scheduleDailySummaryNotification(enrichedSummary);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowSummary = buildDailySummary(commitments, now, tomorrow);
  await scheduleTomorrowMorningSummary(tomorrowSummary, now);
  await logNotificationEvent('daily-summary-refresh-completed', { dateKey: summary.dateKey, tomorrowDateKey: tomorrowSummary.dateKey });
  return enrichedSummary;
}

export async function refreshReminders(now: Date = new Date()) { if (!(await hasAuthenticatedSession())) return null; const { commitments } = await loadFreshData(now); return safeRunReminderEngine(commitments, now); }

export async function checkAndRecoverMissedDailySummary(now: Date = new Date()) {
  if (!(await isDailySummaryEnabledStored())) return;
  if (!isPastDailySummaryTime(now)) return;
  if (!(await hasAuthenticatedSession())) return;
  const dateKey = toDateKey(now);
  const lastRecovery = await getLastRecoveryDateKey();
  if (hasRecoveredToday(lastRecovery, dateKey)) return;
  await logNotificationEvent('daily-summary-recovery-triggered', { dateKey });
  try { await syncGoogleWorkspace(); } catch (error) { await logNotificationEvent('daily-summary-recovery-google-sync-failed', error, 'warn'); }
  const { commitments, summary } = await loadFreshData(now);
  const weather = await fetchTodayWeather();
  const enrichedSummary = weather ? { ...summary, body: `${weather.text}. ${summary.body}`.trim() } : summary;
  await sendImmediateSummaryNotification(enrichedSummary);
  await markRecovered(dateKey);
  await scheduleDailySummaryNotification(enrichedSummary);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  await scheduleTomorrowMorningSummary(buildDailySummary(commitments, now, tomorrow), now);
  await logNotificationEvent('daily-summary-recovery-completed', { dateKey });
}

TaskManager.defineTask(DAILY_SUMMARY_TASK, async () => {
  try {
    const now = new Date();
    if (now.getHours() < 5 || now.getHours() > 11) { await logNotificationEvent('background-task-skipped-outside-window', { hour: now.getHours() }); return BackgroundTask.BackgroundTaskResult.Success; }
    await runDailySummaryRefresh(now);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) { await logNotificationEvent('background-task-failed', error, 'error'); return BackgroundTask.BackgroundTaskResult.Failed; }
});

export async function registerBackgroundSync() {
  if (Platform.OS === 'web') { await logNotificationEvent('background-task-skipped-web-unsupported'); return; }
  try {
    const already = await TaskManager.isTaskRegisteredAsync(DAILY_SUMMARY_TASK);
    if (already) return;
    await BackgroundTask.registerTaskAsync(DAILY_SUMMARY_TASK, { minimumInterval: 15 });
    await logNotificationEvent('background-task-registered');
  } catch (error) { await logNotificationEvent('background-task-register-failed', error, 'error'); }
}
export async function unregisterBackgroundSync() {
  if (Platform.OS === 'web') return;
  try { const already = await TaskManager.isTaskRegisteredAsync(DAILY_SUMMARY_TASK); if (!already) return; await BackgroundTask.unregisterTaskAsync(DAILY_SUMMARY_TASK); await logNotificationEvent('background-task-unregistered'); }
  catch (error) { await logNotificationEvent('background-task-unregister-failed', error, 'warn'); }
}
