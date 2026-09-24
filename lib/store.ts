import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Commitment } from '@/types';
import { deleteCommitmentAlsoFromGoogle, deleteRecurringSeries, flushOfflineQueue, loadCommitments, pushPendingToGoogle, removeCommitmentOnlyFromFlowOS, saveCommitment } from './commitmentsRepository';
import { getPendingCommitmentIds } from './offlineQueue';
import { mergeRemoteCommitments, removeCommitmentState, upsertCommitmentState } from './commitmentState';
import { logNotificationEvent } from './notificationLog';
import { materializeNextOccurrence } from './recurrence';
import { createAutomaticPlan } from './scheduler';
import { showSnackbar } from './snackbar';
import { syncTodayWidget } from './widgetSync';
import { syncGoogleWorkspace } from './googleWorkspace';
import { autoCompleteExpiredEvents } from './autoCompleteEvents';
import { rolloverIncompleteTasks } from './taskRollover';
import { normalizeTaskPriorities, reorderTaskPriorities } from './taskPriority';
import { isSupabaseConfigured } from './supabase';

function refreshWidget(commitments:Commitment[]){void syncTodayWidget(commitments).catch(()=>undefined);}
function refreshNotifications(commitments:Commitment[]){if(Platform.OS==='web')return;void import('./reminderEngine').then(({runReminderEngine})=>runReminderEngine(commitments)).catch(()=>undefined);}
let taskRolloverInFlight:Promise<void>|null=null;

type State={commitments:Commitment[];focusId?:string;syncing:boolean;addCommitment:(commitment:Commitment)=>Promise<void>;hydrateFromCloud:()=>Promise<void>;rolloverTodayTasks:()=>Promise<void>;complete:(id:string)=>Promise<void>;postpone:(id:string)=>Promise<void>;updateCommitment:(commitment:Commitment)=>Promise<void>;removeOnlyFromFlowOS:(id:string)=>Promise<void>;removeAlsoFromGoogle:(id:string)=>Promise<void>;removeSeriesFromGoogle:(id:string)=>Promise<void>;syncItemToGoogleNow:()=>Promise<void>;syncWithGoogle:()=>Promise<void>;autoCompleteExpiredEvents:()=>Promise<void>;autoPlan:()=>Promise<void>;startFocus:(id:string)=>void;stopFocus:()=>void;};

