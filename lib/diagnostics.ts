import AsyncStorage from '@react-native-async-storage/async-storage';

export type DiagnosticLevel = 'debug' | 'info' | 'warn' | 'error';

export type DiagnosticEntry = {
  at: string;
  level: DiagnosticLevel;
  event: string;
  details?: string;
};

const STORAGE_KEY = 'flowos-diagnostics-v3';
const SESSION_USER_KEY = 'flowos-diagnostics-session-user';
const listeners = new Set<(entries: DiagnosticEntry[]) => void>();
let cache: DiagnosticEntry[] = [];
let sessionUser: string | null = null;
let storageGeneration = 0;

const storageReady = AsyncStorage.multiGet([STORAGE_KEY, SESSION_USER_KEY])
  .then(([logEntry, userEntry]) => {
    if (storageGeneration !== 0) return;
    try { cache = logEntry[1] ? JSON.parse(logEntry[1]) as DiagnosticEntry[] : []; }
    catch { cache = []; }
    sessionUser = userEntry[1] ?? null;
    notify();
  })
  .catch((error) => console.error('[FlowOS] diagnostics-storage-load-failed', error));

function serializeDetails(details: unknown): string | undefined {
  if (details === undefined) return undefined;
  if (details instanceof Error) return `${details.name}: ${details.message}\n${details.stack ?? ''}`.trim();
  if (typeof details === 'string') return details;
  try { return JSON.stringify(details); }
  catch { return String(details); }
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
  const entry: DiagnosticEntry = {
    at: new Date().toISOString(),
    level,
    event,
    details: serializeDetails(details),
  };

  if (level === 'error') console.error(`[FlowOS] ${event}`, details ?? '');
  else if (level === 'warn') console.warn(`[FlowOS] ${event}`, details ?? '');
  else if (level === 'debug') console.debug(`[FlowOS] ${event}`, details ?? '');
  else console.info(`[FlowOS] ${event}`, details ?? '');

  cache = [...cache, entry];
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
  return readDiagnostics()
    .map((entry) => `${entry.at} [${entry.level}] ${entry.event}${entry.details ? ` — ${entry.details}` : ''}`)
    .join('\n');
}
