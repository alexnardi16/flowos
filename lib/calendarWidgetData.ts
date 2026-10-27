import type { Commitment } from '../types';
import type { AndroidCalendarDay, AndroidCalendarWeek } from '../widgets/android/CalendarWidget';
import { sortCommitments } from './activityOrdering';
import { activitySourceColor, buildActivitySourceColors } from './activityColors';
import type { Language } from './i18n';
import { localeForLanguage, widgetStrings } from './i18n';
import { isVisibleCompletedMultiDayForDate } from './commitmentVisibility';
import { buildCalendarTimeline } from './calendarTimeline';

export type CalendarWidgetData = { weeks: AndroidCalendarWeek[] };
const MONTHS=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
function dateKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function monthTitle(month:number,year:number,language?:Language){const name=(language?widgetStrings(language).months:MONTHS)[month]??'';return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;}
function formatItemTime(item:Commitment,language:Language='it'){
  if(item.allDay)return '';
  const startValue=item.scheduledAt??item.dueAt;
  if(!startValue)return '';
  const start=new Date(startValue);
  const startText=start.toLocaleTimeString(localeForLanguage(language),{hour:'2-digit',minute:'2-digit'});
  if(!item.scheduledAt||!item.durationMinutes)return startText;
  const end=new Date(start.getTime()+item.durationMinutes*60000);
  return `${startText} - ${end.toLocaleTimeString(localeForLanguage(language),{hour:'2-digit',minute:'2-digit'})}`;
}
export function buildCalendarWidgetData(commitments:Commitment[],syncEndDate:Date,now:Date=new Date(),calendarNames?:Map<string,string>,language:Language='it'):CalendarWidgetData{
  const active=commitments.filter(item=>item.status!=='done'&&!item.deletedAt);const sourceColors=buildActivitySourceColors(commitments);const byDate=new Map<string,Commitment[]>();
  // Use the same date range as the in-app Calendar.
  const timelineWeeks=buildCalendarTimeline(commitments,syncEndDate,now).weeks;

  for(const item of active){const value=item.scheduledAt??item.dueAt;if(!value)continue;const d=new Date(value);const key=item.allDay?`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`:dateKey(d);const list=byDate.get(key)??[];list.push(item);byDate.set(key,list);}
  for(const item of commitments.filter(item=>item.status==='done'&&!item.deletedAt)){const end=item.scheduledAt&&item.durationMinutes?new Date(new Date(item.scheduledAt).getTime()+Math.max(1,item.durationMinutes)*60000):null;if(!end||item.durationMinutes<=24*60||!isVisibleCompletedMultiDayForDate(item,end))continue;const key=dateKey(end);const list=byDate.get(key)??[];list.push(item);byDate.set(key,list);}
  for(const [key, list] of byDate) byDate.set(key, sortCommitments(list,calendarNames));
  const weeks:AndroidCalendarWeek[]=timelineWeeks.map((week,w)=>{
    const days:AndroidCalendarDay[]=week.map((day,i)=>{const key=dateKey(day);const items=(byDate.get(key)??[]).map(item=>({id:item.id,title:item.title,time:formatItemTime(item,language),sourceColor:activitySourceColor(item,sourceColors),priority:item.kind==='task'?item.priority:undefined}));return {label:`${widgetStrings(language).dayNames[i]} ${day.getDate()}`,dateKey:key,isToday:key===dateKey(now),items};});
    const monthStart=days.find(day=>day.dateKey.endsWith('-01'));const firstDayMonth=days[0] ? Number(days[0].dateKey.slice(5,7))-1 : week[0].getMonth();const firstDayYear=days[0] ? Number(days[0].dateKey.slice(0,4)) : week[0].getFullYear();const title=monthStart?monthTitle(Number(monthStart.dateKey.slice(5,7))-1,Number(monthStart.dateKey.slice(0,4)),language):w===0?monthTitle(firstDayMonth,firstDayYear,language):'';return {title,days};
  });
  // Keep weeks in chronological order. The Android collection is positioned
  // natively at the week containing today, so scrolling up always means past
  // weeks and scrolling down always means future weeks.
  const currentIndex=weeks.findIndex(week=>week.days.some(day=>day.isToday));
  if(currentIndex>=0&&!weeks[currentIndex].title){
    weeks[currentIndex]={...weeks[currentIndex],title:monthTitle(now.getMonth(),now.getFullYear(),language)};
  }
  return {weeks};
}