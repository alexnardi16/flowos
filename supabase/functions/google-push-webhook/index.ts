import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const URL=Deno.env.get("SUPABASE_URL")!;
const KEY=Deno.env.get("FLOWOS_SYNC_INTERNAL_KEY")??"";
Deno.serve(async(req)=>{if(req.method!=="POST")return new Response("ok",{status:200});const channel=req.headers.get("x-goog-channel-id");const token=req.headers.get("x-goog-channel-token");if(!channel||!token)return new Response("ok",{status:200});const r=await fetch(`${URL}/functions/v1/google-sync-worker`,{method:"POST",headers:{"Content-Type":"application/json","x-flowos-internal-key":KEY},body:JSON.stringify({channelId:channel,channelToken:token})});return new Response("ok",{status:r.ok?200:202});});
