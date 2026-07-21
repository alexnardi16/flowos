import type { Session } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { recordDiagnostic } from '../lib/diagnostics';
import { connectGoogleFromSession } from '../lib/googleWorkspace';
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

  useEffect(() => {
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
      recordDiagnostic('auth-state-change', { event, hasSession: Boolean(next), userId: next?.user.id ?? null });
      setSession(next);
      finishInitialization();
    });
    recordDiagnostic('auth-get-session-started');
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) recordDiagnostic('auth-get-session-failed', error, 'error');
      else recordDiagnostic('auth-get-session-succeeded', { hasSession: Boolean(data.session), userId: data.session?.user.id ?? null });
      setSession(data.session ?? null);
    }).catch((error: unknown) => recordDiagnostic('auth-get-session-rejected', error, 'error')).finally(finishInitialization);
    return () => { active = false; clearTimeout(timeout); listener.subscription.unsubscribe(); recordDiagnostic('auth-provider-unmounted'); };
  }, []);

  useEffect(() => {
    if (!session?.provider_token) return;
    void connectGoogleFromSession(session)
      .then(() => recordDiagnostic('google-workspace-connected', { userId: session.user.id }))
      .catch((error) => recordDiagnostic('google-workspace-connect-failed', error, 'error'));
  }, [session?.provider_token, session?.user.id]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    loading,
    configured: isSupabaseConfigured,
    setAuthenticatedSession: (next) => { recordDiagnostic('auth-session-set-directly', { userId: next.user.id }); setSession(next); setLoading(false); },
    signOut: async () => { recordDiagnostic('auth-sign-out-started'); await supabase.auth.signOut(); recordDiagnostic('auth-sign-out-finished'); },
  }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
