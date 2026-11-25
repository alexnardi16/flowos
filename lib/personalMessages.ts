import type { Commitment } from '../types';
import { GOOGLE_BIRTHDAYS_CALENDAR_ID } from './contactEvents';

export type PersonalOccasionType = 'birthday' | 'anniversary';
export type PersonalOccasion = { item: Commitment; type: PersonalOccasionType; personName: string; date: Date };

const BIRTHDAY_RE = /\b(birthday|birth\s*day|compleanno|anniversaire|cumpleaños|cumpleanos)\b/i;
const ANNIVERSARY_RE = /\b(anniversary|anniversario|anniversaire de mariage|aniversario)\b/i;
const PREFIX_RE = /^(?:(?:birthday|birth\s*day|compleanno|anniversaire|cumpleaños|cumpleanos)(?:\s+(?:of|di|de|de la|de los))?\s*[:\-–]?\s*|(?:anniversary|anniversario|aniversario)(?:\s+(?:of|di|de|de la))?\s*[:\-–]?\s*)/i;
const SUFFIX_RE = /\s*(?:'s\s+)?(?:birthday|birth\s*day|compleanno|anniversaire|cumpleaños|cumpleanos|anniversary|anniversario|aniversario)\s*$/i;

export function classifyPersonalOccasion(item: Commitment): PersonalOccasionType | null {
  if (item.kind !== 'event' || item.deletedAt) return null;
  const title = item.title.trim();
  if (item.googleEventType === 'birthday' || item.googleCalendarId === GOOGLE_BIRTHDAYS_CALENDAR_ID || BIRTHDAY_RE.test(title)) return 'birthday';
  if (ANNIVERSARY_RE.test(title)) return 'anniversary';
  return null;
}

export function extractOccasionPersonName(title: string, type: PersonalOccasionType): string {
  const cleaned = title.trim().replace(PREFIX_RE, '').replace(SUFFIX_RE, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (!cleaned || /^(birthday|birth\s*day|compleanno|anniversaire|cumpleaños|cumpleanos|anniversary|anniversario|aniversario)$/i.test(cleaned)) return '';
  if (type === 'birthday' && /'s$/i.test(cleaned)) return cleaned.replace(/'s$/i, '').trim();
  return cleaned;
}

function nextAnnualDate(value: string | undefined, now: Date): Date | null {
  if (!value) return null;
  const source = new Date(value);
  if (!Number.isFinite(source.getTime())) return null;
  const next = new Date(now.getFullYear(), source.getMonth(), source.getDate(), source.getHours(), source.getMinutes());
  if (next.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) next.setFullYear(next.getFullYear() + 1);
  return next;
}

export function getUpcomingPersonalOccasions(items: Commitment[], now = new Date(), daysAhead = 366): PersonalOccasion[] {
  const end = now.getTime() + daysAhead * 86400000;
  const results: PersonalOccasion[] = [];
  for (const item of items) {
    const type = classifyPersonalOccasion(item);
    if (!type) continue;
    const date = nextAnnualDate(item.scheduledAt ?? item.dueAt, now);
    if (!date || date.getTime() < now.getTime() - 86400000 || date.getTime() > end) continue;
    results.push({ item, type, personName: extractOccasionPersonName(item.title, type), date });
  }
  return results.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function buildPersonalMessagePrompt(input: { occasion: PersonalOccasion; tone: string; channel: 'whatsapp' | 'email' | 'linkedin'; language: string }): string {
  const { occasion, tone, channel, language } = input;
  const locale = language === 'it' ? 'Italian' : language === 'fr' ? 'French' : language === 'es' ? 'Spanish' : 'English';
  const date = occasion.date.toLocaleDateString(language === 'it' ? 'it-IT' : language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US');
  const person = occasion.personName || occasion.item.title;
  return [
    'Write one ready-to-send personal message in ' + locale + '.',
    'Occasion: ' + occasion.type + '.',
    'Recipient name or event title: ' + person + '.',
    'Date: ' + date + '.',
    'Channel: ' + channel + '.',
    'Tone: ' + tone + '.',
    'Keep it natural, specific to the occasion, concise, and do not invent personal memories or facts.',
    'Return only the message text, without quotation marks, labels, or explanations.'
  ].join('\n');
}
