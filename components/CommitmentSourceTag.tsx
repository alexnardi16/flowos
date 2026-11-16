import { Chip, palette } from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
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
  const compactLabel=label.replace('Google Calendar','Calendar').replace('Google Tasks','Tasks');
  const iconName=item.kind==='task'&&item.googleTaskListId?'logo-google':item.googleCalendarId?'logo-google':'layers-outline';
  return <View accessibilityRole="text" accessibilityLabel={label}><Chip tone={tone}><View style={styles.row}><Ionicons name={iconName} size={11} color={tone==='neutral'?palette.muted:palette.primary}/><Text numberOfLines={1} style={styles.text}>{compactLabel}</Text></View></Chip></View>;
}
const styles=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',gap:4},text:{fontSize:10,fontWeight:'600',color:palette.primary}});
