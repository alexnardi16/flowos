import type { AndroidCalendarWeek } from '../widgets/android/CalendarWidget';

export const CALENDAR_WIDGET_PAGE_SIZE = 8;
export const CALENDAR_WIDGET_PAGE_OVERLAP = 0;
export const CALENDAR_WIDGET_PAGE_CACHE_META_KEY = 'flowos-calendar-widget-page-cache-meta-v1';
const CALENDAR_WIDGET_PAGE_CACHE_PREFIX = 'flowos-calendar-widget-page-cache-v1:';
export function getCalendarWidgetPageCacheKey(startIndex:number) { return `${CALENDAR_WIDGET_PAGE_CACHE_PREFIX}${startIndex}`; }

/** Bounded, stable page boundaries allow navigation to load exactly one cached page. */
export function getCalendarWidgetPage(allWeeks:AndroidCalendarWeek[],requestedStartIndex?:number|null,now:Date=new Date()){
  void now;
  const currentIndex=allWeeks.findIndex(week=>week.days.some(day=>day.isToday));
  const defaultStart=Math.floor(Math.max(0,currentIndex<0?0:currentIndex)/CALENDAR_WIDGET_PAGE_SIZE)*CALENDAR_WIDGET_PAGE_SIZE;
  const maxStart=Math.max(0,Math.floor(Math.max(0,allWeeks.length-1)/CALENDAR_WIDGET_PAGE_SIZE)*CALENDAR_WIDGET_PAGE_SIZE);
  const requested=Number.isFinite(requestedStartIndex)?Number(requestedStartIndex):defaultStart;
  const startIndex=Math.max(0,Math.min(Math.floor(requested/CALENDAR_WIDGET_PAGE_SIZE)*CALENDAR_WIDGET_PAGE_SIZE,maxStart));
  const weeks=allWeeks.slice(startIndex,startIndex+CALENDAR_WIDGET_PAGE_SIZE);
  return {weeks,startIndex,hasOlderWeeks:startIndex>0,hasNewerWeeks:startIndex+weeks.length<allWeeks.length,totalWeeks:allWeeks.length,currentWeekIndex:currentIndex};
}

export function buildCalendarWidgetPageCache(allWeeks:AndroidCalendarWeek[],language:string,now:Date=new Date()){
  const dateKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const defaultPage=getCalendarWidgetPage(allWeeks,undefined,now);
  const entries:[string,string][]=[];
  for(let startIndex=0;startIndex<allWeeks.length;startIndex+=CALENDAR_WIDGET_PAGE_SIZE){
    const page=getCalendarWidgetPage(allWeeks,startIndex,now);
    entries.push([getCalendarWidgetPageCacheKey(page.startIndex),JSON.stringify({dateKey,language,...page})]);
  }
  return {entries,metadata:JSON.stringify({dateKey,language,defaultStartIndex:defaultPage.startIndex,totalWeeks:allWeeks.length}),defaultStartIndex:defaultPage.startIndex};
}
