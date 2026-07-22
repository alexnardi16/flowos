import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { recordDiagnostic } from './diagnostics';
import { supabase } from './supabase';

export const GOOGLE_SCOPES = [
  'openid','email','profile',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/tasks',
].join(' ');

export type GoogleSyncRange = { startYear:number; endYear:number; labelStart:string; labelEnd:string; years:number[] };
export type GoogleCalendar = { id:string; google_calendar_id:string; summary:string; description?:string|null; background_color?:string|null; foreground_color?:string|null; access_role:string; primary_calendar:boolean; selected:boolean; is_default:boolean };
export type GoogleTaskList = { id:string; google_task_list_id:string; title:string; selected:boolean; is_default:boolean };
export type GoogleWorkspaceStatus = { connection:null|{google_email?:string|null;last_sync_at?:string|null;last_sync_status:'pending'|'syncing'|'ok'|'error'|'disconnected';last_sync_error?:string|null};calendars:GoogleCalendar[];taskLists:GoogleTaskList[];range:GoogleSyncRange };
export type SyncProgress = { percent:number; stage:string };

const SUPABASE_URL=process.env.EXPO_PUBLIC_SUPABASE_URL??'';
const SUPABASE_KEY=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY??'';
const FUNCTION_URL=`${SUPABASE_URL}/functions/v1/google-workspace`;
const REQUEST_TIMEOUT_MS=60_000;

export function currentGoogleSyncRange():GoogleSyncRange{
  const startYear=new Date().getFullYear();
  const endYear=startYear+1;
  return {startYear,endYear,labelStart:`01/01/${startYear}`,labelEnd:`31/12/${endYear}`,years:[startYear,endYear]};
}

function errorMessage(error:unknown){return error instanceof Error?error.message:String(error||'Errore sconosciuto');}
async function updateSyncFailure(message:string){const {data}=await supabase.auth.getUser();if(!data.user)return;const {error}=await supabase.from('google_connections').update({last_sync_status:'error',last_sync_error:message}).eq('user_id',data.user.id);if(error)recordDiagnostic('google-sync-mark-error-failed',error,'error');}
export async function recoverStaleGoogleSyncState(){const message='La precedente sincronizzazione è stata interrotta prima del completamento.';recordDiagnostic('google-sync-stale-state-recovered',{message},'warn');await updateSyncFailure(message);}

