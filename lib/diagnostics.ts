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

  if (typeof window === 'undefined') return;
  try {
    const previous = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as DiagnosticEntry[];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...previous, entry]));
    notify();
  } catch (error) {
    console.error('[FlowOS] diagnostics-storage-failed', error);
  }
}

export function readDiagnostics(): DiagnosticEntry[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as DiagnosticEntry[]; }
  catch { return []; }
}

export function subscribeDiagnostics(listener: (entries: DiagnosticEntry[]) => void) {
  listeners.add(listener);
  listener(readDiagnostics());
  return () => { listeners.delete(listener); };
}

export function clearDiagnostics() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    notify();
  } catch (error) {
    console.error('[FlowOS] diagnostics-clear-failed', error);
  }
}

export function beginDiagnosticSession(userId: string) {
  if (typeof window === 'undefined') return;
  try {
    const currentUser = window.localStorage.getItem(SESSION_USER_KEY);
    if (currentUser !== userId) {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.setItem(SESSION_USER_KEY, userId);
      notify();
    }
  } catch (error) {
    console.error('[FlowOS] diagnostics-session-start-failed', error);
  }
}

export function endDiagnosticSession() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(SESSION_USER_KEY);
    notify();
  } catch (error) {
    console.error('[FlowOS] diagnostics-session-end-failed', error);
  }
}

export function formatDiagnostics(): string {
  return readDiagnostics()
    .map((entry) => `${entry.at} [${entry.level}] ${entry.event}${entry.details ? ` — ${entry.details}` : ''}`)
    .join('\n');
}
