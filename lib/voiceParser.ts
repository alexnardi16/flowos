import type { Commitment } from '../types';

export type VoiceCommand =
  | { type:'add'; title:string; kind:'task'|'event'; when?:string }
  | { type:'delete'; query:string }
  | { type:'complete'; query:string }
  | { type:'postpone'; query:string }
  | { type:'rename'; query:string; title:string }
  | { type:'move'; query:string; when:string }
  | { type:'remind'; query:string; minutesBefore:number };

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

function semanticParse(transcript:string):VoiceCommand|null{
  const raw=transcript.trim(), lower=normalizeVoiceText(raw);
  if(!raw)return null;
  const action=(patterns:RegExp[])=>patterns.some(pattern=>pattern.test(lower));
  const extractAfterAction=(patterns:RegExp[])=>{
    for(const pattern of patterns){const match=lower.match(pattern);if(match?.[1])return match[1].trim();}
    return '';
  };
  if(action([/\b(?:elimina|cancella|rimuovi|togli)\b/])){
    const query=cleanQuery(extractAfterAction([/(?:elimina|cancella|rimuovi|togli)\s+(?:la|il|lo|l['’])?\s*(?:attivita|evento|task|reminder|appuntamento)?\s*(.+)$/]));
    return query?{type:'delete',query}:null;
  }
  if(action([/\b(?:completa|termina|chiudi|finisci|fai|segna)\b.*\b(?:fatto|complet[ao])\b/,/^fatto\b/])){
    const query=cleanQuery(extractAfterAction([/(?:completa|termina|chiudi|finisci|segna(?:\s+come)?\s+fatto|fatto)\s+(?:la|il|lo|l['’])?\s*(?:attivita|evento|task|reminder|appuntamento)?\s*(.+)$/]));
    return query?{type:'complete',query}:null;
  }
  if(action([/\b(?:posticipa|rimanda|sposta)\b/])){
    const match=lower.match(/(?:posticipa|rimanda|sposta)\s+(?:la|il|lo|l['’])?\s*(?:attivita|evento|task|reminder|appuntamento)?\s*(.+?)\s+(?:a|per|su|in)\s+(.+)$/);
    if(match){const when=extractWhen(match[2]);const query=cleanQuery(match[1]);if(when&&query)return{type:'move',query,when};}
    const query=cleanQuery(extractAfterAction([/(?:posticipa|rimanda)\s+(?:la|il|lo|l['’])?\s*(?:attivita|evento|task|reminder|appuntamento)?\s*(.+)$/]));
    return query?{type:'postpone',query}:null;
  }
  const rename=lower.match(/(?:rinomina|ribattezza|cambia\s+(?:il\s+)?nome(?:\s+di|\s+a)?)\s+(.+?)\s+(?:in|come|con\s+il\s+nome)\s+(.+)$/);
  if(rename){const query=cleanQuery(rename[1]),title=stripKind(rename[2]);return query&&title?{type:'rename',query,title}:null;}
  if(action([/\b(?:sposta|metti|mettila|mettilo|fissa|programma)\b/])){
    const match=lower.match(/(?:sposta|metti|mettila|mettilo|fissa|programma)\s+(?:la|il|lo|l['’])?\s*(?:attivita|evento|task|reminder|appuntamento)?\s*(.+?)\s+(?:a|per|su|in)\s+(.+)$/);
    if(match){const when=extractWhen(match[2]);const query=cleanQuery(match[1]);if(when&&query)return{type:'move',query,when};}
  }
  const add=lower.match(/^(?:aggiungi|crea|inserisci|registra|programma|pianifica|ricordami(?:\s+di)?|devo|devo\s+ricordarmi\s+di)\s+(.+)$/);
  if(add){const original=raw.slice(raw.toLowerCase().indexOf(add[1])).trim();const when=extractWhen(original);const title=stripKind(removeWhen(original));const kind=/\b(?:evento|appuntamento|meeting|riunione|calendar|calendario)\b/.test(add[1])?'event':'task';return{type:'add',title:title||original,kind,when};}
  return null;
}

export function parseVoiceCommands(transcript:string):VoiceCommand[] {
  const parts=transcript.trim().split(/\\s+(?:e\\s+poi|e\\s+quindi|poi|e)\\s+(?=(?:aggiungi|crea|inserisci|registra|programma|pianifica|ricordami|devo|elimina|cancella|rimuovi|togli|completa|termina|chiudi|finisci|fatto|segna|posticipa|rimanda|sposta|metti|fissa|rinomina|ribattezza|cambia)\\b)/i).map(part=>part.trim()).filter(Boolean);
  if(parts.length<=1){const single=parseVoiceCommand(transcript);return single?[single]:[];}
  return parts.flatMap(part=>{const command=parseVoiceCommand(part);return command?[command]:[];});
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
    const kind=/\b(?:evento|appuntamento|meeting|riunione|calendar|calendario)\b/.test(normalizedOriginal)?'event':'task';
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
  const qTokens=q.split(' ').filter(token=>token.length>1);
  const scoreItem=(item:Commitment)=>{
    const title=normalizeVoiceText(item.title);
    const titleTokens=title.split(' ').filter(token=>token.length>1);
    let score=0;
    if(title.includes(q))score+=60;
    if(q.includes(title))score+=45;
    for(const qt of qTokens){
      if(titleTokens.includes(qt))score+=20;
      else if(titleTokens.some(tt=>tt.startsWith(qt)||qt.startsWith(tt)))score+=12;
      else if(titleTokens.some(tt=>editDistance(qt,tt)<=1))score+=8;
    }
    return score;
  };
  const ranked=active.map(item=>({item,score:scoreItem(item)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  if(!ranked.length)return null;
  if(ranked.length===1)return ranked[0].item;
  return ranked[0].score>=Math.max(35,ranked[1].score+8)?ranked[0].item:null;
}

function editDistance(a:string,b:string){
  const row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    let prev=row[0];row[0]=i;
    for(let j=1;j<=b.length;j++){
      const current=row[j];
      row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));
      prev=current;
    }
  }
  return row[b.length];
}

