import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Commitment } from '@/types';
import { flushOfflineQueue, loadCommitments, saveCommitment } from './commitmentsRepository';

const seed: Commitment[] = [
  { id: '1', title: 'Preparare il budget del programma', kind: 'task', status: 'active', durationMinutes: 40, energy: 'high', context: 'Lavoro', dueAt: new Date(Date.now() + 86400000).toISOString(), outcome: 'Versione revisionabile pronta', confidence: 0.82 },
  { id: '2', title: 'Riunione programma', kind: 'event', status: 'scheduled', durationMinutes: 60, energy: 'medium', context: 'Lavoro', scheduledAt: new Date(Date.now() + 2 * 3600000).toISOString(), fixed: true, confidence: 1 },
  { id: '3', title: 'Chiamare il pediatra', kind: 'task', status: 'scheduled', durationMinutes: 10, energy: 'low', context: 'Telefono', dueAt: new Date(Date.now() + 2 * 86400000).toISOString(), confidence: 0.94 },
];

type State = {
  commitments: Commitment[];
  focusId?: string;
  syncing: boolean;
  addCommitment: (commitment: Commitment) => Promise<void>;
  hydrateFromCloud: () => Promise<void>;
  complete: (id: string) => Promise<void>;
  postpone: (id: string) => Promise<void>;
  startFocus: (id: string) => void;
  stopFocus: () => void;
};

export const useFlowStore = create<State>()(persist((set, get) => ({
  commitments: seed,
  syncing: false,

  addCommitment: async (commitment) => {
    set((state) => ({ commitments: [commitment, ...state.commitments] }));
    await saveCommitment(commitment);
  },

  hydrateFromCloud: async () => {
    set({ syncing: true });
    try {
      await flushOfflineQueue();
      const remote = await loadCommitments();
      if (remote.length) set({ commitments: remote });
    } finally {
      set({ syncing: false });
    }
  },

  complete: async (id) => {
    const item = get().commitments.find((commitment) => commitment.id === id);
    if (!item) return;
    const updated: Commitment = { ...item, status: 'done' };
    set((state) => ({ commitments: state.commitments.map((commitment) => commitment.id === id ? updated : commitment) }));
    await saveCommitment(updated);
  },

  postpone: async (id) => {
    const item = get().commitments.find((commitment) => commitment.id === id);
    if (!item) return;
    const updated: Commitment = { ...item, status: 'scheduled', scheduledAt: new Date(Date.now() + 86400000).toISOString() };
    set((state) => ({ commitments: state.commitments.map((commitment) => commitment.id === id ? updated : commitment) }));
    await saveCommitment(updated);
  },

  startFocus: (id) => set({ focusId: id }),
  stopFocus: () => set({ focusId: undefined }),
}), {
  name: 'flowos-store-v1',
  storage: createJSONStorage(() => AsyncStorage),
  partialize: (state) => ({ commitments: state.commitments, focusId: state.focusId }),
}));
