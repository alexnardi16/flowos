import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Commitment } from '@/types';
import { deleteCommitmentAlsoFromGoogle, deleteRecurringSeries, flushOfflineQueue, loadCommitmentById, loadCommitments, pushPendingToGoogle, removeCommitmentOnlyFromFlowOS, saveCommitment } from './commitmentsRepository';
import { getPendingCommitmentIds, readQueue, replaceQueue } from './offlineQueue';
import { mergeRemoteCommitments, removeCommitmentState, upsertCommitmentState } from './commitmentState';
import { logNotificationEvent } from './notificationLog';
import { materializeNextOccurrence } from './recurrence';
import { createAutomaticPlan } from './scheduler';
import { showSnackbar } from './snackbar';
import { syncTodayWidget } from './widgetSync';
import { syncGoogleWorkspace, waitForGoogleSyncIdle } from './googleWorkspace';
import { autoCompleteExpiredEvents } from './autoCompleteEvents';
import { rolloverIncompleteTasks } from './taskRollover';
import { normalizeTaskPriorities, reorderTaskPriorities } from './taskPriority';
import { isSupabaseConfigured } from './supabase';
import { createUuid, isValidUuid } from './uuid';
import { t } from './i18n';
import { activityDayDates, activityOccursOnDate, isMultiDayActivity } from './commitmentVisibility';

function refreshWidget(commitments:Commitment[]){void syncTodayWidget(commitments).catch(()=>undefined);}
function refreshNotifications(commitments:Commitment[]){if(Platform.OS==='web')return;void import('./reminderEngine').then(({runReminderEngine})=>runReminderEngine(commitments)).catch(()=>undefined);}
let taskRolloverInFlight:Promise<void>|null=null;
const googleRetryTimers=new Map<string,ReturnType<typeof setTimeout>>();

type State={commitments:Commitment[];syncing:boolean;addCommitment:(commitment:Commitment)=>Promise<boolean>;hydrateFromCloud:()=>Promise<void>;rolloverTodayTasks:()=>Promise<void>;complete:(id:string,scope?:'occurrence'|'series'|'duration')=>Promise<void>;uncomplete:(id:string)=>Promise<void>;stopRecurrenceSeries:(id:string)=>Promise<void>;postpone:(id:string)=>Promise<void>;updateCommitment:(commitment:Commitment)=>Promise<void>;removeOnlyFromFlowOS:(id:string)=>Promise<void>;removeAlsoFromGoogle:(id:string)=>Promise<void>;removeSeriesFromGoogle:(id:string)=>Promise<void>;syncItemToGoogleNow:(id:string)=>Promise<void>;syncWithGoogle:()=>Promise<void>;autoCompleteExpiredEvents:()=>Promise<void>;autoPlan:()=>Promise<void>;};

