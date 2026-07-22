import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { recordDiagnostic } from './diagnostics';
import { supabase } from './supabase';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/tasks',
].join(' ');

export type GoogleCalendar = {
  id: string;
  google_calendar_id: string;
  summary: string;
  description?: string | null;
  background_color?: string | null;
  foreground_color?: string | null;
  access_role: string;
  primary_calendar: boolean;
  selected: boolean;
  is_default: boolean;
};

export type GoogleTaskList = {
  id: string;
  google_task_list_id: string;
  title: string;
  selected: boolean;
  is_default: boolean;
};

export type GoogleWorkspaceStatus = {
  connection: null | {
    google_email?: string | null;
    last_sync_at?: string | null;
    last_sync_status: 'pending' | 'syncing' | 'ok' | 'error' | 'disconnected';
    last_sync_error?: string | null;
  };
  calendars: GoogleCalendar[];
  taskLists: GoogleTaskList[];
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/google-workspace`;
const REQUEST_TIMEOUT_MS = 90_000;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || 'Errore sconosciuto');
}

async function updateSyncFailure(message: string) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const { error } = await supabase
    .from('google_connections')
    .update({ last_sync_status: 'error', last_sync_error: message })
    .eq('user_id', data.user.id);
  if (error) recordDiagnostic('google-sync-mark-error-failed', error, 'error');
}

export async function recoverStaleGoogleSyncState() {
  const message = 'La precedente sincronizzazione è stata interrotta prima del completamento.';
  recordDiagnostic('google-sync-stale-state-recovered', { message }, 'warn');
  await updateSyncFailure(message);
}

async function invoke(body: Record<string, unknown>, retries = 1) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Sessione FlowOS scaduta. Esci e accedi nuovamente.');

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    recordDiagnostic('google-function-request-start', { action: body.action, attempt: attempt + 1 });
    try {
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_KEY,
          'Content-Type': 'application/json',
          'x-client-info': 'flowos-google-sync/1.0',
        },
        body: JSON.stringify(body),
      });
      const raw = await response.text();
      let payload: any = null;
      try { payload = raw ? JSON.parse(raw) : null; }
      catch { payload = raw ? { error: raw } : null; }

      recordDiagnostic('google-function-response', {
        action: body.action,
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok || payload?.error) {
        throw new Error(String(payload?.error || `Google Workspace ha risposto con stato ${response.status}.`));
      }
      return payload;
    } catch (error) {
      lastError = error;
      const namedError = error as { name?: string };
      const message = namedError?.name === 'AbortError'
        ? 'La sincronizzazione ha superato il tempo massimo consentito.'
        : errorMessage(error);
      recordDiagnostic('google-function-request-failed', { action: body.action, attempt: attempt + 1, message }, 'error');
      if (attempt >= retries || !/failed to fetch|network|send a request|timeout|tempo massimo|abort/i.test(message)) break;
      await new Promise((resolve) => setTimeout(resolve, 1200));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(errorMessage(lastError));
}

export async function signInWithGoogle() {
  const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.origin}/today`
    : 'flowos://today';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      scopes: GOOGLE_SCOPES,
      queryParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
    },
  });
  if (error) throw error;
  return data;
}

export async function connectGoogleFromSession(session: Session, force = false) {
  if (!session.provider_token) return null;
  const marker = `flowos-google-connected-${session.user.id}-${session.provider_token.slice(-12)}`;
  if (!force && Platform.OS === 'web' && typeof sessionStorage !== 'undefined' && sessionStorage.getItem(marker)) return null;
  const result = await invoke({
    action: 'connect',
    providerToken: session.provider_token,
    providerRefreshToken: session.provider_refresh_token,
    scopes: GOOGLE_SCOPES,
    expiresIn: 3600,
  });
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') sessionStorage.setItem(marker, '1');
  return result;
}

export async function getGoogleWorkspaceStatus(): Promise<GoogleWorkspaceStatus> {
  return invoke({ action: 'status' }, 0);
}

export async function syncGoogleWorkspace() {
  recordDiagnostic('google-sync-started');
  try {
    try {
      const result = await invoke({ action: 'sync' });
      recordDiagnostic('google-sync-succeeded', result);
      return result;
    } catch (error) {
      const message = errorMessage(error);
      if (!/not connected|authorization expired|reconnect/i.test(message)) throw error;
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session?.provider_token) {
        throw new Error('La sessione Google non contiene più il token necessario. Esci e accedi nuovamente con Google.');
      }
      recordDiagnostic('google-sync-reconnecting');
      await connectGoogleFromSession(data.session, true);
      return await invoke({ action: 'sync' });
    }
  } catch (error) {
    const namedError = error as { name?: string };
    const message = namedError?.name === 'AbortError'
      ? 'La sincronizzazione ha superato il tempo massimo consentito.'
      : errorMessage(error);
    recordDiagnostic('google-sync-mark-error', { message }, 'error');
    await updateSyncFailure(message);
    recordDiagnostic('google-sync-failed', { message }, 'error');
    throw new Error(message);
  }
}

export async function disconnectGoogleWorkspace() {
  return invoke({ action: 'disconnect' });
}

export async function setDefaultCalendar(id: string) {
  const { error } = await supabase.rpc('set_default_google_calendar', { p_calendar_id: id });
  if (error) throw error;
}

export async function setDefaultTaskList(id: string) {
  const { error } = await supabase.rpc('set_default_google_task_list', { p_task_list_id: id });
  if (error) throw error;
}

export async function setCalendarSelected(id: string, selected: boolean) {
  const { error } = await supabase.from('google_calendars').update({ selected }).eq('id', id);
  if (error) throw error;
}

export async function setTaskListSelected(id: string, selected: boolean) {
  const { error } = await supabase.from('google_task_lists').update({ selected }).eq('id', id);
  if (error) throw error;
}
