import { supabase } from './supabase';

export async function deleteFlowOSAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error) throw error;
  await supabase.auth.signOut();
}
