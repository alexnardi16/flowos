import type { Commitment } from '../types';

export function upsertCommitmentState(current: Commitment[], item: Commitment): Commitment[] {
  const next = current.filter(existing => existing.id !== item.id);
  return [item, ...next];
}

export function removeCommitmentState(current: Commitment[], id: string): Commitment[] {
  return current.filter(item => item.id !== id);
}

export function mergeRemoteCommitments(
  remote: Commitment[],
  local: Commitment[],
  protectedIds: Iterable<string>,
): Commitment[] {
  const protectedSet = new Set(protectedIds);
  const remoteIds = new Set(remote.map(item => item.id));
  const preserved = local.filter(item => protectedSet.has(item.id) && !remoteIds.has(item.id));
  return [...preserved, ...remote];
}
