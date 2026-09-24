export type CommitmentStatus = 'active' | 'waiting' | 'scheduled' | 'blocked' | 'someday' | 'done';
export type Energy = 'low' | 'medium' | 'high';
export type CommitmentKind = 'task' | 'event';

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
  /** FlowOS task execution order. 1 is the highest priority. */
  priority?: number;
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
  reminders?: ReminderOffset[];
  reminderDismissedAt?: string;
  externalId?: string;
  externalEtag?: string;
  externalUpdatedAt?: string;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'error' | 'local_only' | 'conflict';
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

/** A single configurable reminder notification offset — an item can have several. */
export interface ReminderOffset {
  id: string;
  minutesBefore: number;
  /** When this reminder was added. Used to distinguish new reminders from reminders dismissed by an action. */
  createdAt?: string;
}