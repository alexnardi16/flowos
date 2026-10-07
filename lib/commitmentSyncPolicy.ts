import type { Commitment } from '../types';

export function initialSyncStatus(item: Pick<Commitment, 'kind' | 'status' | 'externalId'>): 'pending' | 'synced' {
  if (!item.externalId) return 'pending';
  if (item.kind === 'event' && item.status === 'done') return 'synced';
  return 'pending';
}

export function shouldPushToGoogle(item: Pick<Commitment, 'deletedAt'>): boolean {
  return !item.deletedAt;
}

export function shouldPreserveLocalTombstone(item: { deletedAt?: string; lastSyncOrigin?: string }): boolean {
  return Boolean(item.deletedAt && item.lastSyncOrigin === 'flowos');
}
