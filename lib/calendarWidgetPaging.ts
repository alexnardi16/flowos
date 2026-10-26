import type { AndroidCalendarWeek } from '../widgets/android/CalendarWidget';

export const CALENDAR_WIDGET_PAGE_SIZE = 6;
export const CALENDAR_WIDGET_PAGE_OVERLAP = 2;

/**
 * Keep the complete timeline in local cache, but send only one bounded page to
 * Android RemoteViews. Large RemoteViews collections can exceed Binder limits
 * and make the launcher show a blank widget.
 */
export function getCalendarWidgetPage(
  allWeeks: AndroidCalendarWeek[],
  requestedStartIndex?: number | null,
  now: Date = new Date(),
) {
  const currentIndex = allWeeks.findIndex(week => week.days.some(day => day.isToday));
  const defaultStart = Math.max(0, (currentIndex < 0 ? 0 : currentIndex) - 4);
  const maxStart = Math.max(0, allWeeks.length - CALENDAR_WIDGET_PAGE_SIZE);
  const requested = Number.isFinite(requestedStartIndex) ? Number(requestedStartIndex) : defaultStart;
  const startIndex = Math.max(0, Math.min(Math.floor(requested), maxStart));
  const weeks = allWeeks.slice(startIndex, startIndex + CALENDAR_WIDGET_PAGE_SIZE);
  return {
    weeks,
    startIndex,
    hasOlderWeeks: startIndex > 0,
    hasNewerWeeks: startIndex + weeks.length < allWeeks.length,
    totalWeeks: allWeeks.length,
    currentWeekIndex: currentIndex,
  };
}
