import { Platform } from 'react-native';
import { recordDiagnostic } from './diagnostics';
import { parseVoiceCommand, findBestVoiceMatch, type VoiceCommand } from './voiceParser';

export { parseVoiceCommand, findBestVoiceMatch };
export type { VoiceCommand };

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
