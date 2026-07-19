import { supabase, isSupabaseConfigured } from './supabase';
import type { Commitment, CommitmentKind, Energy } from '../types';

function localFallback(text: string): Commitment {
  const lower = text.toLowerCase();
  const kind: CommitmentKind = /riunione|appuntamento|call|visita/.test(lower)
    ? 'event'
    : /ricordami|promemoria/.test(lower)
      ? 'reminder'
      : 'task';
  const energy: Energy = /scrivere|analizzare|preparare|studiare/.test(lower) ? 'high' : 'medium';
  return {
    id: crypto.randomUUID?.() ?? `${Date.now()}`,
    title: text.trim(),
    kind,
    status: kind === 'event' ? 'scheduled' : 'active',
    durationMinutes: kind === 'event' ? 60 : 30,
    energy,
    context: /casa|spesa|famiglia/.test(lower) ? 'casa' : 'generale',
    confidence: 0.55,
  };
}

export async function interpretCommitment(text: string): Promise<Commitment> {
  if (!isSupabaseConfigured) return localFallback(text);
  const { data, error } = await supabase.functions.invoke('interpret-commitment', { body: { text } });
  if (error || !data) return localFallback(text);
  return { ...data, id: data.id ?? (crypto.randomUUID?.() ?? `${Date.now()}`) } as Commitment;
}
