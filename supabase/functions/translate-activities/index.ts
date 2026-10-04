import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json'};
const LANGUAGE_NAMES:Record<string,string>={en:'English',fr:'French',es:'Spanish'};
Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers});
  try{
    const auth=request.headers.get('Authorization')??'';const token=auth.replace(/^Bearer\s+/i,'');if(!token)throw new Error('Missing authorization');
    const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY');if(!url||!key)throw new Error('Supabase environment not configured');
    const client=createClient(url,key,{global:{headers:{Authorization:auth}}});const {data,error:userError}=await client.auth.getUser(token);if(userError||!data.user)throw new Error('Unauthorized');
    const body=await request.json();const language=typeof body?.language==='string'?body.language:'';const titles=Array.isArray(body?.titles)?body.titles:[];
    if(!['en','fr','es'].includes(language))throw new Error('Unsupported language');if(!titles.length||titles.length>50)throw new Error('Invalid title batch');
    const clean=titles.filter((entry:any)=>typeof entry?.id==='string'&&typeof entry?.text==='string'&&entry.text.trim()).map((entry:any)=>({id:entry.id,text:entry.text.trim()}));
    if(!clean.length)return new Response(JSON.stringify({translations:[]}),{headers});
    const apiKey=Deno.env.get('OPENAI_API_KEY');if(!apiKey)throw new Error('Translation service unavailable');const model=Deno.env.get('OPENAI_MODEL')||'gpt-5-mini';
    const system='Translate each activity title into '+LANGUAGE_NAMES[language]+'. Preserve meaning, names, acronyms, dates, numbers and product/company names. Return JSON only as an object with a translations array. Each item must contain exactly the original id and a translated text. Do not add explanations.';
    const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(clean)}],response_format:{type:'json_object'}})});
    if(!response.ok)throw new Error('OpenAI translation failed: '+response.status);
    const json=await response.json();const content=json?.choices?.[0]?.message?.content;const parsed=typeof content==='string'?JSON.parse(content):null;const rows=Array.isArray(parsed?.translations)?parsed.translations:[];const allowed=new Map(clean.map((entry:any)=>[entry.id,entry.text]));
    const translations=rows.filter((entry:any)=>typeof entry?.id==='string'&&typeof entry?.text==='string'&&allowed.has(entry.id)).map((entry:any)=>({id:entry.id,text:entry.text.trim()||allowed.get(entry.id)}));
    return new Response(JSON.stringify({translations}),{headers});
  }catch(error){return new Response(JSON.stringify({error:error instanceof Error?error.message:'Unknown error'}),{status:400,headers});}
});