export const useFlowStore=create<State>()(persist((set,get)=>{
  const pushGoogleAndRefresh=async(protectedId?:string):Promise<boolean>=>{
    if(!isSupabaseConfigured)return false;
    try{
      await flushOfflineQueue();
      await pushPendingToGoogle(protectedId);
      const pendingIds=new Set(await getPendingCommitmentIds());
      if(protectedId){
        const remoteItem=await loadCommitmentById(protectedId);
        const local=get().commitments;
        const localItem=local.find(item=>item.id===protectedId);
        const googleSynced=Boolean(remoteItem?.externalId&&remoteItem.syncStatus==='synced');
        const merged=remoteItem&&!pendingIds.has(protectedId)
          ?upsertCommitmentState(local,remoteItem)
          :local;
        set({commitments:merged});
        refreshWidget(merged);
        refreshNotifications(merged);
        if(!googleSynced&&localItem){
          void logNotificationEvent('store-google-sync-not-confirmed',{id:protectedId,title:localItem.title,remoteStatus:remoteItem?.syncStatus??null,remoteExternalId:remoteItem?.externalId??null,remoteSyncError:remoteItem?.syncError??null},'warn');
          return false;
        }
        return googleSynced;
      }
      const remote=await loadCommitments();
      const merged=mergeRemoteCommitments(remote,get().commitments,pendingIds);
      set({commitments:merged});
      refreshWidget(merged);
      refreshNotifications(merged);
      return true;
    }catch(error){
      const pendingIds=new Set(await getPendingCommitmentIds());
      if(protectedId)pendingIds.add(protectedId);
      const preserved=mergeRemoteCommitments([],get().commitments,pendingIds);
      set({commitments:preserved});
      refreshWidget(preserved);
      refreshNotifications(preserved);
      void logNotificationEvent('auto-push-failed',error,'warn');
      return false;
    }
  };

  let backgroundGooglePush:Promise<void>|null=null;
  let backgroundGooglePushAll=false;
  const backgroundGooglePushIds=new Set<string>();
  const backgroundGoogleRetryAttempts=new Map<string,number>();
  const scheduleGooglePush=(id?:string)=>{
    if(id)backgroundGooglePushIds.add(id);
    else backgroundGooglePushAll=true;
    if(backgroundGooglePush)return;
    backgroundGooglePush=(async()=>{
      while(backgroundGooglePushAll||backgroundGooglePushIds.size){
        const pushAll=backgroundGooglePushAll;
        const ids=Array.from(backgroundGooglePushIds);
        backgroundGooglePushAll=false;
        backgroundGooglePushIds.clear();
        const key=pushAll||ids.length!==1?'*':ids[0];
        await waitForGoogleSyncIdle();
        const succeeded=await pushGoogleAndRefresh(pushAll||ids.length!==1?undefined:ids[0]);
        if(succeeded){
          backgroundGoogleRetryAttempts.delete(key);
          const timer=googleRetryTimers.get(key);
          if(timer)clearTimeout(timer);
          googleRetryTimers.delete(key);
        }else{
          const attempt=(backgroundGoogleRetryAttempts.get(key)??0)+1;
          backgroundGoogleRetryAttempts.set(key,attempt);
          if(attempt<=4&&!googleRetryTimers.has(key)){
            const delay=Math.min(300000,15000*Math.pow(2,attempt-1));
            const timer=setTimeout(()=>{
              googleRetryTimers.delete(key);
              if(key==='*')scheduleGooglePush();
              else scheduleGooglePush(key);
            },delay);
            googleRetryTimers.set(key,timer);
          }else if(attempt>4){
            void logNotificationEvent('store-google-sync-retry-deferred-to-background',{key,attempt},'warn');
          }
        }
      }
    })().catch(error=>{
      void logNotificationEvent('store-background-google-push-failed',error,'warn');
    }).finally(()=>{
      backgroundGooglePush=null;
      if(backgroundGooglePushAll||backgroundGooglePushIds.size)scheduleGooglePush();
    });
  };
  const repairInvalidCommitmentIds=async():Promise<string[]>=>{
    const current=get().commitments;
    const queue=await readQueue();
    const replacements=new Map<string,string>();
    const ensureReplacement=(rawId:string)=>{
      if(!isValidUuid(rawId)&&!replacements.has(rawId))replacements.set(rawId,createUuid());
    };
    current.forEach(item=>ensureReplacement(item.id));
    queue.filter(mutation=>mutation.table==='commitments').forEach(mutation=>ensureReplacement(String(mutation.payload.id??mutation.id)));
    if(!replacements.size)return [];

    const migrated=current.map(item=>{const id=replacements.get(item.id);return id?{...item,id}:item;});
    const migratedQueue=queue.map(mutation=>{
      if(mutation.table!=='commitments')return mutation;
      const oldId=String(mutation.payload.id??mutation.id);
      const id=replacements.get(oldId);
      return id?{...mutation,payload:{...mutation.payload,id}}:mutation;
    });
    await replaceQueue(migratedQueue);
    set({commitments:migrated});
    refreshWidget(migrated);
    refreshNotifications(migrated);

    const localRepairs=current.filter(item=>replacements.has(item.id)).map(item=>migrated.find(candidate=>candidate.id===replacements.get(item.id))!).filter(Boolean);
    for(const item of localRepairs)await saveCommitment(item);
    const idsToPush=new Set<string>(localRepairs.map(item=>item.id));
    for(const mutation of migratedQueue){
      if(mutation.table==='commitments'&&mutation.action==='upsert'){
        const id=String(mutation.payload.id??'');
        if(isValidUuid(id)&&Array.from(replacements.values()).includes(id))idsToPush.add(id);
      }
    }
    await logNotificationEvent('commitment-invalid-id-repair-completed',{localItemsRepaired:localRepairs.length,queuedMutationsRepaired:migratedQueue.filter((mutation,index)=>mutation!==queue[index]).length,idsReadyToPush:idsToPush.size},'warn');
    return [...idsToPush];
  };

  return ({
  commitments:[],syncing:false,
  addCommitment:async commitment=>{
    try{
      const normalized=commitment.kind==='task'&&commitment.status!=='done'?{...commitment,priority:commitment.priority}:commitment;
      const current=get().commitments;
      const base=upsertCommitmentState(current,normalized);
      const next=normalized.kind==='task'&&normalized.status!=='done'&&normalized.priority
        ?reorderTaskPriorities(base,normalized.id,normalized.priority)
        :base;
      set({commitments:next});
      refreshWidget(next);
      refreshNotifications(next);
      const toSave=next.filter(changed=>{
        const before=current.find(item=>item.id===changed.id);
        return !before||before.priority!==changed.priority||changed.id===normalized.id;
      });
      const results=await Promise.all(toSave.map(saveCommitment));
      const persisted=results.every(Boolean);
      scheduleGooglePush(normalized.id);
      if(!persisted)void logNotificationEvent('store-add-commitment-persistence-pending',{id:normalized.id},'warn');
      return persisted;
    }catch(error){
      void logNotificationEvent('store-add-commitment-failed',{id:commitment.id,error},'error');
      throw error;
    }
  },
  rolloverTodayTasks:async()=>{
    if(taskRolloverInFlight)return taskRolloverInFlight;
    taskRolloverInFlight=(async()=>{
      const current=get().commitments;
      const result=rolloverIncompleteTasks(current,new Date());
      if(!result.changed.length)return;
      const normalized=normalizeTaskPriorities(result.commitments);
      set({commitments:normalized});
      refreshWidget(normalized);
      refreshNotifications(normalized);
      const changedIds=new Set(result.changed.map(item=>item.id));
      const toSave=normalized.filter(item=>{
        const before=current.find(candidate=>candidate.id===item.id);
        return !before||before.priority!==item.priority||changedIds.has(item.id);
      });
      await Promise.all(toSave.map(saveCommitment));
      scheduleGooglePush();
    })().finally(()=>{taskRolloverInFlight=null;});
    return taskRolloverInFlight;
  },
  hydrateFromCloud:async()=>{if(!isSupabaseConfigured)return;set({syncing:true});try{const repairedIds=await repairInvalidCommitmentIds();await flushOfflineQueue();for(const id of repairedIds){try{await pushPendingToGoogle(id);}catch(error){await logNotificationEvent('commitment-invalid-id-repair-push-failed',{id,error:error instanceof Error?{name:error.name,message:error.message}:String(error)},'warn');}}const pendingIds=await getPendingCommitmentIds();const remote=await loadCommitments();const merged=mergeRemoteCommitments(remote,get().commitments,pendingIds);set({commitments:merged});refreshWidget(merged);refreshNotifications(merged);}finally{set({syncing:false});}},
  complete:async (id,scope='occurrence')=>{
    const current=get().commitments;
    const item=current.find(candidate=>candidate.id===id);
    if(!item||item.status==='done')return;
    if(scope==='duration'&&isMultiDayActivity(item)){
      const completedDates=activityDayDates(item).map(date=>String(date.getFullYear())+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0'));
      const updated={...item,dailyCompletedDates:Array.from(new Set([...(item.dailyCompletedDates??[]),...completedDates]))};
      const values=current.map(candidate=>candidate.id===id?updated:candidate);
      set({commitments:values});refreshWidget(values);
      await saveCommitment(updated);
      showSnackbar(t('Attività completata'),t('Annulla'),()=>{
        void(async()=>{
          const latest=get().commitments.find(candidate=>candidate.id===id);if(!latest)return;
          const restored={...latest,dailyCompletedDates:(latest.dailyCompletedDates??[]).filter(value=>!completedDates.includes(value))};
          const nextValues=get().commitments.map(candidate=>candidate.id===id?restored:candidate);
          set({commitments:nextValues});await saveCommitment(restored);refreshWidget(nextValues);refreshNotifications(nextValues);
        })();
      });
      return;
    }
    if(scope==='occurrence'&&isMultiDayActivity(item)){
      const now=new Date();
      const dayKey=String(now.getFullYear())+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
      if(activityOccursOnDate(item,now)&&!item.dailyCompletedDates?.includes(dayKey)){
        const updated={...item,dailyCompletedDates:[...(item.dailyCompletedDates??[]),dayKey]};
        const nextCommitments=current.map(candidate=>candidate.id===id?updated:candidate);
        set({commitments:nextCommitments});refreshWidget(nextCommitments);
        await saveCommitment(updated);
        showSnackbar(t('Attività completata'),t('Annulla'),()=>{
          void(async()=>{
            const latest=get().commitments.find(candidate=>candidate.id===id);if(!latest)return;
            const restored={...latest,dailyCompletedDates:(latest.dailyCompletedDates??[]).filter(value=>value!==dayKey)};
            const values=get().commitments.map(candidate=>candidate.id===id?restored:candidate);
            set({commitments:values});await saveCommitment(restored);refreshWidget(values);refreshNotifications(values);
          })();
        });
        return;
      }
    }
    const completedAt=new Date().toISOString();
    const makeDone=(candidate:Commitment):Commitment=>({...candidate,status:'done',completedAt,syncStatus:candidate.externalId&&candidate.kind==='task'?'pending':candidate.syncStatus,...(scope==='series'?{recurrenceRule:undefined}:{})});
    let changedItems:Commitment[];
    let next:Commitment|null=null;
    if(scope==='series'){
      const seriesId=item.recurrenceSeriesId??item.id;
      changedItems=current.filter(candidate=>candidate.id===item.id||candidate.id===seriesId||candidate.recurrenceSeriesId===seriesId||Boolean(item.googleRecurringEventId&&candidate.googleRecurringEventId===item.googleRecurringEventId)).filter(candidate=>candidate.status!=='done').map(makeDone);
    }else{
      const updated=makeDone(item);
      changedItems=[updated];
      if(scope!=='duration')next=materializeNextOccurrence(updated,current);
    }
    const changedById=new Map(changedItems.map(candidate=>[candidate.id,candidate]));
    const raw=current.map(candidate=>changedById.get(candidate.id)??candidate);
    if(next)raw.unshift(next);
    const nextCommitments=normalizeTaskPriorities(raw);
    set({commitments:nextCommitments});
    refreshWidget(nextCommitments);
    const changedIds=new Set(changedItems.map(candidate=>candidate.id));
    const toSave=nextCommitments.filter(candidate=>{
      const before=current.find(entry=>entry.id===candidate.id);
      return changedIds.has(candidate.id)||candidate.id===next?.id||before?.priority!==candidate.priority;
    });
    await Promise.all(toSave.map(saveCommitment));
    scheduleGooglePush();
    showSnackbar(t('Attività completata'),t('Annulla'),()=>{
      void(async()=>{
        const restoreIds=new Set(changedItems.map(candidate=>candidate.id));
        const restored=get().commitments.filter(candidate=>candidate.id!==next?.id).map(candidate=>{
          const previous=current.find(entry=>entry.id===candidate.id);
          return restoreIds.has(candidate.id)&&previous?previous:candidate;
        });
        set({commitments:restored});
        await Promise.all(current.filter(candidate=>restoreIds.has(candidate.id)).map(saveCommitment));
        if(next)await removeCommitmentOnlyFromFlowOS(next.id);
        scheduleGooglePush();
        refreshWidget(restored);refreshNotifications(restored);
      })();
    });
  },
  uncomplete:async id=>{
    const current=get().commitments;
    const item=current.find(candidate=>candidate.id===id);
    if(!item||item.status!=='done')return;
    const reopened:Commitment={...item,status:item.kind==='event'?'scheduled':'active',completedAt:undefined,resolutionPending:false,reminderDismissedAt:undefined,syncStatus:item.externalId&&item.kind==='task'?'pending':item.syncStatus};
    const nextCommitments=normalizeTaskPriorities(current.map(candidate=>candidate.id===id?reopened:candidate));
    set({commitments:nextCommitments});refreshWidget(nextCommitments);
    const toSave=nextCommitments.filter(candidate=>{
      const previous=current.find(item=>item.id===candidate.id);
      return !previous||previous.status!==candidate.status||previous.priority!==candidate.priority||candidate.id===id;
    });
    await Promise.all(toSave.map(saveCommitment));
    scheduleGooglePush(id);
    refreshNotifications(nextCommitments);
  },
  stopRecurrenceSeries:async id=>{
    const current=get().commitments;
    const item=current.find(candidate=>candidate.id===id);
    if(!item)return;
    const seriesId=item.recurrenceSeriesId??item.id;
    const nextCommitments=current.map(candidate=>candidate.id===id||candidate.id===seriesId||candidate.recurrenceSeriesId===seriesId
      ?{...candidate,recurrenceRule:undefined,recurrenceSeriesId:undefined,recurrenceSeriesEndAt:undefined}
      :candidate);
    set({commitments:nextCommitments});refreshWidget(nextCommitments);
    const toSave=nextCommitments.filter(candidate=>{
      const previous=current.find(entry=>entry.id===candidate.id);
      return Boolean(previous&&(previous.recurrenceRule||previous.recurrenceSeriesId||previous.recurrenceSeriesEndAt)&&(candidate.id===id||candidate.id===seriesId||previous.recurrenceSeriesId===seriesId));
    });
    await Promise.all(toSave.map(saveCommitment));
    scheduleGooglePush();
    refreshNotifications(nextCommitments);
  },
  postpone:async id=>{
    const current=get().commitments;
    const item=current.find(candidate=>candidate.id===id);
    if(!item)return;
    const base=item.scheduledAt??item.dueAt??new Date().toISOString();
    const nextDay=new Date(new Date(base).getTime()+86400000).toISOString();
    const updated={...item,status:item.kind==='event'?'scheduled':item.status,scheduledAt:item.scheduledAt?nextDay:undefined,dueAt:item.dueAt?nextDay:undefined} as Commitment;
    const nextCommitments=normalizeTaskPriorities(current.map(candidate=>candidate.id===id?updated:candidate));
    set({commitments:nextCommitments});refreshWidget(nextCommitments);
    const toSave=nextCommitments.filter(candidate=>{
      const before=current.find(entry=>entry.id===candidate.id);
      return !before||before.priority!==candidate.priority||candidate.id===id;
    });
    await Promise.all(toSave.map(saveCommitment));
    scheduleGooglePush(id);
    refreshNotifications(nextCommitments);
    showSnackbar(t('Attività rimandata di 1 giorno'),t('Annulla'),()=>{
      void(async()=>{
        const restored=get().commitments.map(candidate=>candidate.id===id?item:candidate);
        set({commitments:restored});await saveCommitment(item);scheduleGooglePush(id);refreshWidget(restored);refreshNotifications(restored);
      })();
    });
  },
  updateCommitment:async updated=>{
    const current=get().commitments;
    const previous=current.find(item=>item.id===updated.id);
    const base=upsertCommitmentState(current,updated.kind==='task'&&updated.status!=='done'?{...updated,priority:updated.priority}:updated);
    const nextCommitments=updated.kind==='task'&&updated.status!=='done'?reorderTaskPriorities(base,updated.id,updated.priority):normalizeTaskPriorities(base);
    set({commitments:nextCommitments});refreshWidget(nextCommitments);
    const toSave=nextCommitments.filter(candidate=>{
      const before=current.find(item=>item.id===candidate.id);
      return !before||before.priority!==candidate.priority||candidate.id===updated.id;
    });
    await Promise.all(toSave.map(saveCommitment));
    scheduleGooglePush(updated.id);
    refreshNotifications(nextCommitments);
    if(previous)showSnackbar(t('Modifiche salvate'),t('Annulla'),()=>{
      void(async()=>{
        const restored=get().commitments.map(candidate=>candidate.id===updated.id?previous:candidate);
        set({commitments:restored});await saveCommitment(previous);scheduleGooglePush(updated.id);refreshWidget(restored);
      })();
    });
  },
  removeOnlyFromFlowOS:async id=>{const current=get().commitments;const item=current.find(c=>c.id===id);await removeCommitmentOnlyFromFlowOS(id);const next=normalizeTaskPriorities(removeCommitmentState(current,id));set({commitments:next});refreshWidget(next);refreshNotifications(next);for(const changed of next){const before=current.find(c=>c.id===changed.id);if(before?.priority!==changed.priority)await saveCommitment(changed);}if(item)showSnackbar(t('Attività eliminata da FlowOS'),t('Annulla'),()=>{void(async()=>{const restored=[item,...get().commitments];set({commitments:restored});await saveCommitment({...item,deletedAt:undefined});refreshWidget(restored);refreshNotifications(restored);})();});},
  removeAlsoFromGoogle:async id=>{const current=get().commitments;const item=current.find(c=>c.id===id);if(!item)return;await deleteCommitmentAlsoFromGoogle(item);const next=normalizeTaskPriorities(current.filter(c=>c.id!==id));set({commitments:next});refreshWidget(next);refreshNotifications(next);for(const changed of next){const before=current.find(c=>c.id===changed.id);if(before?.priority!==changed.priority)await saveCommitment(changed);}showSnackbar(t('Eliminata da FlowOS e da Google'));},
  removeSeriesFromGoogle:async id=>{const item=get().commitments.find(c=>c.id===id);if(!item)return;await deleteRecurringSeries(item);const seriesId=item.googleRecurringEventId;const next=get().commitments.filter(c=>c.googleRecurringEventId!==seriesId);set({commitments:next});refreshWidget(next);refreshNotifications(next);},
  syncItemToGoogleNow:async id=>{const synced=await pushGoogleAndRefresh(id);if(!synced)throw new Error('L’attività non è stata sincronizzata con Google.');},
  syncWithGoogle:async()=>{await pushGoogleAndRefresh();await syncGoogleWorkspace();await get().hydrateFromCloud();},
  autoCompleteExpiredEvents:async()=>{
    const current=get().commitments;
    const result=await autoCompleteExpiredEvents(current,new Date());
    if(result.completedCount===0)return;
    set({commitments:result.commitments});
    refreshWidget(result.commitments);
    refreshNotifications(result.commitments);
    scheduleGooglePush();
  },
  autoPlan:async()=>{const planned=createAutomaticPlan(get().commitments);set({commitments:planned});await Promise.all(planned.map(item=>saveCommitment(item)));refreshWidget(planned);refreshNotifications(planned);},
});},{name:'flowos-store-v2',storage:createJSONStorage(()=>AsyncStorage),partialize:state=>({commitments:state.commitments})}));
