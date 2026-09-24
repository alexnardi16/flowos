import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.57.4';
import { bothChangedSince, bothCreatedSince, localChangedAndRemoteDeleted } from './syncConflictPolicy.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const URL=Deno.env.get('SUPABASE_URL')!;const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;const CLIENT_ID=Deno.env.get('GOOGLE_CLIENT_ID')??'';const CLIENT_SECRET=Deno.env.get('GOOGLE_CLIENT_SECRET')??'';const admin=createClient(URL,SERVICE,{auth:{persistSession:false}});
async function currentUser(req:Request){const jwt=(req.headers.get('Authorization')??'').replace(/^Bearer\s+/i,'');if(!jwt)throw new Error('Missing authorization token');const {data,error}=await admin.auth.getUser(jwt);if(error||!data.user)throw new Error('Invalid session');return data.user;}
async function tokenFor(userId:string){const {data,error}=await admin.schema('private').from('google_oauth_tokens').select('*').eq('user_id',userId).maybeSingle();if(error||!data)throw new Error('Google account is not connected');if(!data.expires_at||new Date(data.expires_at).getTime()>Date.now()+60000)return data;if(!data.refresh_token||!CLIENT_ID||!CLIENT_SECRET)throw new Error('Google authorization expired. Reconnect Google to continue.');const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,refresh_token:data.refresh_token,grant_type:'refresh_token'})});const p:any=await r.json();if(!r.ok||!p.access_token)throw new Error('Unable to refresh Google token');const next={...data,access_token:p.access_token,refresh_token:p.refresh_token??data.refresh_token,expires_at:new Date(Date.now()+Math.max(60,p.expires_in??3600)*1000).toISOString(),token_type:p.token_type??'Bearer'};await admin.schema('private').from('google_oauth_tokens').update({access_token:next.access_token,refresh_token:next.refresh_token,expires_at:next.expires_at,token_type:next.token_type,updated_at:new Date().toISOString()}).eq('user_id',userId);return next;}
async function gfetch(url:string,token:string,options:RequestInit={}){const r=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(options.headers??{})}});const text=await r.text();let data:any=null;try{data=text?JSON.parse(text):null}catch{data=text}if(!r.ok){const e:any=new Error(typeof data==='string'?data:(data?.error?.message??JSON.stringify(data)));e.status=r.status;throw e;}return data;}


function eventBody(c:any){
  const start=c.starts_at?new Date(c.starts_at):new Date();
  const end=new Date(start.getTime()+Math.max(1,c.duration_minutes??60)*60000);
  return {summary:c.title,description:c.description??undefined,location:c.ai_metadata?.location??undefined,start:{dateTime:start.toISOString()},end:{dateTime:end.toISOString()},extendedProperties:{private:{flowosCommitmentId:c.id}},reminders:{useDefault:false,overrides:[]}};
}
function taskBody(c:any){
  return {title:c.title,notes:c.description??undefined,due:c.deadline_at?new Date(c.deadline_at).toISOString():undefined,status:c.status==="completed"||c.status==="done"?"completed":"needsAction"};
}
async function forcePushFlowosVersion(userId:string,item:any){
  const token=(await tokenFor(userId)).access_token;
  const isEvent=item.kind==="event";
  const calendarId=item.google_calendar_id;
  const listId=item.google_task_list_id;
  if(item.deleted_at){
    if(item.external_id){
      const endpoint=isEvent
        ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(item.external_id)}`
        : `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(item.external_id)}`;
      try{await gfetch(endpoint,token,{method:"DELETE"});}catch(e:any){if(e?.status!==404&&e?.status!==410)throw e;}
    }
    await admin.from("commitments").delete().eq("id",item.id).eq("user_id",userId);
    return {deleted:true};
  }
  if(isEvent){
    const base=`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const remote=await gfetch(item.external_id?`${base}/${encodeURIComponent(item.external_id)}`:base,token,{method:item.external_id?"PATCH":"POST",body:JSON.stringify(eventBody(item))});
    await admin.from("commitments").update({external_provider:"google",external_resource_type:"calendar_event",external_id:remote.id,external_etag:remote.etag??null,external_updated_at:remote.updated??null,last_sync_origin:"flowos",sync_status:"synced",sync_error:null,resolution_pending:false,updated_at:new Date().toISOString()}).eq("id",item.id).eq("user_id",userId);
    return {deleted:false,externalId:remote.id};
  }
  const base=`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks`;
  const remote=await gfetch(item.external_id?`${base}/${encodeURIComponent(item.external_id)}`:base,token,{method:item.external_id?"PATCH":"POST",body:JSON.stringify(taskBody(item))});
  await admin.from("commitments").update({external_provider:"google",external_resource_type:"task",external_id:remote.id,external_etag:remote.etag??null,external_updated_at:remote.updated??null,last_sync_origin:"flowos",sync_status:"synced",sync_error:null,resolution_pending:false,updated_at:new Date().toISOString()}).eq("id",item.id).eq("user_id",userId);
  return {deleted:false,externalId:remote.id};
}


