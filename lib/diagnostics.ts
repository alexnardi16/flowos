import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { redactLogDetails, redactSerializedLogDetails } from './logRedaction';

export type DiagnosticLevel = 'debug' | 'info' | 'warn' | 'error';

export type DiagnosticEntry = {
  at: string;
  level: DiagnosticLevel;
  event: string;
  details?: string;
};

const STORAGE_KEY = 'flowos-diagnostics-v3';
const SESSION_USER_KEY = 'flowos-diagnostics-session-user';
const MAX_ENTRIES = 300;
const listeners = new Set<(entries: DiagnosticEntry[]) => void>();
let cache: DiagnosticEntry[] = [];
let sessionUser: string | null = null;
let storageGeneration = 0;

function sanitizeEntry(value: DiagnosticEntry): DiagnosticEntry {
  return {
    ...value,
    event: String(redactLogDetails(value.event)),
    details: redactSerializedLogDetails(value.details),
  };
}

const storageReady = AsyncStorage.multiGet([STORAGE_KEY, SESSION_USER_KEY])
  .then(([logEntry, userEntry]) => {
    if (storageGeneration !== 0) return;
    let parsed: DiagnosticEntry[] = [];
    try { parsed = logEntry[1] ? JSON.parse(logEntry[1]) as DiagnosticEntry[] : []; }
    catch { parsed = []; }
    cache = Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry === 'object').map(sanitizeEntry).slice(-MAX_ENTRIES) : [];
    sessionUser = userEntry[1] ?? null;
    if (logEntry[1] && JSON.stringify(cache) !== logEntry[1]) {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
        .catch((error) => console.error('[FlowOS] diagnostics-migration-failed', error));
    }
    notify();
  })
  .catch((error) => console.error('[FlowOS] diagnostics-storage-load-failed', error));

function serializeDetails(details: unknown): string | undefined {
  return redactSerializedLogDetails(details);
}

function notify() {
  const entries = readDiagnostics();
  listeners.forEach((listener) => listener(entries));
}

function persist() {
  void storageReady.then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache)))
    .catch((error) => console.error('[FlowOS] diagnostics-storage-failed', error));
}

export function recordDiagnostic(event: string, details?: unknown, level: DiagnosticLevel = 'info') {
  const safeDetails = redactLogDetails(details);
  const safeEvent = String(redactLogDetails(event));
  const entry: DiagnosticEntry = {
    at: new Date().toISOString(),
    level,
    event: safeEvent,
    details: serializeDetails(safeDetails),
  };

  if (level === 'error') console.error(`[FlowOS] ${safeEvent}`, safeDetails ?? '');
  else if (level === 'warn') console.warn(`[FlowOS] ${safeEvent}`, safeDetails ?? '');
  else if (level === 'debug') console.debug(`[FlowOS] ${safeEvent}`, safeDetails ?? '');
  else console.info(`[FlowOS] ${safeEvent}`, safeDetails ?? '');

  cache = [...cache, entry].slice(-MAX_ENTRIES);
  persist();
  notify();
}

export function readDiagnostics(): DiagnosticEntry[] {
  return [...cache];
}

export function subscribeDiagnostics(listener: (entries: DiagnosticEntry[]) => void) {
  listeners.add(listener);
  listener(readDiagnostics());
  return () => { listeners.delete(listener); };
}

export function clearDiagnostics() {
  storageGeneration += 1;
  cache = [];
  void storageReady.then(() => AsyncStorage.removeItem(STORAGE_KEY))
    .catch((error) => console.error('[FlowOS] diagnostics-clear-failed', error));
  notify();
}

export function beginDiagnosticSession(userId: string) {
  if (sessionUser === userId) return;
  storageGeneration += 1;
  cache = [];
  sessionUser = userId;
  void storageReady.then(() => AsyncStorage.multiSet([[STORAGE_KEY, '[]'], [SESSION_USER_KEY, userId]]))
    .catch((error) => console.error('[FlowOS] diagnostics-session-start-failed', error));
  notify();
}

export function endDiagnosticSession() {
  storageGeneration += 1;
  cache = [];
  sessionUser = null;
  void storageReady.then(() => AsyncStorage.multiRemove([STORAGE_KEY, SESSION_USER_KEY]))
    .catch((error) => console.error('[FlowOS] diagnostics-session-end-failed', error));
  notify();
}

export function formatDiagnostics(): string {
  const version = Application.nativeApplicationVersion ?? 'unknown';
  const build = Application.nativeBuildVersion ?? 'unknown';
  const header = `FlowOS ${version} · versionCode ${build}`;
  const lines = readDiagnostics()
    .map((entry) => `${entry.at} [${entry.level}] ${entry.event}${entry.details ? ` — ${entry.details}` : ''}`);
  return [header, ...lines].join('\n');
}
