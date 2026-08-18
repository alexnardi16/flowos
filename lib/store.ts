import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Commitment } from '@/types';
import { deleteCommitmentAlsoFromGoogle, deleteRecurringSeries, flushOfflineQueue, loadCommitments, pushPendingToGoogle, removeCommitmentOnlyFromFlowOS, saveCommitment } from './commitmentsRepository';
import { logNotificationEvent } from './notificationLog';
import { materializeNextOccurrence } from './recurrence';
import { createAutomaticPlan } from './scheduler';
import { showSnackbar } from './snackbar';

/** Fire-and-forget: never let a push failure block the UI action that triggered it (Controlla already surfaces sync errors on the next full sync). */
function pushGoogleSafely() {
  void pushPendingToGoogle().catch((error) => { void logNotificationEvent('auto-push-failed', error, 'warn'); });
}

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
  syncItemToGoogleNow: () => Promise<void>;
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
    pushGoogleSafely();

    showSnackbar('Attività completata', 'Annulla', () => {
      void (async () => {
        set((state) => ({
          commitments: next
            ? state.commitments.filter((c) => c.id !== next.id).map((c) => c.id === id ? item : c)
            : state.commitments.map((c) => c.id === id ? item : c),
        }));
        await saveCommitment(item);
        if (next) await removeCommitmentOnlyFromFlowOS(next.id);
        pushGoogleSafely();
      })();
    });
  },

  postpone: async (id) => {
    const item = get().commitments.find((commitment) => commitment.id === id);
    if (!item) return;
    const base = item.scheduledAt ?? item.dueAt ?? new Date().toISOString();
    const nextDay = new Date(new Date(base).getTime() + 86400000).toISOString();
    const updated: Commitment = {
      ...item,
      status: item.kind === 'event' ? 'scheduled' : item.status,
      scheduledAt: item.scheduledAt ? nextDay : undefined,
      dueAt: item.dueAt ? nextDay : undefined,
    };
    set((state) => ({ commitments: state.commitments.map((commitment) => commitment.id === id ? updated : commitment) }));
    await saveCommitment(updated);
    pushGoogleSafely();

    showSnackbar('Attività rimandata di 1 giorno', 'Annulla', () => {
      void (async () => {
        set((state) => ({ commitments: state.commitments.map((c) => c.id === id ? item : c) }));
        await saveCommitment(item);
        pushGoogleSafely();
      })();
    });
  },

  updateCommitment: async (updated) => {
    const previous = get().commitments.find((item) => item.id === updated.id);
    set((state) => ({ commitments: state.commitments.map((item) => item.id === updated.id ? updated : item) }));
    await saveCommitment(updated);
    pushGoogleSafely();

    if (previous) {
      showSnackbar('Modifiche salvate', 'Annulla', () => {
        void (async () => {
          set((state) => ({ commitments: state.commitments.map((c) => c.id === updated.id ? previous : c) }));
          await saveCommitment(previous);
          pushGoogleSafely();
        })();
      });
    }
  },

  removeOnlyFromFlowOS: async (id) => {
    const item = get().commitments.find((commitment) => commitment.id === id);
    await removeCommitmentOnlyFromFlowOS(id);
    set((state) => ({ commitments: state.commitments.filter((commitment) => commitment.id !== id) }));

    if (item) {
      showSnackbar('Attività eliminata da FlowOS', 'Annulla', () => {
        void (async () => {
          set((state) => ({ commitments: [item, ...state.commitments] }));
          await saveCommitment({ ...item, deletedAt: undefined });
        })();
      });
    }
  },

  removeAlsoFromGoogle: async (id) => {
    const item = get().commitments.find((commitment) => commitment.id === id);
    if (!item) return;
    await deleteCommitmentAlsoFromGoogle(item);
    set((state) => ({ commitments: state.commitments.filter((commitment) => commitment.id !== id) }));
    // No "Annulla" here: this also deletes the item on Google, and safely
    // recreating it there (a genuine new event/task, new external id) isn't
    // something a simple undo can do — showing an undo button that can't
    // really undo the Google-side part would be misleading.
    showSnackbar('Eliminata da FlowOS e da Google');
  },

  removeSeriesFromGoogle: async (id) => {
    const item = get().commitments.find((commitment) => commitment.id === id);
    if (!item) return;
    await deleteRecurringSeries(item);
    const seriesId = item.googleRecurringEventId;
    set((state) => ({ commitments: state.commitments.filter((commitment) => commitment.googleRecurringEventId !== seriesId) }));
  },

  /** Manual "Sincronizza con Google" — unlike pushGoogleSafely, errors are surfaced to the caller since this is a deliberate user action. */
  syncItemToGoogleNow: async () => {
    await pushPendingToGoogle();
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
