import type { Commitment } from '../types';

export const GOOGLE_BIRTHDAYS_CALENDAR_ID = 'addressbook#contacts@group.v.calendar.google.com';

/** True for birthday/anniversary events synced from Google Contacts — either flagged via Calendar API's own eventType, or because they came from the dedicated birthdays calendar itself. */
export function isContactEvent(item: Commitment): boolean {
  return item.googleEventType === 'birthday' || item.googleCalendarId === GOOGLE_BIRTHDAYS_CALENDAR_ID;
}
