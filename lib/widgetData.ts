import type { Commitment } from '../types';
import { isSameCalendarDay, formatCommitmentTime } from './allDayDate';
import { isExpired } from './itemTiming';
import { toDateKey } from './dailySummary';

export type WidgetItem = { id: string; title: string; time: string; kind: Commitment['kind'] };
export type TodayGlance = { dateKey: string; items: WidgetItem[]; nextEventTitle: string | null; nextEventTime: string | null; dueSoonCount: number; overdueCount: number; generatedAt: string };

function isActive(item: Commitment): boolean { return item.status !== 'done' && !item.deletedAt; }
function itemIsToday(item: Commitment, now: Date) { const value=item.scheduledAt??item.dueAt; return Boolean(value&&isSameCalendarDay(item,value,now)); }

export function buildTodayGlance(commitments: Commitment[], now: Date = new Date()): TodayGlance {
  const active=commitments.filter(isActive);
  const todayItems=active.filter(item=>itemIsToday(item,now)).sort((a,b)=>{const av=a.scheduledAt??a.dueAt,bv=b.scheduledAt??b.dueAt;if(!av)return 1;if(!bv)return -1;return new Date(av).getTime()-new Date(bv).getTime();});
  const nextEvent=active.filter(item=>item.kind==='event'&&item.scheduledAt&&new Date(item.scheduledAt).getTime()>=now.getTime()).sort((a,b)=>new Date(a.scheduledAt as string).getTime()-new Date(b.scheduledAt as string).getTime())[0];
  const dueTasks=active.filter(item=>item.kind==='task'&&item.dueAt);
  const dueSoonCount=dueTasks.filter(item=>{const diffHours=(new Date(item.dueAt as string).getTime()-now.getTime())/3600000;return diffHours>0&&diffHours<=24;}).length;
  const overdueCount=active.filter(item=>isExpired(item,now)).length;
  return {dateKey:toDateKey(now),items:todayItems.map(item=>({id:item.id,title:item.title,time:formatCommitmentTime(item,(item.scheduledAt??item.dueAt)!),kind:item.kind})),nextEventTitle:nextEvent?nextEvent.title:null,nextEventTime:nextEvent?.scheduledAt?formatCommitmentTime(nextEvent,nextEvent.scheduledAt):null,dueSoonCount,overdueCount,generatedAt:now.toISOString()};
}
