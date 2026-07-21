import type { Session } from '@supabase/supabase-js';

export type OtpVerificationResult = {
  data: { session: Session | null };
  error: { message: string } | null;
};

type CompleteOtpLoginOptions = {
  verify: () => Promise<OtpVerificationResult>;
  commitSession: (session: Session) => void;
  navigate: (href: '/(tabs)') => void;
};

export async function completeOtpLogin({ verify, commitSession, navigate }: CompleteOtpLoginOptions): Promise<void> {
  const { data, error } = await verify();

  if (error) throw new Error(error.message);
  if (!data.session) throw new Error('Codice verificato, ma Supabase non ha restituito una sessione valida.');

  // Commit the exact session returned by verifyOtp before navigating. This removes
  // any dependency on a storage reload or a later getSession() race.
  commitSession(data.session);
  navigate('/(tabs)');
}
