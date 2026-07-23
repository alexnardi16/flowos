import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotificationLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type NotificationLogEntry = {
  at: string;
  level: NotificationLogLevel;
  event: string;
  details?: string;
};

const STORAGE_KEY = 'flowos:notification-log:v1';
const MAX_ENTRIES = 200;
const listeners = new Set<(entries: NotificationLogEntry[]) => void>();
let cache: NotificationLogEntry[] | null = null;

function serializeDetails(details: unknown): string | undefined {
  if (details === undefined) return undefined;
  if (details instanceof Error) return `${details.name}: ${details.message}`.trim();
  if (typeof details === 'string') return details;
  try { return JSON.stringify(details); }
  catch { return String(details); }
}

async function readAll(): Promise<NotificationLogEntry[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as NotificationLogEntry[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function notify(entries: NotificationLogEntry[]) {
  listeners.forEach((listener) => listener(entries));
}

/**
 * Records one entry for the notification subsystem specifically (daily
 * summary scheduling, background sync, permission issues). Kept separate
 * from lib/diagnostics.ts on purpose: notification bugs are usually reported
 * by the person days after the fact ("non ho ricevuto il riepilogo di
 * martedì"), while diagnostics.ts is cleared on every login/logout, and only
 * persists on web. This log survives across sessions on every platform.
 */
export async function logNotificationEvent(event: string, details?: unknown, level: NotificationLogLevel = 'info') {
  const entry: NotificationLogEntry = { at: new Date().toISOString(), level, event, details: serializeDetails(details) };
  if (level === 'error') console.error(`[FlowOS:notifications] ${event}`, details ?? '');
  else if (level === 'warn') console.warn(`[FlowOS:notifications] ${event}`, details ?? '');
  else console.info(`[FlowOS:notifications] ${event}`, details ?? '');

  const previous = await readAll();
  const next = [...previous, entry].slice(-MAX_ENTRIES);
  cache = next;
  try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
  catch (error) { console.error('[FlowOS:notifications] notification-log-write-failed', error); }
  notify(next);
  return entry;
}

export async function getNotificationLog(): Promise<NotificationLogEntry[]> {
  return [...(await readAll())].reverse();
}

export function subscribeNotificationLog(listener: (entries: NotificationLogEntry[]) => void) {
  listeners.add(listener);
  void readAll().then((entries) => listener([...entries].reverse()));
  return () => { listeners.delete(listener); };
}

export async function clearNotificationLog() {
  cache = [];
  try { await AsyncStorage.removeItem(STORAGE_KEY); }
  catch (error) { console.error('[FlowOS:notifications] notification-log-clear-failed', error); }
  notify([]);
}
