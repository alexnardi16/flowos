/**
 * Pure dedup guard: has today's daily-summary recovery already run?
 * Kept dependency-free (no Expo/RN imports) so it is unit-testable the same
 * way lib/authFlow.ts is, via tests/tsconfig.notifications.json.
 */
export function hasRecoveredToday(lastRecoveryDateKey: string | null, dateKey: string): boolean {
  return lastRecoveryDateKey === dateKey;
}