function normalizeText(value:any){return String(value??'').trim().replace(/\\s+/g,' ').toLocaleLowerCase();}
function remoteMatchesLocal(item:any,remote:any){
  const localStart=item.starts_at?new Date(item.starts_at).getTime():null;
  const localDue=item.deadline_at?new Date(item.deadline_at).getTime():null;
  const localDescription=normalizeText(item.description??item.ai_metadata?.originalDescription);
  const localLocation=normalizeText(item.ai_metadata?.location);
  if(item.kind==="event"){
    const remoteStart=remote?.start?.dateTime?new Date(remote.start.dateTime).getTime():remote?.start?.date?new Date(`${remote.start.date}T00:00:00Z`).getTime():null;
    const remoteEnd=remote?.end?.dateTime?new Date(remote.end.dateTime).getTime():null;
    const remoteDuration=remoteStart!==null&&remoteEnd!==null?Math.round((remoteEnd-remoteStart)/60000):null;
    const localDuration=Number(item.duration_minutes??0);
    return normalizeText(item.title)===normalizeText(remote?.summary)
      && normalizeText(remote?.description)===localDescription
      && localStart===remoteStart
      && localDuration===remoteDuration
      && localLocation===normalizeText(remote?.location);
  }
  const remoteDue=remote?.due?new Date(remote.due).getTime():null;
  return normalizeText(item.title)===normalizeText(remote?.title)
    && normalizeText(remote?.notes)===localDescription
    && localDue===remoteDue
    && ((item.status==="done"||item.status==="completed") ? remote?.status==="completed" : remote?.status!=="completed");
}