export const useFlowStore=create<State>()(persist((set,get)=>{
  const pushGoogleAndRefresh=async()=>{if(!isSupabaseConfigured)return;try{await flushOfflineQueue();await pushPendingToGoogle();const remote=await loadCommitments();const pendingIds=await getPendingCommitmentIds();const merged=mergeRemoteCommitments(remote,get().commitments,pendingIds);set({commitments:merged});refreshWidget(merged);refreshNotifications(merged);}catch(error){const pendingIds=await getPendingCommitmentIds();const preserved=mergeRemoteCommitments([],get().commitments,pendingIds);set({commitments:preserved});refreshWidget(preserved);refreshNotifications(preserved);void logNotificationEvent('auto-push-failed',error,'warn');}};
  return ({
  commitments:[],syncing:false,
  addCommitment:async commitment=>{
    const normalized = commitment.kind === 'task' && commitment.status !== 'done'
      ? { ...commitment, priority: commitment.priority }
      : commitment;
    const current=get().commitments;
    const base=upsertCommitmentState(current,normalized);
    const next=normalized.kind==='task'&&normalized.status!=='done'&&normalized.priority
      ? reorderTaskPriorities(normalizeTaskPriorities(base),normalized.id,normalized.priority)
      : base;
    set({commitments:next});refreshWidget(next);refreshNotifications(next);
    for(const changed of next){
      const before=current.find(c=>c.id===changed.id);
      if(!before||before.priority!==changed.priority||changed.id===normalized.id)await saveCommitment(changed);
    }
    await pushGoogleAndRefresh();
  },
  rolloverTodayTasks:async()=>{if(taskRolloverInFlight)return taskRolloverInFlight;taskRolloverInFlight=(async()=>{const current=get().commitments;const result=rolloverIncompleteTasks(current,new Date());if(!result.changed.length)return;const normalized=normalizeTaskPriorities(result.commitments);set({commitments:normalized});refreshWidget(normalized);refreshNotifications(normalized);for(const changed of normalized){const before=current.find(c=>c.id===changed.id);if(!before||before.priority!==changed.priority||result.changed.some(item=>item.id===changed.id))await saveCommitment(changed);}try{await pushGoogleAndRefresh();}catch(error){void logNotificationEvent('task-rollover-push-failed',error,'warn');}})().finally(()=>{taskRolloverInFlight=null;});return taskRolloverInFlight;},
  hydrateFromCloud:async()=>{if(!isSupabaseConfigured)return;set({syncing:true});try{await flushOfflineQueue();const pendingIds=await getPendingCommitmentIds();const remote=await loadCommitments();const merged=mergeRemoteCommitments(remote,get().commitments,pendingIds);set({commitments:merged});refreshWidget(merged);refreshNotifications(merged);}finally{set({syncing:false});}},
  complete:async id=>{const current=get().commitments;const item=current.find(c=>c.id===id);if(!item)return;const updated={...item,status:'done' as const};const next=materializeNextOccurrence(updated);const rawNext=next?[next,...current.map(c=>c.id===id?updated:c)]:current.map(c=>c.id===id?updated:c);const nextCommitments=normalizeTaskPriorities(rawNext);set({commitments:nextCommitments});refreshWidget(nextCommitments);await saveCommitment(updated);if(next)await saveCommitment(next);for(const changed of nextCommitments.filter(c=>c.kind==='task'&&c.status!=='done')){const previous=current.find(c=>c.id===changed.id);if(previous?.priority!==changed.priority)await saveCommitment(changed);}await pushGoogleAndRefresh();showSnackbar('Attività completata','Annulla',()=>{void(async()=>{const restored=next?get().commitments.filter(c=>c.id!==next.id).map(c=>c.id===id?item:c):get().commitments.map(c=>c.id===id?item:c);set({commitments:restored});await saveCommitment(item);if(next)await removeCommitmentOnlyFromFlowOS(next.id);await pushGoogleAndRefresh();refreshWidget(restored);refreshNotifications(restored);})();});},
  postpone:async id=>{const current=get().commitments;const item=current.find(c=>c.id===id);if(!item)return;const base=item.scheduledAt??item.dueAt??new Date().toISOString();const nextDay=new Date(new Date(base).getTime()+86400000).toISOString();const updated={...item,status:item.kind==='event'?'scheduled':item.status,scheduledAt:item.scheduledAt?nextDay:undefined,dueAt:item.dueAt?nextDay:undefined} as Commitment;const nextCommitments=normalizeTaskPriorities(get().commitments.map(c=>c.id===id?updated:c));set({commitments:nextCommitments});refreshWidget(nextCommitments);for(const changed of nextCommitments){const before=current.find(c=>c.id===changed.id);if(!before||before.priority!==changed.priority||changed.id===id)await saveCommitment(changed);}await pushGoogleAndRefresh();refreshNotifications(get().commitments);showSnackbar('Attività rimandata di 1 giorno','Annulla',()=>{void(async()=>{const restored=get().commitments.map(c=>c.id===id?item:c);set({commitments:restored});await saveCommitment(item);await pushGoogleAndRefresh();refreshWidget(restored);refreshNotifications(restored);})();});},
  updateCommitment:async updated=>{const current=get().commitments;const previous=current.find(item=>item.id===updated.id);const base=upsertCommitmentState(current,updated.kind==='task'&&updated.status!=='done'?{...updated,priority:updated.priority}:updated);const normalizedBase=normalizeTaskPriorities(base);
const nextCommitments=updated.kind==='task'&&updated.status!=='done'?reorderTaskPriorities(normalizedBase,updated.id,updated.priority):normalizedBase;set({commitments:nextCommitments});refreshWidget(nextCommitments);for(const changed of nextCommitments){const before=current.find(c=>c.id===changed.id);if(!before||before.priority!==changed.priority||changed.id===updated.id)await saveCommitment(changed);}await pushGoogleAndRefresh();refreshNotifications(get().commitments);if(previous)showSnackbar('Modifiche salvate','Annulla',()=>{void(async()=>{const restored=get().commitments.map(c=>c.id===updated.id?previous:c);set({commitments:restored});await saveCommitment(previous);await pushGoogleAndRefresh();refreshWidget(restored);})();});},
  removeOnlyFromFlowOS:async id=>{const current=get().commitments;const item=current.find(c=>c.id===id);await removeCommitmentOnlyFromFlowOS(id);const next=normalizeTaskPriorities(removeCommitmentState(current,id));set({commitments:next});refreshWidget(next);refreshNotifications(next);for(const changed of next){const before=current.find(c=>c.id===changed.id);if(before?.priority!==changed.priority)await saveCommitment(changed);}if(item)showSnackbar('Attività eliminata da FlowOS','Annulla',()=>{void(async()=>{const restored=[item,...get().commitments];set({commitments:restored});await saveCommitment({...item,deletedAt:undefined});refreshWidget(restored);refreshNotifications(restored);})();});},
  removeAlsoFromGoogle:async id=>{const current=get().commitments;const item=current.find(c=>c.id===id);if(!item)return;await deleteCommitmentAlsoFromGoogle(item);const next=normalizeTaskPriorities(current.filter(c=>c.id!==id));set({commitments:next});refreshWidget(next);refreshNotifications(next);for(const changed of next){const before=current.find(c=>c.id===changed.id);if(before?.priority!==changed.priority)await saveCommitment(changed);}showSnackbar('Eliminata da FlowOS e da Google');},
  removeSeriesFromGoogle:async id=>{const item=get().commitments.find(c=>c.id===id);if(!item)return;await deleteRecurringSeries(item);const seriesId=item.googleRecurringEventId;const next=get().commitments.filter(c=>c.googleRecurringEventId!==seriesId);set({commitments:next});refreshWidget(next);refreshNotifications(next);},
  syncItemToGoogleNow:async()=>{await pushGoogleAndRefresh();},
  syncWithGoogle:async()=>{await syncGoogleWorkspace();await get().hydrateFromCloud();},
  autoCompleteExpiredEvents:async()=>{
    const current=get().commitments;
    const result=await autoCompleteExpiredEvents(current,new Date());
    if(result.completedCount===0)return;
    set({commitments:result.commitments});
    refreshWidget(result.commitments);
    refreshNotifications(result.commitments);
    await pushGoogleAndRefresh();
  },
  autoPlan:async()=>{const planned=createAutomaticPlan(get().commitments);set({commitments:planned});await Promise.all(planned.map(item=>saveCommitment(item)));refreshWidget(planned);refreshNotifications(planned);},
  startFocus:id=>set({focusId:id}),stopFocus:()=>set({focusId:undefined}),
});},{name:'flowos-store-v2',storage:createJSONStorage(()=>AsyncStorage),partialize:state=>({commitments:state.commitments,focusId:state.focusId})}));
