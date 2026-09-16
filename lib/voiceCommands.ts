import { Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { recordDiagnostic } from './diagnostics';

export type VoiceCommand =
  | { type: 'add'; title: string; kind: 'task' | 'event' | 'reminder'; when?: string }
  | { type: 'delete'; query: string }
  | { type: 'complete'; query: string }
  | { type: 'postpone'; query: string }
  | { type: 'rename'; query: string; title: string }
  | { type: 'move'; query: string; when: string };

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('it-IT').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function extractWhen(text: string) {
  const lower = normalize(text);
  const now = new Date();
  if (/dopodomani/.test(lower)) now.setDate(now.getDate() + 2);
  else if (/domani/.test(lower)) now.setDate(now.getDate() + 1);
  else if (/oggi/.test(lower)) now.setDate(now.getDate());
  else return undefined;
  const time = lower.match(/(?:alle|ore)\s*(\d{1,2})(?::(\d{2}))?/);
  now.setHours(time ? Number(time[1]) : 9, time ? Number(time[2] ?? 0) : 0, 0, 0);
  return now.toISOString();
}

function removeWhen(text: string) {
  return text
    .replace(/\b(?:dopodomani|domani|oggi)\b(?:\s+(?:mattina|pomeriggio|sera))?/gi, '')
    .replace(/\b(?:alle|ore)\s*\d{1,2}(?::\d{2})?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const raw = transcript.trim();
  const lower = normalize(raw);
  if (!raw) return null;

  let match = lower.match(/^(?:elimina|cancella|rimuovi)\s+(?:l['’]?)?(?:attivita|evento|task|reminder)?\s*(.+)$/);
  if (match) return { type: 'delete', query: match[1].trim() };
  match = lower.match(/^(?:completa|termina|fatto|segna come completata?)\s+(?:l['’]?)?(?:attivita|task)?\s*(.+)$/);
  if (match) return { type: 'complete', query: match[1].trim() };
  match = lower.match(/^(?:rimanda|posticipa)\s+(?:l['’]?)?(?:attivita|task|evento)?\s*(.+)$/);
  if (match) return { type: 'postpone', query: match[1].trim() };
  match = lower.match(/^(?:rinomina|cambia il nome di|modifica)\s+(.+?)\s+(?:in|a)\s+(.+)$/);
  if (match) return { type: 'rename', query: match[1].trim(), title: match[2].trim() };
  match = lower.match(/^(?:sposta|metti)\s+(.+?)\s+(?:a|per)\s+(.+)$/);
  if (match) {
    const when = extractWhen(match[2]);
    if (when) return { type: 'move', query: match[1].trim(), when };
  }

  const addMatch = raw.match(/^(?:aggiungi|crea|inserisci|registra|devo)\s+(.+)$/i);
  if (addMatch) {
    const originalTitle = addMatch[1].trim();
    const when = extractWhen(originalTitle);
    const title = removeWhen(originalTitle)
      .replace(/\b(?:come|tipo)\s+(?:evento|appuntamento|task|attivita|reminder)\b/gi, '')
      .trim();
    const normalizedTitle = normalize(originalTitle);
    const kind = /\b(?:evento|appuntamento|meeting|riunione|calendar)\b/.test(normalizedTitle) ? 'event'
      : /\b(?:reminder|promemoria|ricordami)\b/.test(normalizedTitle) ? 'reminder'
      : 'task';
    return { type: 'add', title: title || originalTitle, kind, when };
  }
  return null;
}

export async function listenForVoiceCommand(locale = 'it-IT'): Promise<string | null> {
  if (Platform.OS !== 'android') {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) throw new Error('Il riconoscimento vocale non è disponibile su questo dispositivo.');
      const recognition = new SpeechRecognition();
      recognition.lang = locale;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      return await new Promise<string | null>((resolve, reject) => {
        recognition.onresult = (event: any) => resolve(event.results?.[0]?.[0]?.transcript ?? null);
        recognition.onerror = (event: any) => reject(new Error(`Riconoscimento vocale non riuscito: ${event?.error ?? 'errore sconosciuto'}.`));
        recognition.onend = () => resolve(null);
        recognition.start();
      });
    }
    throw new Error('Il microfono dei comandi vocali è disponibile nell’app Android.');
  }

  recordDiagnostic('voice-command-started', { locale });
  const result = await IntentLauncher.startActivityAsync('android.speech.action.RECOGNIZE_SPEECH', {
    extra: {
      'android.speech.extra.LANGUAGE_MODEL': 'free_form',
      'android.speech.extra.LANGUAGE': locale,
      'android.speech.extra.MAX_RESULTS': 3,
      'android.speech.extra.PROMPT': 'Cosa vuoi fare con FlowOS?',
    },
  });
  const values = result.extra?.['android.speech.extra.RESULTS'];
  const transcript = Array.isArray(values) ? String(values[0] ?? '') : null;
  recordDiagnostic('voice-command-finished', { resultCode: result.resultCode, hasTranscript: Boolean(transcript) });
  return transcript || null;
}
