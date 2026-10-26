import type { Commitment } from '../types';
import type { AndroidCalendarDay, AndroidCalendarWeek } from '../widgets/android/CalendarWidget';
import { sortCommitments } from './activityOrdering';
import { activitySourceColor, buildActivitySourceColors } from './activityColors';
import type { Language } from './i18n';
import { localeForLanguage, widgetStrings } from './i18n';
import { isVisibleCompletedMultiDayForDate } from './commitmentVisibility';

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
  // Keep the complete useful timeline without a fixed number-of-weeks cap.
  // Android's ListWidget renders collection rows lazily while scrolling; generate
  // weeks only between the start of the current year / oldest dated commitment
  // and the later of the configured sync horizon / latest dated commitment.
  const datedValues=commitments.filter(item=>!item.deletedAt).flatMap(item=>{
    const start=item.scheduledAt??item.dueAt;
    if(!start)return [];
    const values=[new Date(start).getTime()];
    if(item.scheduledAt&&item.durationMinutes>0)values.push(new Date(start).getTime()+item.durationMinutes*60000);
    return values.filter(Number.isFinite);
  });
  const yearStart=new Date(now.getFullYear(),0,1);
  const earliest=new Date(Math.min(yearStart.getTime(),...(datedValues.length?datedValues:[yearStart.getTime()])));
  const monday=new Date(earliest.getFullYear(),earliest.getMonth(),earliest.getDate());
  monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
  const latestCommitmentDate=datedValues.length?Math.max(...datedValues):now.getTime();
  const timelineEnd=new Date(Math.max(syncEndDate.getTime(),latestCommitmentDate));

  for(const item of active){const value=item.scheduledAt??item.dueAt;if(!value)continue;const d=new Date(value);const key=item.allDay?`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`:dateKey(d);const list=byDate.get(key)??[];list.push(item);byDate.set(key,list);}
  for(const item of commitments.filter(item=>item.status==='done'&&!item.deletedAt)){const end=item.scheduledAt&&item.durationMinutes?new Date(new Date(item.scheduledAt).getTime()+Math.max(1,item.durationMinutes)*60000):null;if(!end||item.durationMinutes<=24*60||!isVisibleCompletedMultiDayForDate(item,end))continue;const key=dateKey(end);const list=byDate.get(key)??[];list.push(item);byDate.set(key,list);}
  for(const [key, list] of byDate) byDate.set(key, sortCommitments(list,calendarNames));
  const weeks:AndroidCalendarWeek[]=[];
  for(let w=0;;w++){const start=new Date(monday);start.setDate(monday.getDate()+w*7);if(start.getTime()>timelineEnd.getTime())break;const days:AndroidCalendarDay[]=[];
    for(let i=0;i<7;i++){const day=new Date(start);day.setDate(start.getDate()+i);const key=dateKey(day);const items=(byDate.get(key)??[]).map(item=>({id:item.id,title:item.title,time:formatItemTime(item,language),sourceColor:activitySourceColor(item,sourceColors),priority:item.kind==='task'?item.priority:undefined}));days.push({label:`${widgetStrings(language).dayNames[i]} ${day.getDate()}`,dateKey:key,isToday:key===dateKey(now),items});}
    const monthStart=days.find(day=>day.dateKey.endsWith('-01'));const firstDayMonth=days[0] ? Number(days[0].dateKey.slice(5,7))-1 : start.getMonth();const firstDayYear=days[0] ? Number(days[0].dateKey.slice(0,4)) : start.getFullYear();const title=monthStart?monthTitle(Number(monthStart.dateKey.slice(5,7))-1,Number(monthStart.dateKey.slice(0,4)),language):w===0?monthTitle(firstDayMonth,firstDayYear,language):'';weeks.push({title,days});
  }
  // Keep weeks in chronological order. The Android collection is positioned
  // natively at the week containing today, so scrolling up always means past
  // weeks and scrolling down always means future weeks.
  const currentIndex=weeks.findIndex(week=>week.days.some(day=>day.isToday));
  if(currentIndex>=0&&!weeks[currentIndex].title){
    weeks[currentIndex]={...weeks[currentIndex],title:monthTitle(now.getMonth(),now.getFullYear(),language)};
  }
  return {weeks};
}