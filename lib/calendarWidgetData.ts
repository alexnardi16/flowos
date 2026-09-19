import type { Commitment } from '../types';
import type { AndroidCalendarDay, AndroidCalendarWeek } from '../widgets/android/CalendarWidget';

export type CalendarWidgetData = { weeks: AndroidCalendarWeek[] };

const MONTHS=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const DAY_NAMES=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

function dateKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function kindLabel(kind:Commitment['kind']){return kind==='event'?'Evento':kind==='task'?'Task':'Reminder';}
function monthTitle(month:number,year:number){const name=MONTHS[month]??'';return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;}

export function buildCalendarWidgetData(commitments:Commitment[],syncEndDate:Date,now:Date=new Date()):CalendarWidgetData{
  const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
  const active=commitments.filter(item=>item.status!=='done'&&!item.deletedAt);
  const byDate=new Map<string,Commitment[]>();
  for(const item of active){
    const value=item.scheduledAt??item.dueAt;if(!value)continue;
    const d=new Date(value);
    const key=item.allDay?`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`:dateKey(d);
    const list=byDate.get(key)??[];list.push(item);byDate.set(key,list);
  }
  for(const list of byDate.values())list.sort((a,b)=>new Date(a.scheduledAt??a.dueAt!).getTime()-new Date(b.scheduledAt??b.dueAt!).getTime());

  const weeks:AndroidCalendarWeek[]=[];
  for(let w=0;;w++){
    const start=new Date(monday);start.setDate(monday.getDate()+w*7);
    if(start.getTime()>syncEndDate.getTime())break;
    const days:AndroidCalendarDay[]=[];
    for(let i=0;i<7;i++){
      const day=new Date(start);day.setDate(start.getDate()+i);const key=dateKey(day);
      const items=(byDate.get(key)??[]).map(item=>({
        id:item.id,title:item.title,
        time:item.allDay?'':new Date(item.scheduledAt??item.dueAt!).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}),
        kind:kindLabel(item.kind),
      }));
      days.push({label:`${DAY_NAMES[i]} ${day.getDate()}`,dateKey:key,isToday:key===dateKey(now),items});
    }
    const monthStart=days.find(day=>day.dateKey.endsWith('-01'));
    const title=w===0?monthTitle(start.getMonth(),start.getFullYear()):monthStart?monthTitle(Number(monthStart.dateKey.slice(5,7))-1,Number(monthStart.dateKey.slice(0,4))):'';
    weeks.push({title,days});
  }
  return {weeks};
}
