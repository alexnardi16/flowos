import type { Commitment } from '../types';
import { isSameCalendarDay, formatCommitmentTime } from './allDayDate';
import { isExpired } from './itemTiming';
import { toDateKey } from './dailySummary';

export type WidgetItem = { id: string; title: string; time: string; kind: Commitment['kind'] };
export type TodayGlance = { dateKey: string; items: WidgetItem[]; nextEventTitle: string | null; nextEventTime: string | null; dueSoonCount: number; overdueCount: number; generatedAt: string };

function isActive(item: Commitment): boolean { return item.status !== 'done' && !item.deletedAt; }
function itemIsToday(item: Commitment, now: Date) { const value=item.scheduledAt??item.dueAt; return Boolean(value&&isSameCalendarDay(item,value,now)); }

export function buildTodayGlance(commitments: Commitment[], now: Date = new Date()): TodayGlance {
  const nowMs=now.getTime();
  const todayItems:Commitment[]=[];
  let nextEvent:Commitment|undefined;
  let nextEventMs=Number.POSITIVE_INFINITY;
  let dueSoonCount=0;
  let overdueCount=0;

  for(const item of commitments){
    if(!isActive(item))continue;
    const value=item.scheduledAt??item.dueAt;
    if(value&&itemIsToday(item,now))todayItems.push(item);

    if(item.kind==='event'&&item.scheduledAt){
      const eventMs=new Date(item.scheduledAt).getTime();
      if(eventMs>=nowMs&&eventMs<nextEventMs){nextEvent=item;nextEventMs=eventMs;}
    }
    if(item.kind==='task'&&item.dueAt){
      const diffHours=(new Date(item.dueAt).getTime()-nowMs)/3600000;
      if(diffHours>0&&diffHours<=24)dueSoonCount++;
    }
    if(isExpired(item,now))overdueCount++;
  }

  todayItems.sort((a,b)=>{
    const av=a.scheduledAt??a.dueAt,bv=b.scheduledAt??b.dueAt;
    if(!av)return 1;if(!bv)return -1;
    return new Date(av).getTime()-new Date(bv).getTime();
  });

  return {dateKey:toDateKey(now),items:todayItems.map(item=>({id:item.id,title:item.title,time:formatCommitmentTime(item,(item.scheduledAt??item.dueAt)!),kind:item.kind})),nextEventTitle:nextEvent?.title??null,nextEventTime:nextEvent?.scheduledAt?formatCommitmentTime(nextEvent,nextEvent.scheduledAt):null,dueSoonCount,overdueCount,generatedAt:now.toISOString()};
}
