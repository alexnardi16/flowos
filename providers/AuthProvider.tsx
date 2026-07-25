import type { Session } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { beginDiagnosticSession, clearDiagnostics, endDiagnosticSession, recordDiagnostic } from '../lib/diagnostics';
import { connectGoogleFromSession, syncGoogleWorkspace } from '../lib/googleWorkspace';
import { checkAndRecoverMissedDailySummary, refreshReminders, registerBackgroundSync } from '../lib/backgroundSyncService';
import { clearNotificationLog } from '../lib/notificationLog';
import { useFlowStore } from '../lib/store';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  setAuthenticatedSession: (session: Session) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const SESSION_INIT_TIMEOUT_MS = 5000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const hydrateFromCloud = useFlowStore((state) => state.hydrateFromCloud);

  useEffect(() => {
    clearDiagnostics();
    void clearNotificationLog();
    recordDiagnostic('auth-provider-mounted', { configured: isSupabaseConfigured });
    if (!isSupabaseConfigured) { setLoading(false); return; }
    let active = true;
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const finishInitialization = () => {
      if (!active || settled) return;
      settled = true;
      clearTimeout(timeout);
      setLoading(false);
    };
    timeout = setTimeout(() => {
      if (!active || settled) return;
      recordDiagnostic('auth-session-init-timeout', undefined, 'error');
      finishInitialization();
    }, SESSION_INIT_TIMEOUT_MS);
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (next?.user.id) beginDiagnosticSession(next.user.id);
      recordDiagnostic('auth-state-change', { event, hasSession: Boolean(next), userId: next?.user.id ?? null });
      setSession(next);
      finishInitialization();
    });
    recordDiagnostic('auth-get-session-started');
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (data.session?.user.id) beginDiagnosticSession(data.session.user.id);
      if (error) recordDiagnostic('auth-get-session-failed', error, 'error');
      else recordDiagnostic('auth-get-session-succeeded', { hasSession: Boolean(data.session), userId: data.session?.user.id ?? null });
      setSession(data.session ?? null);
    }).catch((error: unknown) => recordDiagnostic('auth-get-session-rejected', error, 'error')).finally(finishInitialization);
    return () => { active = false; clearTimeout(timeout); listener.subscription.unsubscribe(); recordDiagnostic('auth-provider-unmounted'); };
  }, []);

  useEffect(() => {
    if (!session?.provider_token) return;
    const marker = `flowos-auto-sync-${session.user.id}-${session.access_token.slice(-12)}`;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(marker)) {
      recordDiagnostic('google-auto-sync-skipped', { reason: 'already-started-for-session' });
      return;
    }
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(marker, '1');
    let active = true;
    void (async () => {
      try {
        recordDiagnostic('google-auto-sync-started', { userId: session.user.id });
        // The public connection row can survive after the private Google token was
        // removed or expired. Refresh the private token on every new Google login
        // before attempting any synchronization.
        await connectGoogleFromSession(session, true);
        recordDiagnostic('google-workspace-connection-refreshed', { userId: session.user.id });
        await syncGoogleWorkspace((progress) => recordDiagnostic('google-auto-sync-progress', progress));
        if (active) await hydrateFromCloud();
        recordDiagnostic('google-auto-sync-completed', { userId: session.user.id });
      } catch (error) {
        if (active) recordDiagnostic('google-auto-sync-failed', error, 'error');
      }
    })();
    return () => { active = false; };
  }, [session?.provider_token, session?.user.id, session?.access_token, hydrateFromCloud]);

  useEffect(() => {
    if (!session?.user.id) return;
    void registerBackgroundSync();
    void checkAndRecoverMissedDailySummary();
    void refreshReminders();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkAndRecoverMissedDailySummary();
        void refreshReminders();
      }
    });
    return () => subscription.remove();
  }, [session?.user.id]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    loading,
    configured: isSupabaseConfigured,
    setAuthenticatedSession: (next) => {
      beginDiagnosticSession(next.user.id);
      recordDiagnostic('auth-session-set-directly', { userId: next.user.id });
      setSession(next);
      setLoading(false);
    },
    signOut: async () => {
      recordDiagnostic('auth-sign-out-started');
      await supabase.auth.signOut();
      endDiagnosticSession();
    },
  }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