async function createConflict(userId:string,item:any,remote:any,type:string,message:string){const {data:existing}=await admin.from('sync_conflicts').select('id').eq('user_id',userId).eq('commitment_id',item.id).eq('status','open').eq('conflict_type',type).limit(1);if(!existing?.length)await admin.from('sync_conflicts').insert({user_id:userId,commitment_id:item.id,external_provider:'google',external_resource_type:item.external_resource_type,external_id:item.external_id??null,conflict_type:type,local_snapshot:item,remote_snapshot:remote??null,message,status:'open'});await admin.from('commitments').update({sync_status:'conflict',sync_error:message}).eq('id',item.id).eq('user_id',userId);}
async function guard(userId:string){
  const token=(await tokenFor(userId)).access_token;
  const {data:items,error}=await admin.from('commitments').select('*').eq('user_id',userId).in('sync_status',['pending','error']).limit(100);
  if(error)throw error;
  const {data:connection}=await admin.from('google_connections').select('last_sync_at').eq('user_id',userId).maybeSingle();
  const lastSyncAt=connection?.last_sync_at??null;
  let conflicts=0;
  const {data:defCal}=await admin.from('google_calendars').select('google_calendar_id').eq('user_id',userId).eq('is_default',true).maybeSingle();
  const {data:defList}=await admin.from('google_task_lists').select('google_task_list_id').eq('user_id',userId).eq('is_default',true).maybeSingle();
  for(const item of items??[]){
    try{
      if(item.resolution_pending) continue;
      const isEvent=item.kind==='event',isTask=item.kind==='task',externalId=item.external_id,calendarId=item.google_calendar_id??defCal?.google_calendar_id,listId=item.google_task_list_id??defList?.google_task_list_id;
      if(externalId){
        const base=isEvent?'https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(calendarId)+'/events/'+encodeURIComponent(externalId):'https://tasks.googleapis.com/tasks/v1/lists/'+encodeURIComponent(listId)+'/tasks/'+encodeURIComponent(externalId);
        try{
          const remote=await gfetch(base,token);
          if(bothChangedSince(item.updated_at,remote.updated,lastSyncAt)&&!remoteMatchesLocal(item,remote)){await createConflict(userId,item,remote,'remote_changed','Google e FlowOS hanno modificato questa attività dall’ultima sincronizzazione. Nessuna delle due versioni è stata sovrascritta.');conflicts++;}
        }catch(e:any){
          if(e?.status===404||e?.status===410){
            if(localChangedAndRemoteDeleted(item.updated_at,false,lastSyncAt)){await createConflict(userId,item,null,'remote_deleted','Google e FlowOS hanno eliminato questa attività dall’ultima sincronizzazione. Nessuna delle due versioni è stata eliminata automaticamente.');conflicts++;}
            else if(item.deleted_at)await admin.from('commitments').update({sync_status:'synced',sync_error:null}).eq('id',item.id).eq('user_id',userId);
          }else throw e;
        }
      }else if(isEvent&&calendarId&&item.starts_at){
        const start=new Date(item.starts_at),end=new Date(start.getTime()+Math.max(1,item.duration_minutes??30)*60000);
        const p=new URLSearchParams({singleEvents:'true',showDeleted:'false',maxResults:'20',timeMin:new Date(start.getTime()-86400000).toISOString(),timeMax:new Date(end.getTime()+86400000).toISOString(),q:item.title});
        const remote=await gfetch('https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(calendarId)+'/events?'+p,token);
        const matches=(remote?.items??[]).filter((r:any)=>r.status!=='cancelled'&&String(r.summary??'').trim().toLocaleLowerCase()===String(item.title).trim().toLocaleLowerCase()&&bothCreatedSince(item.updated_at,r.updated,lastSyncAt));
        if(matches.length){await createConflict(userId,item,{matches},'possible_duplicate','FlowOS e Google hanno creato attività molto simili dall’ultima sincronizzazione. Scegli manualmente come gestire il possibile duplicato.');conflicts++;}
      }else if(isTask&&listId&&item.deadline_at){
        const due=new Date(item.deadline_at),p=new URLSearchParams({maxResults:'100',showCompleted:'true',showDeleted:'true',dueMin:new Date(due.getTime()-86400000).toISOString(),dueMax:new Date(due.getTime()+86400000).toISOString()});
        const remote=await gfetch('https://tasks.googleapis.com/tasks/v1/lists/'+encodeURIComponent(listId)+'/tasks?'+p,token);
        const matches=(remote?.items??[]).filter((r:any)=>!r.deleted&&String(r.title??'').trim().toLocaleLowerCase()===String(item.title).trim().toLocaleLowerCase()&&bothCreatedSince(item.updated_at,r.updated,lastSyncAt));
        if(matches.length){await createConflict(userId,item,{matches},'possible_duplicate','FlowOS e Google hanno creato task molto simili dall’ultima sincronizzazione. Scegli manualmente come gestire il possibile duplicato.');conflicts++;}
      }
    }catch(error){console.warn('google-sync-guard-item-failed',item.id,error);}
  }
  const {count}=await admin.from('sync_conflicts').select('id',{count:'exact',head:true}).eq('user_id',userId).eq('status','open');
  return{ok:true,conflictsCreated:conflicts,openConflicts:count??0};
}
async function resolve(userId:string,id:string,resolution:string){
  const {data:conflict,error}=await admin.from('sync_conflicts').select('*').eq('id',id).eq('user_id',userId).eq('status','open').maybeSingle();
  if(error)throw error;if(!conflict)throw new Error('Conflitto non trovato');
  const itemId=conflict.commitment_id;
  if(resolution==='keep_flowos'){
    if(!itemId)throw new Error('Il conflitto non è collegato a un elemento FlowOS.');
    const {data:item}=await admin.from('commitments').select('*').eq('id',itemId).eq('user_id',userId).maybeSingle();
    if(!item)throw new Error('Attività FlowOS non trovata.');
    await admin.from('commitments').update({resolution_pending:true,sync_status:'pending',sync_error:null}).eq('id',itemId).eq('user_id',userId);
    await forcePushFlowosVersion(userId,{...item,resolution_pending:true});
  }else if(resolution==='keep_google'){
    if(itemId)await admin.from('commitments').delete().eq('id',itemId).eq('user_id',userId);
  }else if(resolution==='keep_both'){
    if(itemId)await admin.from('commitments').update({external_provider:null,external_resource_type:null,external_id:null,external_etag:null,external_updated_at:null,google_calendar_id:null,google_task_list_id:null,last_sync_origin:'flowos',sync_status:'local_only',sync_error:null,resolution_pending:false}).eq('id',itemId).eq('user_id',userId);
  }else{
    throw new Error('Risoluzione non supportata');
  }
  const resolvedAt=new Date().toISOString();
  await admin.from('google_connections').update({last_sync_at:resolvedAt,last_sync_status:'ok',last_sync_error:null,updated_at:resolvedAt}).eq('user_id',userId);
  await admin.from('sync_conflicts').update({status:'resolved',resolution,resolved_at:resolvedAt}).eq('id',id).eq('user_id',userId);
  return{ok:true,resolvedAt};
}

Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});try{const user=await currentUser(req);const body=await req.json().catch(()=>({}));if(body.action==='resolve')return json(await resolve(user.id,String(body.conflictId),String(body.resolution)));return json(await guard(user.id));}catch(e){return json({error:e instanceof Error?e.message:String(e)},500);}});
