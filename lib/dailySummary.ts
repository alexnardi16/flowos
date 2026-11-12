import type { Commitment } from '../types';
import { isSameCalendarDay } from './allDayDate';
import { isExpired } from './itemTiming';
import { getCurrentLanguage, localeForLanguage, type Language } from './i18n';

export type DailySummaryItem = {
  id: string;
  title: string;
  time?: string;
  kind: Commitment['kind'];
};

export type DailySummary = {
  dateKey: string;
  title: string;
  body: string;
  scheduledCount: number;
  overdueCount: number;
  items: DailySummaryItem[];
};

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildDailySummary(commitments: Commitment[], now: Date = new Date(), targetDate: Date = now, language: Language = getCurrentLanguage()): DailySummary {
  const dateKey = toDateKey(targetDate);
  const active = commitments.filter((item) => item.status !== 'done' && !item.deletedAt);
  const scheduledToday = active
    .filter((item) => {
      const value = item.scheduledAt ?? item.dueAt;
      return Boolean(value && isSameCalendarDay(item, value, targetDate));
    })
    .sort((a, b) => {
      const av = a.scheduledAt ?? a.dueAt;
      const bv = b.scheduledAt ?? b.dueAt;
      if (!av) return 1;
      if (!bv) return -1;
      return new Date(av).getTime() - new Date(bv).getTime();
    });

  const overdue = targetDate.getTime() <= now.getTime()
    ? active.filter((item) => item.dueAt && isExpired(item, now))
    : [];

  const items: DailySummaryItem[] = scheduledToday.map((item) => {
    const value = item.scheduledAt ?? item.dueAt;
    let time: string | undefined;
    // All-day commitments should show only their title, never "Tutto il giorno".
    // For timed commitments, show the interval using the item's configured duration.
    if (value && !item.allDay) {
      const start = new Date(value);
      if (!Number.isNaN(start.getTime())) {
        const end = new Date(start.getTime() + Math.max(1, item.durationMinutes || 1) * 60_000);
        const formatTime = (date: Date) => date.toLocaleTimeString(localeForLanguage(language), { hour: '2-digit', minute: '2-digit' });
        time = `${formatTime(start)} - ${formatTime(end)}`;
      }
    }
    return {
      id: item.id,
      title: item.title,
      time,
      kind: item.kind,
    };
  });

  const isTomorrow = dateKey !== toDateKey(now) && targetDate.getTime() > now.getTime();
  const copy = {
    it: { today: 'Oggi', tomorrow: 'Domani', commitmentOne: 'impegno', commitmentMany: 'impegni', noneToday: 'Nessun impegno pianificato per oggi', noneTomorrow: 'Nessun impegno pianificato per domani', overdue: 'in ritardo da recuperare.', freeToday: 'Giornata libera.', freeTomorrow: 'Mattina libera.' },
    en: { today: 'Today', tomorrow: 'Tomorrow', commitmentOne: 'commitment', commitmentMany: 'commitments', noneToday: 'No commitments planned for today', noneTomorrow: 'No commitments planned for tomorrow', overdue: 'overdue to catch up.', freeToday: 'A free day.', freeTomorrow: 'A free morning.' },
    fr: { today: 'Aujourd’hui', tomorrow: 'Demain', commitmentOne: 'engagement', commitmentMany: 'engagements', noneToday: 'Aucun engagement prévu pour aujourd’hui', noneTomorrow: 'Aucun engagement prévu pour demain', overdue: 'en retard à rattraper.', freeToday: 'Journée libre.', freeTomorrow: 'Matinée libre.' },
    es: { today: 'Hoy', tomorrow: 'Mañana', commitmentOne: 'compromiso', commitmentMany: 'compromisos', noneToday: 'No hay compromisos previstos para hoy', noneTomorrow: 'No hay compromisos previstos para mañana', overdue: 'atrasados por recuperar.', freeToday: 'Día libre.', freeTomorrow: 'Mañana libre.' },
  }[language];
  const title = scheduledToday.length
    ? language === 'it'
      ? `${isTomorrow ? copy.tomorrow : copy.today} hai ${scheduledToday.length} ${scheduledToday.length === 1 ? copy.commitmentOne : copy.commitmentMany}`
      : `${copy[isTomorrow ? 'tomorrow' : 'today']} · ${scheduledToday.length} ${scheduledToday.length === 1 ? copy.commitmentOne : copy.commitmentMany}`
    : isTomorrow ? copy.noneTomorrow : copy.noneToday;

  const bodyParts: string[] = [];
  if (items.length) {
    bodyParts.push(items.map((item, index) => `${index + 1}. ${item.time ? `${item.time} · ` : ''}${item.title}`).join('\\n'));
  }
  if (overdue.length) bodyParts.push(`${overdue.length} ${copy.overdue}`);
  if (!items.length && !overdue.length) bodyParts.push(isTomorrow ? copy.freeTomorrow : copy.freeToday);

  return { dateKey, title, body: bodyParts.join('\n'), scheduledCount: scheduledToday.length, overdueCount: overdue.length, items };
}
