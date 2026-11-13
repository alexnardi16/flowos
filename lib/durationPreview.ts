import type { Language } from './i18n';

type Units = { day: [string,string]; hour: [string,string]; minute: [string,string]; join: string; comma: string };
const UNITS: Record<Language, Units> = {
  it: { day:['giorno','giorni'], hour:['ora','ore'], minute:['minuto','minuti'], join:' e ', comma:', ' },
  en: { day:['day','days'], hour:['hour','hours'], minute:['minute','minutes'], join:' ', comma:', ' },
  fr: { day:['jour','jours'], hour:['heure','heures'], minute:['minute','minutes'], join:' et ', comma:', ' },
  es: { day:['día','días'], hour:['hora','horas'], minute:['minuto','minutos'], join:' y ', comma:', ' },
};
export function formatDurationPreview(totalMinutes:number, language:Language):string {
  const total=Math.max(0,Math.round(totalMinutes));
  const units=UNITS[language];
  const days=Math.floor(total/1440), hours=Math.floor((total%1440)/60), minutes=total%60;
  const parts:string[]=[];
  if(days) parts.push(days+' '+units.day[days===1?0:1]);
  if(hours) parts.push(hours+' '+units.hour[hours===1?0:1]);
  if(minutes) parts.push(minutes+' '+units.minute[minutes===1?0:1]);
  if(parts.length<2) return parts[0]??'0 '+units.minute[1];
  if(parts.length===2) return parts.join(units.join);
  return parts[0]+units.comma+parts[1]+units.join+parts[2];
}
