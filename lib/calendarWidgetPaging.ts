import type { AndroidCalendarWeek } from '../widgets/android/CalendarWidget';

export const CALENDAR_WIDGET_PAGE_SIZE = 8;
export const CALENDAR_WIDGET_PAGE_OVERLAP = 0;
export const CALENDAR_WIDGET_PAGE_CACHE_META_KEY = 'flowos-calendar-widget-page-cache-meta-v2';
const CALENDAR_WIDGET_PAGE_CACHE_PREFIX = 'flowos-calendar-widget-page-cache-v2:';
export function getCalendarWidgetPageCacheKey(startIndex:number) { return `${CALENDAR_WIDGET_PAGE_CACHE_PREFIX}${startIndex}`; }

/** The default page starts on the current week, followed by the next seven weeks. */
export function getCalendarWidgetPage(allWeeks:AndroidCalendarWeek[],requestedStartIndex?:number|null,now:Date=new Date()){
  const currentIndex=allWeeks.findIndex(week=>week.days.some(day=>day.isToday));
  const maxStart=Math.max(0,allWeeks.length-CALENDAR_WIDGET_PAGE_SIZE);
  const defaultStart=Math.min(Math.max(0,currentIndex<0?0:currentIndex),maxStart);
  const requested=Number.isFinite(requestedStartIndex)?Math.floor(Number(requestedStartIndex)):defaultStart;
  const startIndex=Math.max(0,Math.min(requested,maxStart));
  const weeks=allWeeks.slice(startIndex,startIndex+CALENDAR_WIDGET_PAGE_SIZE);
  return {weeks,startIndex,hasOlderWeeks:startIndex>0,hasNewerWeeks:startIndex+weeks.length<allWeeks.length,totalWeeks:allWeeks.length,currentWeekIndex:currentIndex};
}

export function buildCalendarWidgetPageCache(allWeeks:AndroidCalendarWeek[],language:string,now:Date=new Date()){
  const dateKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const defaultPage=getCalendarWidgetPage(allWeeks,undefined,now);
  const maxStart=Math.max(0,allWeeks.length-CALENDAR_WIDGET_PAGE_SIZE);
  const starts=new Set<number>([defaultPage.startIndex]);
  let cursor=defaultPage.startIndex;
  while(cursor>0){cursor=Math.max(0,cursor-CALENDAR_WIDGET_PAGE_SIZE);starts.add(cursor);}
  cursor=defaultPage.startIndex;
  while(cursor<maxStart){cursor=Math.min(maxStart,cursor+CALENDAR_WIDGET_PAGE_SIZE);starts.add(cursor);}
  const pageStarts=[...starts].sort((a,b)=>a-b);
  const entries:[string,string][]=[];
  for(const startIndex of pageStarts){
    const page=getCalendarWidgetPage(allWeeks,startIndex,now);
    entries.push([getCalendarWidgetPageCacheKey(page.startIndex),JSON.stringify({dateKey,language,...page})]);
  }
  return {entries,metadata:JSON.stringify({pageVersion:2,dateKey,language,defaultStartIndex:defaultPage.startIndex,totalWeeks:allWeeks.length,pageStarts}),defaultStartIndex:defaultPage.startIndex};
}
