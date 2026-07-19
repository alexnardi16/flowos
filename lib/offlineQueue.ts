import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'flowos:offline-queue:v1';

export type PendingMutation = {
  id: string;
  table: 'commitments';
  action: 'upsert' | 'delete';
  payload: Record<string, unknown>;
  createdAt: string;
};

export async function enqueueMutation(mutation: PendingMutation) {
  const queue = await readQueue();
  await AsyncStorage.setItem(KEY, JSON.stringify([...queue, mutation]));
}

export async function readQueue(): Promise<PendingMutation[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as PendingMutation[]; } catch { return []; }
}

export async function replaceQueue(queue: PendingMutation[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(queue));
}
