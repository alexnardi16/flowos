import { Platform } from 'react-native';
import { recordDiagnostic } from './diagnostics';

export type VoiceCommand =
  | { type:'add'; title:string; kind:'task'|'event'|'reminder'; when?:string }
  | { type:'delete'; query:string }
  | { type:'complete'; query:string }
  | { type:'postpone'; query:string }
  | { type:'rename'; query:string; title:string }
  | { type:'move'; query:string; when:string };

function normalize(value:string){return value.trim().toLocaleLowerCase('it-IT').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
const MONTHS:Record<string,number>={gennaio:0,febbraio:1,marzo:2,aprile:3,maggio:4,giugno:5,luglio:6,agosto:7,settembre:8,ottobre:9,novembre:10,dicembre:11};
const WEEKDAYS:Record<string,number>={lunedi:1,martedi:2,mercoledi:3,giovedi:4,venerdi:5,sabato:6,domenica:0};

function nextWeekday(base:Date,target:number,forceNext=false){const d=new Date(base);let delta=(target-d.getDay()+7)%7;if(delta===0||forceNext)delta=delta||7;d.setDate(d.getDate()+delta);return d;}
function extractWhen(text:string){
  const lower=normalize(text),now=new Date(),time=lower.match(/\b(?:alle|ore)\s*(\d{1,2})(?:[:.](\d{2}))?\b/);
  let date:Date|undefined;
  if(/\bdopodomani\b/.test(lower)){date=new Date(now);date.setDate(now.getDate()+2);}
  else if(/\bdomani\b/.test(lower)){date=new Date(now);date.setDate(now.getDate()+1);}
  else if(/\boggi\b/.test(lower)){date=new Date(now);}
  else{
    const weekday=Object.entries(WEEKDAYS).find(([name])=>new RegExp(`\\b${name}(?:\\s+prossim[oa])?\\b`).test(lower));
    if(weekday)date=nextWeekday(now,weekday[1],/prossim/.test(lower));
    const explicit=lower.match(/\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?\b/);
    if(explicit){const day=Number(explicit[1]),month=MONTHS[explicit[2]],year=explicit[3]?Number(explicit[3]):now.getFullYear();date=new Date(year,month,day);if(!explicit[3]&&date<new Date(now.getFullYear(),now.getMonth(),now.getDate()))date.setFullYear(year+1);}
  }
  const relative=lower.match(/\btra\s+(\d+)\s+(minut[oi]|or[ae]|giorn[oi])\b/);
  if(relative){const amount=Number(relative[1]),unit=relative[2];const ms=unit.startsWith('minut')?60000:unit.startsWith('or')?3600000:86400000;return new Date(now.getTime()+amount*ms).toISOString();}
  if(!date)return undefined;
  const afternoon=/\bpomeriggio\b/.test(lower),evening=/\bsera\b/.test(lower),morning=/\bmattina\b/.test(lower);
  date.setHours(time?Number(time[1]):evening?19:afternoon?15:morning?9:9,time?Number(time[2]??0):0,0,0);
  return date.toISOString();
}
function removeWhen(text:string){
  return text.replace(/\b(?:dopodomani|domani|oggi|prossim[oa]\s+(?:lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b(?:\s+(?:mattina|pomeriggio|sera))?/gi,'')
    .replace(/\b(?:alle|ore)\s*\d{1,2}(?:[:.]\d{2})?/gi,'')
    .replace(/\b(?:tra\s+\d+\s+(?:minut[oi]|or[ae]|giorn[oi]))\b/gi,'')
    .replace(/\b\d{1,2}\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+\d{4})?\b/gi,'')
    .replace(/\s+/g,' ').replace(/\s+([,.!?])/g,'$1').trim();
}
function stripKind(text:string){return text.replace(/\b(?:come|tipo|di tipo)\s+(?:evento|appuntamento|meeting|riunione|task|attivita|reminder|promemoria)\b/gi,'').trim();}
export function parseVoiceCommand(transcript:string):VoiceCommand|null{
  const raw=transcript.trim(),lower=normalize(raw);if(!raw)return null;
  let match=lower.match(/^(?:elimina|cancella|rimuovi|togli)\s+(?:l['’]?|il |la |un |una )?(?:attivit[aà]|evento|task|reminder)?\s*(?:chiamata|voce)?\s*(.+)$/);
  if(match)return{type:'delete',query:match[1].trim()};
  match=lower.match(/^(?:completa|termina|chiudi|fatto|segna\s+(?:come\s+)?complet[ao])\s+(?:l['’]?|il |la |un |una )?(?:attivit[aà]|evento|task|reminder)?\s*(.+)$/);
  if(match)return{type:'complete',query:match[1].trim()};
  match=lower.match(/^(?:rimanda|posticipa|sposta\s+di\s+un\s+giorno)\s+(?:l['’]?|il |la |un |una )?(?:attivit[aà]|evento|task|reminder)?\s*(.+)$/);
  if(match)return{type:'postpone',query:match[1].trim()};
  match=lower.match(/^(?:rinomina|ribattezza|cambia\s+(?:il\s+)?nome\s+(?:di|dell['’]?))\s+(.+?)\s+(?:in|come)\s+(.+)$/);
  if(match)return{type:'rename',query:match[1].trim(),title:match[2].trim()};
  match=lower.match(/^(?:sposta|rimetti|metti|fissa)\s+(.+?)\s+(?:a|per|su)\s+(.+)$/);
  if(match){const when=extractWhen(match[2]);if(when)return{type:'move',query:match[1].trim(),when};}
  const addMatch=raw.match(/^(?:aggiungi|crea|inserisci|registra|programma|pianifica|ricordami(?:\s+di)?|devo)\s+(.+)$/i);
  if(addMatch){
    const original=addMatch[1].trim(),normalizedOriginal=normalize(original);
    const when=extractWhen(original),title=stripKind(removeWhen(original));
    const kind=/\b(?:evento|appuntamento|meeting|riunione|calendar|calendario)\b/.test(normalizedOriginal)?'event':/\b(?:reminder|promemoria|ricordami)\b/.test(normalizedOriginal)?'reminder':'task';
    return{type:'add',title:title||original,kind,when};
  }
  return null;
}
export async function listenForVoiceCommand(locale='it-IT'):Promise<string|null>{
  if(Platform.OS==='web'){
    if(typeof window==='undefined')return null;
    const SpeechRecognition=(window as any).SpeechRecognition??(window as any).webkitSpeechRecognition;
    if(!SpeechRecognition)throw new Error('Il riconoscimento vocale non è disponibile su questo dispositivo.');
    const recognition=new SpeechRecognition();recognition.lang=locale;recognition.interimResults=false;recognition.maxAlternatives=3;
    return await new Promise<string|null>((resolve,reject)=>{let settled=false;recognition.onresult=(event:any)=>{if(!settled){settled=true;resolve(event.results?.[0]?.[0]?.transcript??null);}};recognition.onerror=(event:any)=>{if(!settled){settled=true;reject(new Error(`Riconoscimento vocale non riuscito: ${event?.error??'errore sconosciuto'}.`));}};recognition.onend=()=>{if(!settled){settled=true;resolve(null);}};recognition.start();});
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