async function invoke(body:Record<string,unknown>,retries=1){
  const {data:sessionData,error:sessionError}=await supabase.auth.getSession();if(sessionError)throw sessionError;
  const accessToken=sessionData.session?.access_token;if(!accessToken)throw new Error('Sessione FlowOS scaduta. Esci e accedi nuovamente.');
  let lastError:unknown;
  for(let attempt=0;attempt<=retries;attempt+=1){
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    recordDiagnostic('google-function-request-start',{action:body.action,attempt:attempt+1});
    try{
      const response=await fetch(FUNCTION_URL,{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${accessToken}`,apikey:SUPABASE_KEY,'Content-Type':'application/json','x-client-info':'flowos-google-sync/3.0'},body:JSON.stringify(body)});
      const raw=await response.text();let payload:any=null;try{payload=raw?JSON.parse(raw):null;}catch{payload=raw?{error:raw}:null;}
      recordDiagnostic('google-function-response',{action:body.action,status:response.status,ok:response.ok});
      if(!response.ok||payload?.error)throw new Error(String(payload?.error||`Google Workspace ha risposto con stato ${response.status}.`));
      return payload;
    }catch(error){lastError=error;const named=error as {name?:string};const message=named?.name==='AbortError'?'La richiesta di sincronizzazione ha superato il tempo massimo consentito.':errorMessage(error);recordDiagnostic('google-function-request-failed',{action:body.action,attempt:attempt+1,message},'error');if(attempt>=retries||!/failed to fetch|network|send a request|timeout|tempo massimo|abort/i.test(message))break;await new Promise(resolve=>setTimeout(resolve,900));}
    finally{clearTimeout(timeout);}
  }
  throw lastError instanceof Error?lastError:new Error(errorMessage(lastError));
}

export async function signInWithGoogle(){const redirectTo=Platform.OS==='web'&&typeof window!=='undefined'?`${window.location.origin}/today`:'flowos://today';const {data,error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo,scopes:GOOGLE_SCOPES,queryParams:{access_type:'offline',prompt:'consent',include_granted_scopes:'true'}}});if(error)throw error;return data;}
export async function connectGoogleFromSession(session:Session,force=false){if(!session.provider_token)return null;const marker=`flowos-google-connected-${session.user.id}-${session.provider_token.slice(-12)}`;if(!force&&Platform.OS==='web'&&typeof sessionStorage!=='undefined'&&sessionStorage.getItem(marker))return null;const result=await invoke({action:'connect',providerToken:session.provider_token,providerRefreshToken:session.provider_refresh_token,scopes:GOOGLE_SCOPES,expiresIn:3600});if(Platform.OS==='web'&&typeof sessionStorage!=='undefined')sessionStorage.setItem(marker,'1');return result;}
export async function getGoogleWorkspaceStatus():Promise<GoogleWorkspaceStatus>{const result=await invoke({action:'status'},0);return {...result,range:currentGoogleSyncRange()};}

async function purgeOutOfRangeGoogleItems(){
  const range=currentGoogleSyncRange();
  const start=`${range.startYear}-01-01T00:00:00.000Z`;
  const endExclusive=`${range.endYear+1}-01-01T00:00:00.000Z`;
  const queries=[
    supabase.from('commitments').delete().eq('external_provider','google').eq('external_resource_type','calendar_event').lt('starts_at',start),
    supabase.from('commitments').delete().eq('external_provider','google').eq('external_resource_type','calendar_event').gte('starts_at',endExclusive),
    supabase.from('commitments').delete().eq('external_provider','google').eq('external_resource_type','task').lt('deadline_at',start),
    supabase.from('commitments').delete().eq('external_provider','google').eq('external_resource_type','task').gte('deadline_at',endExclusive),
    supabase.from('commitments').delete().eq('external_provider','google').eq('external_resource_type','task').is('deadline_at',null),
  ];
  const results=await Promise.all(queries);const failure=results.find(result=>result.error)?.error;if(failure)throw failure;
  recordDiagnostic('google-out-of-range-items-purged',{start,endExclusive});
}

export async function syncGoogleWorkspace(onProgress?:(progress:SyncProgress)=>void){
  recordDiagnostic('google-sync-started');const totals={pushed:0,events:0,tasks:0};const range=currentGoogleSyncRange();
  try{
    const plan=await invoke({action:'sync-start'});const calendars=plan.calendars??[];const taskLists=plan.taskLists??[];const years=range.years;
    const baseUnits=3+calendars.length*years.length+taskLists.length;let completed=0;
    const report=(stage:string,forced?:number)=>{const percent=forced??Math.min(98,Math.max(1,Math.round((completed/Math.max(1,baseUnits))*94)+3));onProgress?.({percent,stage});recordDiagnostic('google-sync-progress',{percent,stage});};
    report('Preparazione della sincronizzazione',3);
    const pushed=await invoke({action:'sync-push'});totals.pushed=pushed.pushed??0;completed+=1;report('Modifiche FlowOS inviate a Google');
    for(const calendar of calendars){for(const year of years){let pageToken:string|null=null;do{const page=await invoke({action:'sync-calendar-page',calendarId:calendar.google_calendar_id,year,pageToken});totals.events+=page.imported??0;pageToken=page.nextPageToken??null;report(`Calendario ${calendar.summary}: anno ${year}`);}while(pageToken);completed+=1;report(`Calendario ${calendar.summary}: anno ${year} completato`);}}
    for(const list of taskLists){let pageToken:string|null=null;do{const page=await invoke({action:'sync-task-page',listId:list.google_task_list_id,pageToken});totals.tasks+=page.imported??0;pageToken=page.nextPageToken??null;report(`Google Tasks: ${list.title}`);}while(pageToken);completed+=1;report(`Google Tasks: ${list.title} completata`);}
    onProgress?.({percent:96,stage:'Pulizia degli elementi fuori intervallo'});await purgeOutOfRangeGoogleItems();completed+=1;
    onProgress?.({percent:98,stage:'Finalizzazione della sincronizzazione'});await invoke({action:'sync-finish'});
    onProgress?.({percent:100,stage:'Sincronizzazione completata'});recordDiagnostic('google-sync-succeeded',totals);return {...totals,range};
  }catch(error){const message=errorMessage(error);try{await invoke({action:'sync-fail',message},0);}catch(markError){recordDiagnostic('google-sync-server-mark-error-failed',markError,'error');}await updateSyncFailure(message);recordDiagnostic('google-sync-failed',{message},'error');throw new Error(message);}
}

export async function disconnectGoogleWorkspace(){return invoke({action:'disconnect'});}
export async function setDefaultCalendar(id:string){const {error}=await supabase.rpc('set_default_google_calendar',{p_calendar_id:id});if(error)throw error;}
export async function setDefaultTaskList(id:string){const {error}=await supabase.rpc('set_default_google_task_list',{p_task_list_id:id});if(error)throw error;}
export async function setCalendarSelected(id:string,selected:boolean){const {error}=await supabase.from('google_calendars').update({selected}).eq('id',id);if(error)throw error;}
export async function setTaskListSelected(id:string,selected:boolean){const {error}=await supabase.from('google_task_lists').update({selected}).eq('id',id);if(error)throw error;}
