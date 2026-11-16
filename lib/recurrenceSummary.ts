import { localeForLanguage, type Language } from './i18n';
import type { RecurrenceFrequency } from '../types';

export function formatRecurrenceSummary(frequency:RecurrenceFrequency,startDate:string,until:string,language:Language){
  const start=new Date(`${startDate}T12:00:00`);
  const untilDate=new Date(`${until}T12:00:00`);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(untilDate.getTime()))return '';
  const locale=localeForLanguage(language);
  const end=untilDate.toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric'});
  if(frequency==='weekly'){
    const weekday=start.toLocaleDateString(locale,{weekday:'long'});
    const prefix=language==='it'?'Ogni':language==='fr'?'Chaque':language==='es'?'Cada':'Every';
    return `${prefix} ${weekday} · ${end}`;
  }
  const labels:Record<RecurrenceFrequency,string>={
    daily:language==='it'?'Ogni giorno':language==='fr'?'Chaque jour':language==='es'?'Cada día':'Every day',
    weekly:language==='it'?'Ogni settimana':language==='fr'?'Chaque semaine':language==='es'?'Cada semana':'Every week',
    monthly:language==='it'?'Ogni mese':language==='fr'?'Chaque mois':language==='es'?'Cada mes':'Every month',
    yearly:language==='it'?'Ogni anno':language==='fr'?'Chaque année':language==='es'?'Cada año':'Every year',
  };
  return `${labels[frequency]} · ${end}`;
}
