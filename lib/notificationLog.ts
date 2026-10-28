import AsyncStorage from '@react-native-async-storage/async-storage';
import { redactLogDetails, redactSerializedLogDetails } from './logRedaction';

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

function sanitizeEntry(value: NotificationLogEntry): NotificationLogEntry {
  return {
    ...value,
    event: String(redactLogDetails(value.event)),
    details: redactSerializedLogDetails(value.details),
  };
}

function serializeDetails(details: unknown): string | undefined {
  return redactSerializedLogDetails(details);
}

async function readAll(): Promise<NotificationLogEntry[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as NotificationLogEntry[] : [];
    cache = Array.isArray(parsed)
      ? parsed.filter((entry) => entry && typeof entry === 'object').map(sanitizeEntry).slice(-MAX_ENTRIES)
      : [];
    if (raw && JSON.stringify(cache) !== raw) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    }
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
 * by the person days after the fact, while diagnostics.ts is cleared on login/logout.
 */
export async function logNotificationEvent(event: string, details?: unknown, level: NotificationLogLevel = 'info') {
  const safeDetails = redactLogDetails(details);
  const safeEvent = String(redactLogDetails(event));
  const entry: NotificationLogEntry = { at: new Date().toISOString(), level, event: safeEvent, details: serializeDetails(safeDetails) };
  if (level === 'error') console.error(`[FlowOS:notifications] ${safeEvent}`, safeDetails ?? '');
  else if (level === 'warn') console.warn(`[FlowOS:notifications] ${safeEvent}`, safeDetails ?? '');
  else console.info(`[FlowOS:notifications] ${safeEvent}`, safeDetails ?? '');

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
