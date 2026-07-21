type DiagnosticLevel = 'info' | 'error';

type DiagnosticEntry = {
  at: string;
  level: DiagnosticLevel;
  event: string;
  details?: string;
};

const STORAGE_KEY = 'flowos-diagnostics-v1';
const MAX_ENTRIES = 50;

function serializeDetails(details: unknown): string | undefined {
  if (details === undefined) return undefined;
  if (details instanceof Error) return `${details.name}: ${details.message}\n${details.stack ?? ''}`.trim();
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

export function recordDiagnostic(event: string, details?: unknown, level: DiagnosticLevel = 'info') {
  const entry: DiagnosticEntry = {
    at: new Date().toISOString(),
    level,
    event,
    details: serializeDetails(details),
  };

  if (level === 'error') console.error(`[FlowOS] ${event}`, details ?? '');
  else console.info(`[FlowOS] ${event}`, details ?? '');

  if (typeof window === 'undefined') return;
  try {
    const previous = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as DiagnosticEntry[];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...previous, entry].slice(-MAX_ENTRIES)));
  } catch (error) {
    console.error('[FlowOS] diagnostics-storage-failed', error);
  }
}

export function readDiagnostics(): DiagnosticEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as DiagnosticEntry[];
  } catch {
    return [];
  }
}

export function formatDiagnostics(): string {
  return readDiagnostics()
    .map((entry) => `${entry.at} [${entry.level}] ${entry.event}${entry.details ? ` — ${entry.details}` : ''}`)
    .join('\n');
}
