import { Chip } from '@/components/ui';
import { friendlyCalendarName, type GoogleWorkspaceStatus } from '@/lib/googleWorkspace';
import type { Commitment } from '@/types';
import { t } from '@/lib/i18n';

export function commitmentSourceLabel(item: Commitment, google: GoogleWorkspaceStatus | null): string {
  if (item.kind === 'task' && item.googleTaskListId) {
    const list = google?.taskLists.find((entry) => entry.google_task_list_id === item.googleTaskListId);
    if (list) return `${t('Google Tasks')} · ${list.title}`;
    return t('Google Tasks');
  }

  if (item.googleCalendarId) {
    const calendar = google?.calendars.find((entry) => entry.google_calendar_id === item.googleCalendarId);
    if (calendar) return `${t('Google Calendar')} · ${friendlyCalendarName(calendar.summary, google?.connection?.google_email)}`;
    return t('Google Calendar');
  }

  return t('FlowOS');
}

export function CommitmentSourceTag({ item, google }: { item: Commitment; google: GoogleWorkspaceStatus | null }) {
  const label = commitmentSourceLabel(item, google);
  const tone = label === 'FlowOS' ? 'neutral' : 'primary';
  return <Chip tone={tone}>{label}</Chip>;
}
