export type CommitmentStatus = 'active' | 'waiting' | 'scheduled' | 'blocked' | 'someday' | 'done';
export type Energy = 'low' | 'medium' | 'high';
export type CommitmentKind = 'task' | 'event' | 'reminder' | 'routine' | 'idea';

export interface Commitment {
  id: string;
  title: string;
  description?: string;
  kind: CommitmentKind;
  status: CommitmentStatus;
  durationMinutes: number;
  energy: Energy;
  context: string;
  dueAt?: string;
  scheduledAt?: string;
  fixed?: boolean;
  outcome?: string;
  confidence: number;
  googleCalendarId?: string;
  googleTaskListId?: string;
  externalId?: string;
  externalEtag?: string;
  externalUpdatedAt?: string;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'error' | 'local_only';
  syncError?: string;
  deletedAt?: string;
}
