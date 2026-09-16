import type { Commitment } from '../types';
import { buildPlanningSuggestions, type PlanningSuggestion } from './planningSuggestions';

export type AIPlanningSuggestion = PlanningSuggestion & { priority: 'high' | 'medium' | 'low'; action?: 'schedule' | 'reschedule' | 'split' | 'defer' | 'protect'; commitmentIds?: string[] };
export type AIPlanningResult = { suggestions: AIPlanningSuggestion[]; generatedBy: 'deterministic'; };

/** Compatibility wrapper kept for existing imports. Planning is now fully deterministic and local. */
export async function generateAIPlanningSuggestions(commitments: Commitment[], now: Date = new Date()): Promise<AIPlanningResult> {
  return { suggestions: buildPlanningSuggestions(commitments, undefined, now).map(item => ({ ...item, priority: 'medium' as const })), generatedBy: 'deterministic' };
}
