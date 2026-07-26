export type CommitmentStatus = 'active' | 'waiting' | 'scheduled' | 'blocked' | 'someday' | 'done';
export type Energy = 'low' | 'medium' | 'high';
export type CommitmentKind = 'task' | 'event' | 'reminder' | 'routine' | 'idea';

export interface Commitment {
  id: string;
  title: string;
  description?: string;
  notes?: string;
  location?: string;
  link?: string;
  kind: CommitmentKind;
  status: CommitmentStatus;
  durationMinutes: number;
  energy: Energy;
  context: string;
  dueAt?: string;
  scheduledAt?: string;
  fixed?: boolean;
  allDay?: boolean;
  outcome?: string;
  confidence: number;
  googleCalendarId?: string;
  googleTaskListId?: string;
  googleRecurringEventId?: string;
  googleEventType?: string;
  recurrenceRule?: RecurrenceRule;
  recurrenceSeriesId?: string;
  externalId?: string;
  externalEtag?: string;
  externalUpdatedAt?: string;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'error' | 'local_only';
  syncError?: string;
  deletedAt?: string;
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

/** Locally-managed recurrence for FlowOS-only tasks/reminders (Google Tasks has no native recurrence). */
export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  until?: string;
  count?: number;
}