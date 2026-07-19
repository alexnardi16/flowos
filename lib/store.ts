import { create } from 'zustand';
import { Commitment } from '@/types';

const seed: Commitment[] = [
  { id: '1', title: 'Preparare il budget del programma', kind: 'task', status: 'active', durationMinutes: 40, energy: 'high', context: 'Lavoro', dueAt: new Date(Date.now()+86400000).toISOString(), outcome: 'Versione revisionabile pronta', confidence: 0.82 },
  { id: '2', title: 'Riunione programma', kind: 'event', status: 'scheduled', durationMinutes: 60, energy: 'medium', context: 'Lavoro', scheduledAt: new Date(Date.now()+2*3600000).toISOString(), fixed: true, confidence: 1 },
  { id: '3', title: 'Chiamare il pediatra', kind: 'task', status: 'scheduled', durationMinutes: 10, energy: 'low', context: 'Telefono', dueAt: new Date(Date.now()+2*86400000).toISOString(), confidence: 0.94 }
];

type State = {
  commitments: Commitment[];
  focusId?: string;
  addFromNaturalLanguage: (text: string) => void;
  complete: (id: string) => void;
  postpone: (id: string) => void;
  startFocus: (id: string) => void;
  stopFocus: () => void;
};

function infer(text: string): Commitment {
  const lower = text.toLowerCase();
  const isEvent = /riunione|appuntamento|visita|pranzo|call/.test(lower);
  const isReminder = /ricordami|promemoria/.test(lower);
  const duration = /budget|presentazione|slide/.test(lower) ? 45 : /chiam|telefon/.test(lower) ? 10 : 25;
  const energy = duration >= 40 ? 'high' : duration <= 10 ? 'low' : 'medium';
  return {
    id: Date.now().toString(),
    title: text.trim().replace(/^ricordami di\s+/i, ''),
    kind: isEvent ? 'event' : isReminder ? 'reminder' : 'task',
    status: isEvent ? 'scheduled' : 'active',
    durationMinutes: duration,
    energy,
    context: /chiam|telefon/.test(lower) ? 'Telefono' : 'Generale',
    confidence: 0.78,
    dueAt: new Date(Date.now()+86400000).toISOString(),
    fixed: isEvent
  };
}

export const useFlowStore = create<State>((set) => ({
  commitments: seed,
  addFromNaturalLanguage: (text) => set((s) => ({ commitments: [infer(text), ...s.commitments] })),
  complete: (id) => set((s) => ({ commitments: s.commitments.map(c => c.id === id ? { ...c, status: 'done' } : c) })),
  postpone: (id) => set((s) => ({ commitments: s.commitments.map(c => c.id === id ? { ...c, status: 'scheduled', scheduledAt: new Date(Date.now()+86400000).toISOString() } : c) })),
  startFocus: (id) => set({ focusId: id }),
  stopFocus: () => set({ focusId: undefined })
}));
