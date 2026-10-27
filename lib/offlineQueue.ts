import AsyncStorage from '@react-native-async-storage/async-storage';
import { parsePendingQueue, reconcileQueueAfterFlush, type PendingMutation } from './offlineQueueState';

export type { PendingMutation } from './offlineQueueState';
const KEY = 'flowos:offline-queue:v2';
let queueLock: Promise<void> = Promise.resolve();
function withQueueLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = queueLock.then(operation, operation);
  queueLock = result.then(() => undefined, () => undefined);
  return result;
}
async function readQueueUnlocked(): Promise<PendingMutation[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw === null ? [] : parsePendingQueue(raw);
}
async function writeQueueUnlocked(queue: PendingMutation[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(queue));
}
function targetId(mutation: PendingMutation): string { return String(mutation.payload.id ?? mutation.id); }
export async function enqueueMutation(mutation: PendingMutation): Promise<void> {
  await withQueueLock(async () => {
    const queue = await readQueueUnlocked();
    const target = targetId(mutation);
    const next = queue.filter((item) => !(item.table === mutation.table && targetId(item) === target));
    await writeQueueUnlocked([...next, mutation]);
  });
}
export async function readQueue(): Promise<PendingMutation[]> { return withQueueLock(readQueueUnlocked); }
export async function replaceQueue(queue: PendingMutation[]): Promise<void> {
  await withQueueLock(() => writeQueueUnlocked(queue));
}
export async function reconcileFlushedQueue(snapshot: PendingMutation[], failed: PendingMutation[]): Promise<PendingMutation[]> {
  return withQueueLock(async () => {
    const current = await readQueueUnlocked();
    const next = reconcileQueueAfterFlush(snapshot, failed, current);
    await writeQueueUnlocked(next);
    return next;
  });
}
export async function getPendingCommitmentIds(): Promise<Set<string>> {
  return new Set((await readQueue()).filter((item) => item.table === 'commitments').map(targetId));
}
export async function getOfflineQueueSize(): Promise<number> { return (await readQueue()).length; }
