import type { Commitment } from '../types';

export const ACTIVITY_SOURCE_COLORS = ['#E8F0FF','#E9F8EF','#FFF0D9','#F3E9FF','#FFE8EE','#E7F6F5','#F1F1E8','#EDEAFF'] as const;

export function activitySourceKey(item: Commitment){
  if(item.kind==='task'&&item.googleTaskListId)return `task:${item.googleTaskListId}`;
  if(item.googleCalendarId)return `calendar:${item.googleCalendarId}`;
  return 'flowos';
}

export function buildActivitySourceColors(commitments: Commitment[]){
  const map=new Map<string,string>();
  let next=0;
  for(const item of commitments.filter(item=>!item.deletedAt&&item.status!=='done')){
    const key=activitySourceKey(item);
    if(key==='flowos'||map.has(key))continue;
    map.set(key,ACTIVITY_SOURCE_COLORS[next%ACTIVITY_SOURCE_COLORS.length]);
    next+=1;
  }
  return map;
}

export function activitySourceColor(item: Commitment, sourceColors: Map<string,string>){
  return activitySourceColorsForKey(activitySourceKey(item),sourceColors);
}

export function activitySourceColorsForKey(key:string, sourceColors:Map<string,string>){
  if(key==='flowos')return '#F3F4F7';
  return sourceColors.get(key)??ACTIVITY_SOURCE_COLORS[0];
}
