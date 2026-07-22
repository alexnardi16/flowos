import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
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

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('google-workspace', { body });
  if (data?.error) throw new Error(String(data.error));
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.clone().json();
        if (payload?.error) throw new Error(String(payload.error));
      } catch (inner) {
        if (inner instanceof Error && inner.message !== 'Unexpected end of JSON input') throw inner;
      }
    }
    throw new Error(error.message || 'Google Workspace non è raggiungibile.');
  }
  return data;
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
  return invoke({ action: 'status' });
}

export async function syncGoogleWorkspace() {
  try {
    return await invoke({ action: 'sync' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/not connected|authorization expired|reconnect/i.test(message)) throw error;
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!data.session?.provider_token) {
      throw new Error('La sessione Google non contiene più il token necessario. Esci e accedi nuovamente con Google.');
    }
    await connectGoogleFromSession(data.session, true);
    return invoke({ action: 'sync' });
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
