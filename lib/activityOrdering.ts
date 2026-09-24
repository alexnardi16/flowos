import type { Commitment } from '../types';

export function compareCommitmentsAlphabetically(a: Commitment, b: Commitment): number {
  const titleCompare = a.title.localeCompare(b.title, 'it-IT', {
    sensitivity: 'base',
    numeric: true,
    ignorePunctuation: true,
  });
  if (titleCompare !== 0) return titleCompare;

  const aWhen = a.scheduledAt ?? a.dueAt ?? '';
  const bWhen = b.scheduledAt ?? b.dueAt ?? '';
  if (aWhen !== bWhen) return aWhen.localeCompare(bWhen);

  return a.id.localeCompare(b.id);
}

export function sortCommitmentsAlphabetically(items: Commitment[]): Commitment[] {
  return [...items].sort(compareCommitmentsAlphabetically);
}
