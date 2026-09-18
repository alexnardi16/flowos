import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Commitment } from '@/types';
import { deleteCommitmentAlsoFromGoogle, deleteRecurringSeries, flushOfflineQueue, loadCommitments, pushPendingToGoogle, removeCommitmentOnlyFromFlowOS, saveCommitment } from './commitmentsRepository';
import { logNotificationEvent } from './notificationLog';
import { materializeNextOccurrence } from './recurrence';
import { createAutomaticPlan } from './scheduler';
import { showSnackbar } from './snackbar';
import { syncTodayWidget } from './widgetSync';
import { syncGoogleWorkspace } from './googleWorkspace';

function pushGoogleSafely(){void pushPendingToGoogle().catch(error=>{void logNotificationEvent('auto-push-failed',error,'warn');});}
function refreshWidget(commitments:Commitment[]){void syncTodayWidget(commitments).catch(()=>undefined);}

type State={commitments:Commitment[];focusId?:string;syncing:boolean;addCommitment:(commitment:Commitment)=>Promise<void>;hydrateFromCloud:()=>Promise<void>;complete:(id:string)=>Promise<void>;postpone:(id:string)=>Promise<void>;updateCommitment:(commitment:Commitment)=>Promise<void>;removeOnlyFromFlowOS:(id:string)=>Promise<void>;removeAlsoFromGoogle:(id:string)=>Promise<void>;removeSeriesFromGoogle:(id:string)=>Promise<void>;syncItemToGoogleNow:()=>Promise<void>;syncWithGoogle:()=>Promise<void>;autoPlan:()=>Promise<void>;startFocus:(id:string)=>void;stopFocus:()=>void;};

export const useFlowStore=create<State>()(persist((set,get)=>({
  commitments:[],syncing:false,
  addCommitment:async commitment=>{set(state=>({commitments:[commitment,...state.commitments]}));refreshWidget(get().commitments);await saveCommitment(commitment);},
  hydrateFromCloud:async()=>{set({syncing:true});try{await flushOfflineQueue();const remote=await loadCommitments();set({commitments:remote});refreshWidget(remote);}finally{set({syncing:false});}},
  complete:async id=>{const item=get().commitments.find(c=>c.id===id);if(!item)return;const updated={...item,status:'done' as const};const next=materializeNextOccurrence(updated);const nextCommitments=next?[next,...get().commitments.map(c=>c.id===id?updated:c)]:get().commitments.map(c=>c.id===id?updated:c);set({commitments:nextCommitments});refreshWidget(nextCommitments);await saveCommitment(updated);if(next)await saveCommitment(next);pushGoogleSafely();showSnackbar('Attività completata','Annulla',()=>{void(async()=>{const restored=next?get().commitments.filter(c=>c.id!==next.id).map(c=>c.id===id?item:c):get().commitments.map(c=>c.id===id?item:c);set({commitments:restored});await saveCommitment(item);if(next)await removeCommitmentOnlyFromFlowOS(next.id);pushGoogleSafely();refreshWidget(restored);})();});},
  postpone:async id=>{const item=get().commitments.find(c=>c.id===id);if(!item)return;const base=item.scheduledAt??item.dueAt??new Date().toISOString();const nextDay=new Date(new Date(base).getTime()+86400000).toISOString();const updated={...item,status:item.kind==='event'?'scheduled':item.status,scheduledAt:item.scheduledAt?nextDay:undefined,dueAt:item.dueAt?nextDay:undefined} as Commitment;const nextCommitments=get().commitments.map(c=>c.id===id?updated:c);set({commitments:nextCommitments});refreshWidget(nextCommitments);await saveCommitment(updated);pushGoogleSafely();showSnackbar('Attività rimandata di 1 giorno','Annulla',()=>{void(async()=>{const restored=get().commitments.map(c=>c.id===id?item:c);set({commitments:restored});await saveCommitment(item);pushGoogleSafely();refreshWidget(restored);})();});},
  updateCommitment:async updated=>{const previous=get().commitments.find(item=>item.id===updated.id);const nextCommitments=get().commitments.map(item=>item.id===updated.id?updated:item);set({commitments:nextCommitments});await saveCommitment(updated);pushGoogleSafely();refreshWidget(nextCommitments);if(previous)showSnackbar('Modifiche salvate','Annulla',()=>{void(async()=>{const restored=get().commitments.map(c=>c.id===updated.id?previous:c);set({commitments:restored});await saveCommitment(previous);pushGoogleSafely();refreshWidget(restored);})();});},
  removeOnlyFromFlowOS:async id=>{const item=get().commitments.find(c=>c.id===id);await removeCommitmentOnlyFromFlowOS(id);const next=get().commitments.filter(c=>c.id!==id);set({commitments:next});refreshWidget(next);if(item)showSnackbar('Attività eliminata da FlowOS','Annulla',()=>{void(async()=>{const restored=[item,...get().commitments];set({commitments:restored});await saveCommitment({...item,deletedAt:undefined});refreshWidget(restored);})();});},
  removeAlsoFromGoogle:async id=>{const item=get().commitments.find(c=>c.id===id);if(!item)return;await deleteCommitmentAlsoFromGoogle(item);const next=get().commitments.filter(c=>c.id!==id);set({commitments:next});refreshWidget(next);showSnackbar('Eliminata da FlowOS e da Google');},
  removeSeriesFromGoogle:async id=>{const item=get().commitments.find(c=>c.id===id);if(!item)return;await deleteRecurringSeries(item);const seriesId=item.googleRecurringEventId;const next=get().commitments.filter(c=>c.googleRecurringEventId!==seriesId);set({commitments:next});refreshWidget(next);},
  syncItemToGoogleNow:async()=>{await pushPendingToGoogle();refreshWidget(get().commitments);},
  syncWithGoogle:async()=>{await syncGoogleWorkspace();await get().hydrateFromCloud();},
  autoPlan:async()=>{const planned=createAutomaticPlan(get().commitments);set({commitments:planned});await Promise.all(planned.map(item=>saveCommitment(item)));refreshWidget(planned);},
  startFocus:id=>set({focusId:id}),stopFocus:()=>set({focusId:undefined}),
}),{name:'flowos-store-v2',storage:createJSONStorage(()=>AsyncStorage),partialize:state=>({commitments:state.commitments,focusId:state.focusId})}));
