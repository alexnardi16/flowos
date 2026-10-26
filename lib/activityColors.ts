import type { Commitment } from '../types';

export const ACTIVITY_SOURCE_COLORS = ['#E8F0FF','#E9F8EF','#FFF0D9','#F3E9FF','#FFE8EE','#E7F6F5','#F1F1E8','#EDEAFF'] as const;

export function activitySourceKey(item: Commitment){
  if(item.kind==='task'&&item.googleTaskListId)return `task:${item.googleTaskListId}`;
  if(item.googleCalendarId)return `calendar:${item.googleCalendarId}`;
  return 'flowos';
}

function stableColorIndex(key:string){
  // Derive each source color from its stable identifier, never from array order.
  // Adding or removing another event/task therefore cannot recolor existing sources.
  let hash=2166136261;
  for(let index=0;index<key.length;index+=1){
    hash^=key.charCodeAt(index);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0)%ACTIVITY_SOURCE_COLORS.length;
}

export function buildActivitySourceColors(commitments: Commitment[]){
  const map=new Map<string,string>();
  for(const item of commitments.filter(item=>!item.deletedAt)){
    const key=activitySourceKey(item);
    if(key==='flowos'||map.has(key))continue;
    map.set(key,ACTIVITY_SOURCE_COLORS[stableColorIndex(key)]);
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
