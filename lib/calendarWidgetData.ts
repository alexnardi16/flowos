import type { Commitment } from '../types';
import type { AndroidCalendarDay, AndroidCalendarWeek } from '../widgets/android/CalendarWidget';
import { sortCommitments } from './activityOrdering';
import { activitySourceColor, buildActivitySourceColors } from './activityColors';
import type { Language } from './i18n';
import { localeForLanguage, widgetStrings } from './i18n';
import { activityDayDates, isMultiDayActivity } from './commitmentVisibility';
import { buildCalendarTimeline } from './calendarTimeline';
import { formatDurationLabel } from './itemTiming';

export type CalendarWidgetData = { weeks: AndroidCalendarWeek[] };
const MONTHS=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
function dateKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function monthTitle(month:number,year:number,language?:Language){const name=(language?widgetStrings(language).months:MONTHS)[month]??'';return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;}
function multiDaySegment(item:Commitment,day:Date):'start'|'middle'|'end'|undefined{
  if(!isMultiDayActivity(item))return undefined;
  const keyFor=(value:Date)=>item.allDay?`${value.getUTCFullYear()}-${String(value.getUTCMonth()+1).padStart(2,'0')}-${String(value.getUTCDate()).padStart(2,'0')}`:dateKey(value);
  const dates=activityDayDates(item);const current=keyFor(day);const first=keyFor(dates[0]);const last=keyFor(dates[dates.length-1]);
  return current===first?'start':current===last?'end':'middle';
}
function formatItemTime(item:Commitment,language:Language='it'){
  if(item.allDay)return '';
  const startValue=item.scheduledAt??item.dueAt;
  if(!startValue)return '';
  const start=new Date(startValue);
  const startText=start.toLocaleTimeString(localeForLanguage(language),{hour:'2-digit',minute:'2-digit'});
  if(!item.durationMinutes)return startText;
  const end=new Date(start.getTime()+item.durationMinutes*60000);
  return `${startText} - ${end.toLocaleTimeString(localeForLanguage(language),{hour:'2-digit',minute:'2-digit'})}`;
}
export function buildCalendarWidgetData(commitments:Commitment[],syncEndDate:Date,now:Date=new Date(),calendarNames?:Map<string,string>,language:Language='it',showCompletedEvents=true,showCompletedTasks=false):CalendarWidgetData{
  const strings=widgetStrings(language);
  const sourceColors=buildActivitySourceColors(commitments);
  const byDate=new Map<string,Commitment[]>();
  const append=(key:string,item:Commitment)=>{
    const list=byDate.get(key);
    if(list)list.push(item);
    else byDate.set(key,[item]);
  };

  // Keep the same full navigable range as the in-app Calendar.
  const minimumEndDate=new Date(now.getTime()+55*24*60*60*1000);
  const requestedEndTime=Number.isFinite(syncEndDate.getTime())?syncEndDate.getTime():now.getTime();
  const effectiveEndDate=new Date(Math.max(requestedEndTime,minimumEndDate.getTime()));
  const timelineWeeks=buildCalendarTimeline(commitments,effectiveEndDate,now).weeks;

  // Completed events and tasks have independent visibility settings.
  for(const item of commitments){
    if(item.deletedAt)continue;
    if(item.kind==='event'&&item.status==='done'&&!showCompletedEvents)continue;
    if(item.kind==='task'&&item.status==='done'&&!showCompletedTasks)continue;
    const value=item.scheduledAt??item.dueAt;
    if(!value)continue;
    const start=new Date(value);
    if(!Number.isFinite(start.getTime()))continue;
    const dates=isMultiDayActivity(item)?activityDayDates(item):[start];
    for(const date of dates){
      const key=item.allDay
        ? `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`
        : dateKey(date);
      append(key,item);
    }
  }

  for(const [key,list] of byDate){const ordered=sortCommitments(list,calendarNames);ordered.sort((a,b)=>Number(b.kind==='event'&&isMultiDayActivity(b))-Number(a.kind==='event'&&isMultiDayActivity(a)));byDate.set(key,ordered);}

  const todayKey=dateKey(now);
  const weeks:AndroidCalendarWeek[]=timelineWeeks.map((week,w)=>{
    const days:AndroidCalendarDay[]=week.map((day,i)=>{
      const key=dateKey(day);
      const items=(byDate.get(key)??[]).map(item=>({
        id:item.id,
        title:item.title,
        kind:item.kind==='event'?strings.event:strings.task,
        time:formatItemTime(item,language),
        duration:item.kind==='task'&&!item.allDay?`${({it:'Durata',en:'Duration',fr:'Durée',es:'Duración'} as const)[language]}: ${formatDurationLabel(item)}`:undefined,
        sourceColor:activitySourceColor(item,sourceColors),
        priority:item.kind==='task'?item.priority:undefined,
        multiDaySegment:multiDaySegment(item,day)
      }));
      return {label:`${strings.dayNames[i]} ${day.getDate()}`,dateKey:key,isToday:key===todayKey,items};
    });
    const monthStart=days.find(day=>day.dateKey.endsWith('-01'));
    const firstDayMonth=days[0]?Number(days[0].dateKey.slice(5,7))-1:week[0].getMonth();
    const firstDayYear=days[0]?Number(days[0].dateKey.slice(0,4)):week[0].getFullYear();
    const title=monthStart
      ? monthTitle(Number(monthStart.dateKey.slice(5,7))-1,Number(monthStart.dateKey.slice(0,4)),language)
      : w===0?monthTitle(firstDayMonth,firstDayYear,language):'';
    return {title,days};
  });

  // Keep weeks chronological so native scrolling maps past to up and future to down.
  const currentIndex=weeks.findIndex(week=>week.days.some(day=>day.isToday));
  if(currentIndex>=0&&!weeks[currentIndex].title){
    weeks[currentIndex]={...weeks[currentIndex],title:monthTitle(now.getMonth(),now.getFullYear(),language)};
  }
  return {weeks};
}
