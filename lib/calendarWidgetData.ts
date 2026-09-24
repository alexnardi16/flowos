import type { Commitment } from '../types';
import type { AndroidCalendarDay, AndroidCalendarWeek } from '../widgets/android/CalendarWidget';
import { sortCommitmentsAlphabetically } from './activityOrdering';

export type CalendarWidgetData = { weeks: AndroidCalendarWeek[] };
const MONTHS=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const DAY_NAMES=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
const SOURCE_COLORS=['#E8F0FF','#E9F8EF','#FFF0D9','#F3E9FF','#FFE8EE','#E7F6F5','#F1F1E8','#EDEAFF'];
function dateKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function monthTitle(month:number,year:number){const name=MONTHS[month]??'';return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;}
function sourceKey(item:Commitment){if(item.kind==='task'&&item.googleTaskListId)return `task:${item.googleTaskListId}`;if(item.googleCalendarId)return `calendar:${item.googleCalendarId}`;return 'flowos';}
function buildSourceColors(commitments:Commitment[]){const map=new Map<string,string>();let next=0;for(const item of commitments){const key=sourceKey(item);if(key==='flowos'||map.has(key))continue;map.set(key,SOURCE_COLORS[next%SOURCE_COLORS.length]);next+=1;}return map;}
function formatItemTime(item:Commitment){
  if(item.allDay)return '';
  const startValue=item.scheduledAt??item.dueAt;
  if(!startValue)return '';
  const start=new Date(startValue);
  const startText=start.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  if(!item.scheduledAt||!item.durationMinutes)return startText;
  const end=new Date(start.getTime()+item.durationMinutes*60000);
  return `${startText} - ${end.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`;
}
export function buildCalendarWidgetData(commitments:Commitment[],syncEndDate:Date,now:Date=new Date()):CalendarWidgetData{
  const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate());monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
  const active=commitments.filter(item=>item.status!=='done'&&!item.deletedAt);const sourceColors=buildSourceColors(active);const byDate=new Map<string,Commitment[]>();
  for(const item of active){const value=item.scheduledAt??item.dueAt;if(!value)continue;const d=new Date(value);const key=item.allDay?`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`:dateKey(d);const list=byDate.get(key)??[];list.push(item);byDate.set(key,list);}
  for(const [key, list] of byDate) byDate.set(key, sortCommitmentsAlphabetically(list));
  const weeks:AndroidCalendarWeek[]=[];
  for(let w=0;;w++){const start=new Date(monday);start.setDate(monday.getDate()+w*7);if(start.getTime()>syncEndDate.getTime())break;const days:AndroidCalendarDay[]=[];
    for(let i=0;i<7;i++){const day=new Date(start);day.setDate(start.getDate()+i);const key=dateKey(day);const items=(byDate.get(key)??[]).map(item=>({id:item.id,title:item.title,time:formatItemTime(item),sourceColor:sourceColors.get(sourceKey(item))??'#F3F4F7',priority:item.kind==='task'?item.priority:undefined}));days.push({label:`${DAY_NAMES[i]} ${day.getDate()}`,dateKey:key,isToday:key===dateKey(now),items});}
    const monthStart=days.find(day=>day.dateKey.endsWith('-01'));const title=w===0?monthTitle(start.getMonth(),start.getFullYear()):monthStart?monthTitle(Number(monthStart.dateKey.slice(5,7))-1,Number(monthStart.dateKey.slice(0,4))):'';weeks.push({title,days});
  } return {weeks};
}