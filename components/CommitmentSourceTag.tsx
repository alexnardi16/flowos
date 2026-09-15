import { Chip } from '@/components/ui';
import { friendlyCalendarName, type GoogleWorkspaceStatus } from '@/lib/googleWorkspace';
import type { Commitment } from '@/types';

export function commitmentSourceLabel(item: Commitment, google: GoogleWorkspaceStatus | null): string {
  if (item.kind === 'task' && item.googleTaskListId) {
    const list = google?.taskLists.find((entry) => entry.google_task_list_id === item.googleTaskListId);
    if (list) return `Google Tasks · ${list.title}`;
    return 'Google Tasks';
  }

  if (item.googleCalendarId) {
    const calendar = google?.calendars.find((entry) => entry.google_calendar_id === item.googleCalendarId);
    if (calendar) return `Google Calendar · ${friendlyCalendarName(calendar.summary, google?.connection?.google_email)}`;
    return 'Google Calendar';
  }

  return 'FlowOS';
}

export function CommitmentSourceTag({ item, google }: { item: Commitment; google: GoogleWorkspaceStatus | null }) {
  const label = commitmentSourceLabel(item, google);
  const tone = label === 'FlowOS' ? 'neutral' : 'primary';
  return <Chip tone={tone}>{label}</Chip>;
}
