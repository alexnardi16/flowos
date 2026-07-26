import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Commitment } from '@/types';
import { deleteCommitmentAlsoFromGoogle, deleteRecurringSeries, flushOfflineQueue, loadCommitments, removeCommitmentOnlyFromFlowOS, saveCommitment } from './commitmentsRepository';
import { materializeNextOccurrence } from './recurrence';
import { createAutomaticPlan } from './scheduler';

type State = {
  commitments: Commitment[];
  focusId?: string;
  syncing: boolean;
  addCommitment: (commitment: Commitment) => Promise<void>;
  hydrateFromCloud: () => Promise<void>;
  complete: (id: string) => Promise<void>;
  postpone: (id: string) => Promise<void>;
  updateCommitment: (commitment: Commitment) => Promise<void>;
  removeOnlyFromFlowOS: (id: string) => Promise<void>;
  removeAlsoFromGoogle: (id: string) => Promise<void>;
  removeSeriesFromGoogle: (id: string) => Promise<void>;
  autoPlan: () => Promise<void>;
  startFocus: (id: string) => void;
  stopFocus: () => void;
};

export const useFlowStore = create<State>()(persist((set, get) => ({
  commitments: [],
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
      set({ commitments: remote });
    } finally {
      set({ syncing: false });
    }
  },

  complete: async (id) => {
    const item = get().commitments.find((commitment) => commitment.id === id);
    if (!item) return;
    const updated: Commitment = { ...item, status: 'done' };
    const next = materializeNextOccurrence(updated);
    set((state) => ({
      commitments: next
        ? [next, ...state.commitments.map((commitment) => commitment.id === id ? updated : commitment)]
        : state.commitments.map((commitment) => commitment.id === id ? updated : commitment),
    }));
    await saveCommitment(updated);
    if (next) await saveCommitment(next);
  },

  postpone: async (id) => {
    const item = get().commitments.find((commitment) => commitment.id === id);
    if (!item) return;
    const updated: Commitment = { ...item, status: 'scheduled', scheduledAt: new Date(Date.now() + 86400000).toISOString() };
    set((state) => ({ commitments: state.commitments.map((commitment) => commitment.id === id ? updated : commitment) }));
    await saveCommitment(updated);
  },

  updateCommitment: async (updated) => {
    set((state) => ({ commitments: state.commitments.map((item) => item.id === updated.id ? updated : item) }));
    await saveCommitment(updated);
  },

  removeOnlyFromFlowOS: async (id) => {
    await removeCommitmentOnlyFromFlowOS(id);
    set((state) => ({ commitments: state.commitments.filter((item) => item.id !== id) }));
  },

  removeAlsoFromGoogle: async (id) => {
    const item = get().commitments.find((commitment) => commitment.id === id);
    if (!item) return;
    await deleteCommitmentAlsoFromGoogle(item);
    set((state) => ({ commitments: state.commitments.filter((commitment) => commitment.id !== id) }));
  },

  removeSeriesFromGoogle: async (id) => {
    const item = get().commitments.find((commitment) => commitment.id === id);
    if (!item) return;
    await deleteRecurringSeries(item);
    const seriesId = item.googleRecurringEventId;
    set((state) => ({ commitments: state.commitments.filter((commitment) => commitment.googleRecurringEventId !== seriesId) }));
  },

  autoPlan: async () => {
    const planned = createAutomaticPlan(get().commitments);
    set({ commitments: planned });
    await Promise.all(planned.map((commitment) => saveCommitment(commitment)));
  },

  startFocus: (id) => set({ focusId: id }),
  stopFocus: () => set({ focusId: undefined }),
}), {
  name: 'flowos-store-v2',
  storage: createJSONStorage(() => AsyncStorage),
  partialize: (state) => ({ commitments: state.commitments, focusId: state.focusId }),
}));
