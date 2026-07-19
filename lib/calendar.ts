import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

async function getWritableCalendarId() {
  const permission = await Calendar.requestCalendarPermissionsAsync();
  if (!permission.granted) throw new Error('Calendar permission denied');
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find((calendar) => calendar.allowsModifications);
  if (writable) return writable.id;

  if (Platform.OS === 'android') {
    const source = calendars.find((calendar) => calendar.source?.isLocalAccount)?.source;
    if (!source) throw new Error('No writable calendar available');
    return Calendar.createCalendarAsync({
      title: 'FlowOS',
      color: '#111111',
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: source.id,
      source,
      name: 'FlowOS',
      ownerAccount: 'personal',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
  }

  const defaultCalendar = await Calendar.getDefaultCalendarAsync();
  return Calendar.createCalendarAsync({
    title: 'FlowOS',
    color: '#111111',
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: defaultCalendar.source.id,
    source: defaultCalendar.source,
    name: 'FlowOS',
    ownerAccount: defaultCalendar.ownerAccount,
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
}

export async function addCommitmentToCalendar(title: string, start: Date, durationMinutes = 30) {
  const calendarId = await getWritableCalendarId();
  return Calendar.createEventAsync(calendarId, {
    title,
    startDate: start,
    endDate: new Date(start.getTime() + durationMinutes * 60_000),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}
