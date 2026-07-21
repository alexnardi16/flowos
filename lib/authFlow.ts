import type { Session } from '@supabase/supabase-js';

export const AUTHENTICATED_HOME = '/(tabs)/index' as const;

export type OtpVerificationResult = {
  data: { session: Session | null };
  error: { message: string } | null;
};

type CompleteOtpLoginOptions = {
  verify: () => Promise<OtpVerificationResult>;
  commitSession: (session: Session) => void;
  navigate: (href: typeof AUTHENTICATED_HOME) => void;
};

export async function completeOtpLogin({ verify, commitSession, navigate }: CompleteOtpLoginOptions): Promise<void> {
  const { data, error } = await verify();

  if (error) throw new Error(error.message);
  if (!data.session) throw new Error('Codice verificato, ma Supabase non ha restituito una sessione valida.');

  commitSession(data.session);
  navigate(AUTHENTICATED_HOME);
}
