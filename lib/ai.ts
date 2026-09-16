import type { Commitment, CommitmentKind, Energy } from '../types';

function localInterpretation(text: string): Commitment {
  const lower = text.trim().toLowerCase();
  const kind: CommitmentKind = /riunione|appuntamento|call|visita|incontro|meeting/.test(lower)
    ? 'event'
    : /ricordami|promemoria|ricorda/.test(lower)
      ? 'reminder'
      : 'task';
  const energy: Energy = /scrivere|analizzare|preparare|studiare|progettare|sviluppare/.test(lower) ? 'high' : 'medium';
  const context = /casa|spesa|famiglia|cucina/.test(lower) ? 'casa' : /ufficio|lavoro|cliente|progetto/.test(lower) ? 'lavoro' : 'generale';
  return {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: text.trim(),
    kind,
    status: kind === 'event' ? 'scheduled' : 'active',
    durationMinutes: kind === 'event' ? 60 : 30,
    energy,
    context,
    confidence: 1,
  };
}

/** Deterministic natural-language interpretation. No external model or API key is used. */
export async function interpretCommitment(text: string): Promise<Commitment> {
  return localInterpretation(text);
}
