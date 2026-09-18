import { Platform } from 'react-native';
import { recordDiagnostic } from './diagnostics';
import type { Commitment } from '../types';

export type VoiceCommand =
  | { type:'add'; title:string; kind:'task'|'event'|'reminder'; when?:string }
  | { type:'delete'; query:string }
  | { type:'complete'; query:string }
  | { type:'postpone'; query:string }
  | { type:'rename'; query:string; title:string }
  | { type:'move'; query:string; when:string };

const MONTHS:Record<string,number>={gennaio:0,febbraio:1,marzo:2,aprile:3,maggio:4,giugno:5,luglio:6,agosto:7,settembre:8,ottobre:9,novembre:10,dicembre:11};
const WEEKDAYS:Record<string,number>={lunedi:1,martedi:2,mercoledi:3,giovedi:4,venerdi:5,sabato:6,domenica:0};

export function normalizeVoiceText(value:string){
  return value.trim().toLocaleLowerCase('it-IT').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,' ').replace(/\s+/g,' ').trim();
}
function nextWeekday(base:Date,target:number,forceNext=false){
  const d=new Date(base);let delta=(target-d.getDay()+7)%7;
  if(forceNext&&delta===0)delta=7;
  d.setDate(d.getDate()+delta);
  return d;
}
function extractWhen(text:string){
  const lower=normalizeVoiceText(text),now=new Date();
  const time=lower.match(/\b(?:alle|ore|verso le)\s*(\d{1,2})(?:[:.](\d{2}))?\b/);
  let date:Date|undefined;
  if(/\btra\s+(?:un|una)\s+(minuto|minuti|ora|ore|giorno|giorni)\b/.test(lower)){
    const unit=lower.match(/\btra\s+(?:un|una)\s+(minuto|minuti|ora|ore|giorno|giorni)\b/)?.[1]??'giorno';
    const ms=unit.startsWith('minut')?60000:unit.startsWith('or')?3600000:86400000;
    return new Date(now.getTime()+ms).toISOString();
  }
  if(/\bdopodomani\b/.test(lower)){date=new Date(now);date.setDate(date.getDate()+2);}
  else if(/\bdomani\b/.test(lower)){date=new Date(now);date.setDate(date.getDate()+1);}
  else if(/\boggi\b/.test(lower)){date=new Date(now);}
  else{
    const weekday=Object.entries(WEEKDAYS).find(([name])=>new RegExp(`\\b${name}(?:\\s+prossim[oa])?\\b`).test(lower));
    if(weekday)date=nextWeekday(now,weekday[1],/prossim/.test(lower));
    const explicit=lower.match(/\b(?:il\s+)?(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?\b/);
    if(explicit){
      const day=Number(explicit[1]),month=MONTHS[explicit[2]],year=explicit[3]?Number(explicit[3]):now.getFullYear();
      date=new Date(year,month,day);
      if(!explicit[3]&&date<new Date(now.getFullYear(),now.getMonth(),now.getDate()))date.setFullYear(year+1);
    }
  }
  const relative=lower.match(/\btra\s+(\d+)\s+(minut[oi]|or[ae]|giorn[oi])\b/);
  if(relative){
    const amount=Number(relative[1]),unit=relative[2],ms=unit.startsWith('minut')?60000:unit.startsWith('or')?3600000:86400000;
    return new Date(now.getTime()+amount*ms).toISOString();
  }
  if(!date)return undefined;
  const afternoon=/\bpomeriggio\b/.test(lower),evening=/\bsera\b/.test(lower),morning=/\bmattina\b/.test(lower),night=/\bnotte\b/.test(lower);
  date.setHours(time?Math.min(23,Number(time[1])):night?22:evening?19:afternoon?15:morning?9:9,time?Number(time[2]??0):0,0,0);
  return date.toISOString();
}
function removeWhen(text:string){
  return text
    .replace(/\b(?:dopodomani|domani|oggi|prossim[oa]\s+(?:lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b(?:\s+(?:mattina|pomeriggio|sera|notte))?/gi,'')
    .replace(/\b(?:alle|ore|verso le)\s*\d{1,2}(?:[:.]\d{2})?/gi,'')
    .replace(/\b(?:tra\s+(?:un|una)\s+(?:minuto|minuti|ora|ore|giorno|giorni)|tra\s+\d+\s+(?:minut[oi]|or[ae]|giorn[oi]))\b/gi,'')
    .replace(/\b(?:il\s+)?\d{1,2}\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+\d{4})?\b/gi,'')
    .replace(/\s+/g,' ').replace(/\s+([,.!?])/g,'$1').trim();
}
function stripKind(text:string){
  return text
    .replace(/^\s*(?:un|una|il|la|l')\s+/i,'')
    .replace(/\b(?:come|tipo|di tipo)\s+(?:evento|appuntamento|meeting|riunione|task|attivita|reminder|promemoria)\b/gi,'')
    .replace(/^\s*(?:evento|appuntamento|meeting|riunione|task|attivita|reminder|promemoria)\s*[:,-]?\s*/i,'')
    .replace(/^\s*(?:di|da)\s+/i,'')
    .replace(/\s+/g,' ').trim();
}
function cleanQuery(text:string){
  return removeWhen(text)
    .replace(/^\s*(?:l['’]?|il|lo|la|i|gli|le|un|uno|una)\s+/i,'')
    .replace(/\s+(?:di|del|della|dei|degli|delle)\s+(?:oggi|domani|dopodomani)\s*$/i,'')
    .replace(/\s+/g,' ').trim();
}

export function parseVoiceCommand(transcript:string):VoiceCommand|null{
  const raw=transcript.trim(),lower=normalizeVoiceText(raw);
  if(!raw)return null;
  let match=lower.match(/^(?:elimina|cancella|rimuovi|togli)\s+(?:l\s+|il |lo |la |un |uno |una )?(?:attivita|evento|task|reminder|appuntamento)?\s*(.+)$/);
  if(match)return{type:'delete',query:cleanQuery(match[1])};
  match=lower.match(/^(?:completa|termina|chiudi|fatto|segna\s+(?:come\s+)?complet[ao])\s+(?:l\s+|il |lo |la |un |uno |una )?(?:attivita|evento|task|reminder|appuntamento)?\s*(.+?)(?:\s+come\s+(?:complet[ao]|fatto))?$/);
  if(match)return{type:'complete',query:cleanQuery(match[1])};
  match=lower.match(/^(?:rimanda|posticipa)\s+(?:l\s+|il |lo |la |un |uno |una )?(?:attivita|evento|task|reminder|appuntamento)?\s*(.+?)(?:\s+(?:di|a|per)\s+un\s+giorno)?$/);
  if(match)return{type:'postpone',query:cleanQuery(match[1])};
  match=lower.match(/^(?:rinomina|ribattezza|cambia\s+(?:il\s+)?nome\s+(?:di|dell)?)\s+(.+?)\s+(?:in|come|con il nome)\s+(.+)$/);
  if(match)return{type:'rename',query:cleanQuery(match[1]),title:stripKind(match[2])};
  match=lower.match(/^(?:sposta|rimetti|metti|fissa|programma)\s+(.+?)\s+(?:a|per|su|in)\s+(.+)$/);
  if(match){
    const when=extractWhen(match[2]);
    if(when)return{type:'move',query:cleanQuery(match[1]),when};
  }
  const addMatch=raw.match(/^(aggiungi|crea|inserisci|registra|programma|pianifica|ricordami(?:\s+di)?|devo)\s+(.+)$/i);
  if(addMatch){
    const prefix=normalizeVoiceText(addMatch[1]),original=addMatch[2].trim(),normalizedOriginal=normalizeVoiceText(original);
    const when=extractWhen(original),title=stripKind(removeWhen(original));
    const kind=/\b(?:evento|appuntamento|meeting|riunione|calendar|calendario)\b/.test(normalizedOriginal)?'event':(prefix.includes('ricordami')||/\b(?:reminder|promemoria)\b/.test(normalizedOriginal))?'reminder':'task';
    return{type:'add',title:title||original,kind,when};
  }
  return null;
}

export function findBestVoiceMatch(items:Commitment[],query:string){
  const active=items.filter(item=>item.status!=='done'&&!item.deletedAt);
  const q=normalizeVoiceText(cleanQuery(query));
  if(!q)return null;
  const exact=active.find(item=>normalizeVoiceText(item.title)===q);
  if(exact)return exact;
  const contains=active.filter(item=>{const t=normalizeVoiceText(item.title);return t.includes(q)||q.includes(t);});
  if(contains.length===1)return contains[0];
  if(contains.length>1){
    const ranked=contains.map(item=>({item,score:normalizeVoiceText(item.title)===q?100:normalizeVoiceText(item.title).startsWith(q)?80:60})).sort((a,b)=>b.score-a.score);
    if(ranked[0].score>ranked[1].score)return ranked[0].item;
    return null;
  }
  const qTokens=q.split(' ').filter(token=>token.length>2);
  let best:Commitment|null=null,bestScore=0,second=0;
  for(const item of active){
    const tokens=new Set(normalizeVoiceText(item.title).split(' ').filter(token=>token.length>2));
    const score=qTokens.filter(token=>tokens.has(token)).length;
    if(score>bestScore){second=bestScore;bestScore=score;best=item;}
    else if(score>second)second=score;
  }
  return best&&bestScore>=Math.max(1,Math.ceil(qTokens.length*0.5))&&bestScore>second?best:null;
}

export async function listenForVoiceCommand(locale='it-IT'):Promise<string|null>{
  if(Platform.OS==='web'){
    if(typeof window==='undefined')return null;
    const SpeechRecognition=(window as any).SpeechRecognition??(window as any).webkitSpeechRecognition;
    if(!SpeechRecognition)throw new Error('Il riconoscimento vocale non è disponibile su questo dispositivo.');
    const recognition=new SpeechRecognition();
    recognition.lang=locale;recognition.interimResults=false;recognition.maxAlternatives=5;
    return await new Promise<string|null>((resolve,reject)=>{
      let settled=false;
      recognition.onresult=(event:any)=>{if(!settled){settled=true;resolve(event.results?.[0]?.[0]?.transcript??null);}};
      recognition.onerror=(event:any)=>{if(!settled){settled=true;reject(new Error(`Riconoscimento vocale non riuscito: ${event?.error??'errore sconosciuto'}.`));}};
      recognition.onend=()=>{if(!settled){settled=true;resolve(null);}};
      recognition.start();
    });
  }
  if(Platform.OS!=='android')throw new Error('Il microfono dei comandi vocali è disponibile nell’app Android.');
  const IntentLauncher=await import('expo-intent-launcher');
  recordDiagnostic('voice-command-started',{locale});
  const result=await IntentLauncher.startActivityAsync('android.speech.action.RECOGNIZE_SPEECH',{extra:{'android.speech.extra.LANGUAGE_MODEL':'free_form','android.speech.extra.LANGUAGE':locale,'android.speech.extra.MAX_RESULTS':5,'android.speech.extra.PROMPT':'Cosa vuoi fare con FlowOS?'}});
  const values=(result.extra as Record<string,unknown>|undefined)?.['android.speech.extra.RESULTS'];
  const transcript=Array.isArray(values)?String(values[0]??''):null;
  recordDiagnostic('voice-command-finished',{resultCode:result.resultCode,hasTranscript:Boolean(transcript)});
  return transcript||null;
}
