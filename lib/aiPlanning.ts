import { supabase, isSupabaseConfigured } from './supabase';
import type { Commitment } from '../types';
import { buildPlanningSuggestions, type PlanningSuggestion } from './planningSuggestions';

export type AIPlanningSuggestion = PlanningSuggestion & {
  priority: 'high' | 'medium' | 'low';
  action?: 'schedule' | 'reschedule' | 'split' | 'defer' | 'protect';
  commitmentIds?: string[];
};

export type AIPlanningResult = {
  suggestions: AIPlanningSuggestion[];
  generatedBy: 'ai' | 'fallback';
};

/** Asks the server-side planner for contextual recommendations. The OpenAI key never reaches the client. */
export async function generateAIPlanningSuggestions(commitments: Commitment[], now: Date = new Date()): Promise<AIPlanningResult> {
  const fallback: AIPlanningResult = {
    suggestions: buildPlanningSuggestions(commitments, undefined, now).map((item) => ({ ...item, priority: 'medium' as const })),
    generatedBy: 'fallback',
  };
  if (!isSupabaseConfigured) return fallback;
  try {
    const { data, error } = await supabase.functions.invoke('ai-planner', {
      body: { now: now.toISOString(), commitments: commitments.filter((item) => item.status !== 'done' && !item.deletedAt) },
    });
    if (error || !data || !Array.isArray(data.suggestions)) return fallback;
    return { suggestions: data.suggestions as AIPlanningSuggestion[], generatedBy: 'ai' };
  } catch {
    return fallback;
  }
}
