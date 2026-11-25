import { FeedbackPressable as Pressable } from '@/components/FeedbackPressable';
import { useEffect, useState } from 'react';
import { AppState, Linking, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Button, Card, ScreenShell, palette, showAlert, showConfirm, useAppDensity } from '@/components/ui';
import { ProgressiveHint } from '@/components/ProgressiveHint';
import { clearDiagnostics, readDiagnostics, recordDiagnostic, subscribeDiagnostics, type DiagnosticEntry } from '@/lib/diagnostics';
import { deleteAllFlowOSOnlyData } from '@/lib/commitmentsRepository';
import { deleteFlowOSAccount } from '@/lib/account';
import { connectGoogleFromSession, disconnectGoogleWorkspace, getGoogleWorkspaceStatus, isSyncGenuinelyStale, recoverStaleGoogleSyncState, setCalendarSelected, setDefaultCalendar, setDefaultTaskList, setTaskListSelected, friendlyCalendarName, setSyncRange, signInWithGoogle, subscribeToSyncProgress, syncGoogleWorkspace, type GoogleWorkspaceStatus } from '@/lib/googleWorkspace';
import { buildDailySummary, type DailySummary } from '@/lib/dailySummary';
import { registerBackgroundSync, runDailySummaryRefresh, refreshNotificationsForLanguage, unregisterBackgroundSync, checkAndRecoverMissedDailySummary } from '@/lib/notificationSettingsBridge';
import { clearNotificationLog, getNotificationLog, subscribeNotificationLog, type NotificationLogEntry } from '@/lib/notificationLog';
import { DEFAULT_DAILY_SUMMARY_HOUR, DEFAULT_DAILY_SUMMARY_MINUTE, disableDailySummaryNotification, getDailySummaryTime, getLastRecoveryDateKey, isDailySummaryEnabledStored, NOTIFICATIONS_SUPPORTED_HERE, sendImmediateSummaryNotification, setDailySummaryEnabledStored, setDailySummaryTime } from '@/lib/notificationServiceBridge';
import { useFlowStore } from '@/lib/store';
import { useAuth } from '@/providers/AuthProvider';
import * as Application from 'expo-application';
import { LANGUAGES, localeForLanguage, t, useLanguage } from '@/lib/i18n';
import { syncTodayWidget } from '@/lib/widgetSync';
import { ACTIVITY_SOURCE_COLORS, defaultActivitySourceColor } from '@/lib/activityColors';
import { FLOWOS_AI_PROVIDERS, FLOWOS_AI_DEFAULT_SETTINGS, isFlowOSOwner, type FlowOSAIProviderId, type FlowOSAISettings } from '@/lib/flowosAIConfig';
import { deleteFlowOSAIAPIKey, hasFlowOSAIAPIKey, loadFlowOSAISettings, saveFlowOSAIAPIKey, saveFlowOSAISettings, testFlowOSAIConnection } from '@/lib/flowosAI';
import Constants from 'expo-constants';
import { DEFAULT_WIDGET_APPEARANCE, applyWidgetTheme, colorWithOpacity, contrastRatio, getWidgetAppearance, normalizeHexColor, resetWidgetAppearance, resetWidgetAppearanceCategory, saveWidgetAppearance, type WidgetAppearance, type WidgetTheme, type WidgetDensity } from '@/lib/widgetAppearance';

function syncDate(value?:string|null,language:import('@/lib/i18n').Language='it'){return value?new Date(value).toLocaleString(localeForLanguage(language),{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):t('mai sincronizzata',undefined,language);}
function logLine(entry:DiagnosticEntry){const time=new Date(entry.at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit',second:'2-digit'});return `${time} [${entry.level}] ${entry.event}${entry.details?` — ${entry.details}`:''}`;}
function notificationLogLine(entry:NotificationLogEntry){const time=new Date(entry.at).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});return `${time} [${entry.level}] ${entry.event}${entry.details?` — ${entry.details}`:''}`;}
const WIDGET_COLOR_SWATCHES=Object.freeze([...new Set(["#F1F4FF","#172033","#6658D3","#FFFFFF","#F3F4F7","#171A26","#F7F7FC","#7669E8","#9278C8","#302B3A","#F6F7FB","#FFF8F0",...ACTIVITY_SOURCE_COLORS,"#F5F5F5","#D9D9D9","#A6A6A6","#737373","#404040","#000000","#FCE4D6","#F4B183","#ED7D31","#C65911","#843C0C","#FFF2CC","#FFE699","#FFD966","#BF9000","#7F6000","#E2F0D9","#A9D18E","#70AD47","#548235","#375623","#DDEBF7","#9DC3E6","#5B9BD5","#2F75B5","#1F4E78","#D9EAD3","#A2D39B","#00A86B","#008080","#006666","#E4DFEC","#B4A7D6","#8064A2","#5F497A","#F4CCCC","#EA9999","#E06666","#CC0000","#990000","#CFE2F3","#6FA8DC","#3C78D8","#1155CC","#073763","#D0E0E3","#76A5AF","#45818E","#134F5C"])]);
function swatchHue(hex:string){const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255,max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;if(delta<0.015)return -1;let hue=0;if(max===r)hue=60*(((g-b)/delta)%6);else if(max===g)hue=60*((b-r)/delta+2);else hue=60*((r-g)/delta+4);return hue<0?hue+360:hue;}
function swatchLightness(hex:string){const v=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];}
const WIDGET_COLOR_SORTED=Object.freeze([...WIDGET_COLOR_SWATCHES,"#FFB3BA","#BAFFC9","#BAE1FF"].sort((a,b)=>{
  const hueA=swatchHue(a),hueB=swatchHue(b);
  const familyA=hueA<0?-1:Math.floor(hueA/45),familyB=hueB<0?-1:Math.floor(hueB/45);
  return familyA-familyB||swatchLightness(b)-swatchLightness(a)||a.localeCompare(b);
}).slice(0,64));
const WIDGET_COLOR_GRID=Object.freeze(Array.from({length:8},(_,row)=>WIDGET_COLOR_SORTED.slice(row*8,row*8+8)));
function normalizedSwatchColor(value:string){return value.trim().toUpperCase();}
function colorDisplayName(hex:string,language:string){
  const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
  const lightness=(max+min)/2;
  const saturation=delta===0?0:delta/(1-Math.abs(2*lightness-1));
  const names:Record<string,{white:string;black:string;gray:string;tones:[string,string,string];families:string[]}> = {
    it:{white:'Bianco',black:'Nero',gray:'Grigio',tones:['chiaro','medio','scuro'],families:['rosso','arancione','giallo','verde','turchese','azzurro','blu','viola','magenta','rosa']},
    en:{white:'White',black:'Black',gray:'Gray',tones:['light','medium','dark'],families:['red','orange','yellow','green','turquoise','cyan','blue','violet','magenta','pink']},
    fr:{white:'Blanc',black:'Noir',gray:'Gris',tones:['clair','moyen','foncé'],families:['rouge','orange','jaune','vert','turquoise','cyan','bleu','violet','magenta','rose']},
    es:{white:'Blanco',black:'Negro',gray:'Gris',tones:['claro','medio','oscuro'],families:['rojo','naranja','amarillo','verde','turquesa','cian','azul','violeta','magenta','rosa']}
  };
  const dictionary=names[language]??names.it;
  if(saturation<0.13){if(lightness>0.91)return dictionary.white;if(lightness<0.13)return dictionary.black;return dictionary.gray;}
  let hue=0;
  if(delta!==0){if(max===r)hue=60*(((g-b)/delta)%6);else if(max===g)hue=60*((b-r)/delta+2);else hue=60*((r-g)/delta+4);}
  if(hue<0)hue+=360;
  const familyIndex=hue<12||hue>=348?0:hue<42?1:hue<68?2:hue<155?3:hue<180?4:hue<205?5:hue<255?6:hue<290?7:hue<325?8:9;
  const toneIndex=lightness>0.78?0:lightness<0.3?2:1;
  return `${dictionary.families[familyIndex]} ${dictionary.tones[toneIndex]}`;
}
function ColorSwatches({value,onSelect,language}:{value:string;onSelect:(color:string)=>void;language:string}){
  const selected=normalizedSwatchColor(value);
  const selectedName=colorDisplayName(selected,language);
  return <View style={styles.colorPickerPanel}>
    <View style={styles.colorSwatchRows}>{WIDGET_COLOR_GRID.map((row,index)=><View key={index} style={styles.colorSwatchRow}>{row.map(color=><Pressable key={color} accessibilityRole="button" accessibilityLabel={colorDisplayName(color,language)} accessibilityState={{selected:selected===color}} onPress={()=>onSelect(color)} style={styles.colorSwatchTouch}><View style={[styles.colorSwatch,{backgroundColor:color},selected===color&&styles.colorSwatchSelected]}/></Pressable>)}</View>)}</View>
    <View style={styles.colorSelectionPreview}>
      <View style={[styles.colorSelectionDot,{backgroundColor:selected}]}/>
      <Text style={styles.colorSelectionName}>{selectedName}</Text>
      <View style={[styles.colorSelectionSample,{backgroundColor:selected}]}/>
    </View>
  </View>;
}
function OpacityField({label,value,onChange}:{label:string;value:number;onChange:(value:string)=>void}){return <View style={styles.opacityField}><Text style={[styles.meta,styles.opacityLabel]}>{label}</Text><TextInput value={String(value)} onChangeText={onChange} keyboardType="numeric" maxLength={3} style={[styles.colorInput,styles.opacityInput]}/></View>;}
function timeLabel(hour:number,minute:number){return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;}
function deviceTimeZone(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'fuso orario locale';}catch{return'fuso orario locale';}}
function missingAuth(status:GoogleWorkspaceStatus|null,error:string|null){return /google account is not connected|account google non.*collegato|google authorization expired|unable to refresh google token|autorizzazione google.*ripristinata/i.test(`${status?.connection?.last_sync_error??''} ${error??''}`);}

export default function Me(){
  const[google,setGoogle]=useState<GoogleWorkspaceStatus|null>(null);
  const[busy,setBusy]=useState(false);
  const[reconnecting,setReconnecting]=useState(false);
  const[error,setError]=useState<string|null>(null);
  const[progress,setProgress]=useState(0);
  const[stage,setStage]=useState('');
  const[logs,setLogs]=useState<DiagnosticEntry[]>([]);
  const[showLogs,setShowLogs]=useState(true);
  const[rangeStart,setRangeStart]=useState('');
  const[rangeEnd,setRangeEnd]=useState('');
  const[notificationsEnabled,setNotificationsEnabled]=useState(true);
  const[notificationBusy,setNotificationBusy]=useState(false);
  const[notificationPermissionStatus,setNotificationPermissionStatus]=useState<'granted'|'denied'|'unknown'>('unknown');
  const[lastRecovery,setLastRecovery]=useState<string|null>(null);
  const[notificationLogs,setNotificationLogs]=useState<NotificationLogEntry[]>([]);
  const[showNotificationLogs,setShowNotificationLogs]=useState(true);
  const[summaryHour,setSummaryHour]=useState(DEFAULT_DAILY_SUMMARY_HOUR);
  const[summaryMinute,setSummaryMinute]=useState(DEFAULT_DAILY_SUMMARY_MINUTE);
  const[timePickerOpen,setTimePickerOpen]=useState(false);
  const[timeSaving,setTimeSaving]=useState(false);
  const { language, setLanguage } = useLanguage();
  const { setDensity, setAppTheme, setAppFontSize } = useAppDensity();
  const [languageBusy,setLanguageBusy]=useState(false);
  const [widgetAppearance,setWidgetAppearance]=useState<WidgetAppearance>(DEFAULT_WIDGET_APPEARANCE);
  const [widgetAppearanceBusy,setWidgetAppearanceBusy]=useState(false);
  const [settingsQuery,setSettingsQuery]=useState('');
  const [widgetPersonalizationOpen,setWidgetPersonalizationOpen]=useState(false);
  const [flowosAISettings,setFlowosAISettings]=useState<FlowOSAISettings>(FLOWOS_AI_DEFAULT_SETTINGS);
  const [flowosAIApiKey,setFlowosAIApiKey]=useState('');
  const [flowosAIKeySaved,setFlowosAIKeySaved]=useState(false);
  const [flowosAIBusy,setFlowosAIBusy]=useState(false);
  const [flowosAIStatus,setFlowosAIStatus]=useState('');
  const [flowosAIOwner,setFlowosAIOwner]=useState(false);

  const commitments=useFlowStore(state=>state.commitments);
  const hydrate=useFlowStore(s=>s.hydrateFromCloud);
  const{session,signOut}=useAuth();
  const timeZone=deviceTimeZone();

  async function loadGoogle(repair=true){
    try{
      const status=await getGoogleWorkspaceStatus();
      if(repair&&!busy&&isSyncGenuinelyStale(status.connection)){
        await recoverStaleGoogleSyncState();
        const recovered=await getGoogleWorkspaceStatus();
        setGoogle(recovered);
        if(missingAuth(recovered,null)){
          const message='Autorizzazione Google scaduta. Prima clicca "Scollega Google", poi clicca "Ricollega Google".';
          setError(message);recordDiagnostic('google-reconnect-required',{message},'warn');
        }else setError(recovered.connection?.last_sync_status==='error'?recovered.connection.last_sync_error??null:null);
      }else{
        setGoogle(status);
        if(missingAuth(status,null)){
          const message='Autorizzazione Google scaduta. Prima clicca "Scollega Google", poi clicca "Ricollega Google".';
          setError(message);recordDiagnostic('google-reconnect-required',{message},'warn');
        }else setError(status.connection?.last_sync_status==='error'?status.connection.last_sync_error??null:null);
      }
    }catch(e){
      const message=e instanceof Error?e.message:'Impossibile leggere lo stato Google.';
      setError(message);recordDiagnostic('google-status-load-failed',{message},'error');
    }
  }

  useEffect(()=>{void loadGoogle();const u=subscribeDiagnostics(e=>setLogs([...e].reverse()));return u;},[]);
  useEffect(()=>{let active=true;void (async()=>{try{const saved=await loadFlowOSAISettings(),keyExists=await hasFlowOSAIAPIKey(saved.provider);if(!active)return;setFlowosAISettings(saved);setFlowosAIKeySaved(keyExists);const ownerId=String(Constants.expoConfig?.extra?.flowosOwnerUserId??'');setFlowosAIOwner(isFlowOSOwner(session?.user.id,ownerId));}catch(e){if(active)setFlowosAIStatus(e instanceof Error?e.message:'Impossibile caricare FlowOS AI.');}})();return()=>{active=false;};},[session?.user.id]);
  useEffect(()=>{if(google?.range){const toInput=(v:string)=>{const[d,m,y]=v.split('/');return `${d}-${m}-${y}`;};setRangeStart(toInput(google.range.labelStart));setRangeEnd(toInput(google.range.labelEnd));}},[google?.range?.labelStart,google?.range?.labelEnd]);
  useEffect(()=>{const u=subscribeToSyncProgress(p=>{setProgress(p.percent);setStage(p.stage);});return u;},[]);
  useEffect(()=>{void getWidgetAppearance().then(setWidgetAppearance);},[]);

  useEffect(()=>{const refresh=()=>{if(!NOTIFICATIONS_SUPPORTED_HERE)return;void Notifications.getPermissionsAsync().then(result=>{setNotificationPermissionStatus(result.granted?'granted':'denied');}).catch(()=>setNotificationPermissionStatus('unknown'));};refresh();const subscription=AppState.addEventListener('change',state=>{if(state==='active')refresh();});return()=>subscription.remove();},[]);

  useEffect(()=>{
    void isDailySummaryEnabledStored().then(setNotificationsEnabled);
    void getDailySummaryTime().then(({hour,minute})=>{setSummaryHour(hour);setSummaryMinute(minute);});
    void getLastRecoveryDateKey().then(setLastRecovery);
    const unsubscribe=subscribeNotificationLog(setNotificationLogs);
    void getNotificationLog().then(setNotificationLogs);
    return unsubscribe;
  },[]);

  async function manageNotificationPermission(){
    if(!NOTIFICATIONS_SUPPORTED_HERE){showAlert(t('Notifiche'),t('Notifiche non supportate su questa piattaforma.'));return;}
    try{
      const current=await Notifications.getPermissionsAsync();
      if(!current.granted&&current.canAskAgain){const requested=await Notifications.requestPermissionsAsync();setNotificationPermissionStatus(requested.granted?'granted':'denied');return;}
      await Linking.openSettings();
    }catch(error){showAlert(t('Notifiche'),error instanceof Error?error.message:'Impossibile aprire le impostazioni delle notifiche.');}
  }

  function updateWidgetSection(section:'today'|'calendar',field:'backgroundColor'|'backgroundOpacity'|'textColor'|'textOpacity'|'buttonBackgroundColor'|'buttonBackgroundOpacity'|'buttonTextColor'|'buttonTextOpacity',value:string|number){
    setWidgetAppearance(current=>({...current,[section]:{...current[section],[field]:field.endsWith('Opacity')?Math.max(0,Math.min(100,Number(value)||0)):String(value)}}));
  }
  function updateSourceAppearance(key:string,field:'color'|'opacity',value:string|number,fallbackColor:string){
    setWidgetAppearance(current=>({...current,sources:{...current.sources,[key]:{color:field==='color'?String(value):(current.sources[key]?.color??fallbackColor),opacity:field==='opacity'?Math.max(0,Math.min(100,Number(value)||0)):(current.sources[key]?.opacity??100)}}}));
  }
  async function saveAppearance(){
    if(widgetAppearanceBusy)return;
    setWidgetAppearanceBusy(true);
    try{const sanitized:WidgetAppearance={appTheme:widgetAppearance.appTheme,appFontSize:widgetAppearance.appFontSize,theme:widgetAppearance.theme,density:widgetAppearance.density,todayTransparentUnusedSpace:widgetAppearance.todayTransparentUnusedSpace,showCompletedCalendarEvents:widgetAppearance.showCompletedCalendarEvents,showCompletedCalendarTasks:widgetAppearance.showCompletedCalendarTasks,today:{...widgetAppearance.today,backgroundColor:normalizeHexColor(widgetAppearance.today.backgroundColor),textColor:normalizeHexColor(widgetAppearance.today.textColor,'#172033'),textOpacity:Math.max(0,Math.min(100,Number(widgetAppearance.today.textOpacity)||0)),buttonBackgroundOpacity:Math.max(0,Math.min(100,Number(widgetAppearance.today.buttonBackgroundOpacity)||0)),buttonTextOpacity:Math.max(0,Math.min(100,Number(widgetAppearance.today.buttonTextOpacity)||0)),backgroundOpacity:Math.max(0,Math.min(100,Number(widgetAppearance.today.backgroundOpacity)||0)),buttonBackgroundColor:normalizeHexColor(widgetAppearance.today.buttonBackgroundColor,'#6658D3'),buttonTextColor:normalizeHexColor(widgetAppearance.today.buttonTextColor,'#FFFFFF')},calendar:{...widgetAppearance.calendar,backgroundColor:normalizeHexColor(widgetAppearance.calendar.backgroundColor),textColor:normalizeHexColor(widgetAppearance.calendar.textColor,'#172033'),textOpacity:Math.max(0,Math.min(100,Number(widgetAppearance.calendar.textOpacity)||0)),buttonBackgroundOpacity:Math.max(0,Math.min(100,Number(widgetAppearance.calendar.buttonBackgroundOpacity)||0)),buttonTextOpacity:Math.max(0,Math.min(100,Number(widgetAppearance.calendar.buttonTextOpacity)||0)),backgroundOpacity:Math.max(0,Math.min(100,Number(widgetAppearance.calendar.backgroundOpacity)||0)),buttonBackgroundColor:normalizeHexColor(widgetAppearance.calendar.buttonBackgroundColor,'#6658D3'),buttonTextColor:normalizeHexColor(widgetAppearance.calendar.buttonTextColor,'#FFFFFF')},sources:Object.fromEntries(Object.entries(widgetAppearance.sources).map(([key,value])=>[key,{color:normalizeHexColor(value.color),opacity:Math.max(0,Math.min(100,Number(value.opacity)||0))}]))};setWidgetAppearance(sanitized);await saveWidgetAppearance(sanitized);setDensity(sanitized.density);setAppTheme(sanitized.appTheme);setAppFontSize(sanitized.appFontSize);await syncTodayWidget(commitments);showAlert('Widget',t('Personalizzazione salvata.'));}
    catch(e){showAlert('Widget',e instanceof Error?e.message:'Salvataggio non riuscito.');}
    finally{setWidgetAppearanceBusy(false);}
  }
  function chooseWidgetTheme(theme:WidgetTheme){setWidgetAppearance(current=>applyWidgetTheme(current,theme));}
  function chooseWidgetDensity(density:WidgetDensity){setWidgetAppearance(current=>({...current,density}));}
  async function resetWidgetCategory(section:'today'|'calendar'){
    const next=resetWidgetAppearanceCategory(widgetAppearance,section);setWidgetAppearance(next);
    try{await saveWidgetAppearance(next);setDensity(next.density);await syncTodayWidget(commitments);}catch(e){showAlert('Widget',e instanceof Error?e.message:'Ripristino non riuscito.');}
  }

  async function restoreAppearanceDefaults(){
    if(widgetAppearanceBusy)return;
    setWidgetAppearanceBusy(true);
    try{const defaults=await resetWidgetAppearance();setWidgetAppearance(defaults);setDensity(defaults.density);setAppTheme(defaults.appTheme);setAppFontSize(defaults.appFontSize);await syncTodayWidget(commitments);showAlert('Widget',t('Valori predefiniti ripristinati.'));}
    catch(e){showAlert('Widget',e instanceof Error?e.message:'Ripristino non riuscito.');}
    finally{setWidgetAppearanceBusy(false);}
  }

  async function run(action:()=>Promise<unknown>){
    if(busy)return;
    setBusy(true);setError(null);
    try{await action();await loadGoogle(false);}
    catch(e){
      const message=e instanceof Error?e.message:'Operazione Google non riuscita.';
      setError(message);recordDiagnostic('google-operation-failed',{message},'error');showAlert('Google Workspace',message);
    }finally{setBusy(false);}
  }

  async function reconnectGoogle(){
    if(busy)return;
    setBusy(true);setReconnecting(true);setError(null);
    recordDiagnostic('google-explicit-reconnect-started',{message:'Per ripristinare Google: Scollega Google, poi Ricollega Google.'});
    try{
      await signInWithGoogle();
      for(let attempt=0;attempt<8;attempt++){
        await new Promise(resolve=>setTimeout(resolve,1000));
        const status=await getGoogleWorkspaceStatus();
        setGoogle(status);
        if(status.connection&&status.connection.last_sync_status!=='disconnected'&&!missingAuth(status,null)){
          setError(null);recordDiagnostic('google-explicit-reconnect-succeeded');break;
        }
        if(attempt===7){
          const message='Ricollegamento Google non ancora completato. Se l’autorizzazione resta scaduta, clicca prima "Scollega Google", poi "Ricollega Google".';
          setError(message);recordDiagnostic('google-explicit-reconnect-not-confirmed',{message},'warn');
        }
      }
    }catch(e){
      const message=e instanceof Error?e.message:'Ricollegamento Google non riuscito.';
      setError(message);recordDiagnostic('google-explicit-reconnect-failed',{message},'error');showAlert('Google Workspace',message);
    }finally{setReconnecting(false);setBusy(false);await loadGoogle(false);}
  }

  async function sync(){
    if(busy)return;
    setBusy(true);setError(null);setProgress(1);setStage('Avvio della sincronizzazione');
    try{
      if(session?.provider_token)await connectGoogleFromSession(session,true);
      await syncGoogleWorkspace(p=>{setProgress(p.percent);setStage(p.stage);});
      await hydrate();await loadGoogle(false);
    }catch(e){
      const message=e instanceof Error?e.message:'Sincronizzazione non riuscita.';
      setError(message);recordDiagnostic('sync-ui-failed',{message},'error');showAlert('Sincronizzazione Google',message);await loadGoogle(false);
    }finally{setBusy(false);setTimeout(()=>{setProgress(0);setStage('');},1500);}
  }

  async function saveRange(){
    const iso=(v:string)=>{const[d,m,y]=v.split('-');return d&&m&&y?`${y}-${m}-${d}`:null;};
    const start=iso(rangeStart),end=iso(rangeEnd);
    if(!start||!end){showAlert('Google Workspace','Usa il formato GG-MM-AAAA.');return;}
    await run(async()=>{await setSyncRange(start,end);});
  }

  async function toggleNotifications(value:boolean){
    if(notificationBusy)return;
    setNotificationBusy(true);
    const previous=notificationsEnabled;
    setNotificationsEnabled(value);
    try{
      await setDailySummaryEnabledStored(value);
      if(value){
        await registerBackgroundSync();
        await runDailySummaryRefresh();
        await checkAndRecoverMissedDailySummary();
      }else{
        await unregisterBackgroundSync();
        await disableDailySummaryNotification();
      }
    }catch(e){
      setNotificationsEnabled(previous);await setDailySummaryEnabledStored(previous);
      showAlert('Notifiche',e instanceof Error?e.message:'Operazione non riuscita.');
    }finally{setNotificationBusy(false);}
  }

  async function saveSummaryTime(){
    setTimeSaving(true);
    try{
      await setDailySummaryTime(summaryHour,summaryMinute);
      if(notificationsEnabled)await runDailySummaryRefresh();
      setTimePickerOpen(false);
      showAlert('Riepilogo giornaliero',`Orario impostato alle ${timeLabel(summaryHour,summaryMinute)} (${timeZone}).`);
    }catch(e){showAlert('Riepilogo giornaliero',e instanceof Error?e.message:'Salvataggio non riuscito.');}
    finally{setTimeSaving(false);}
  }

  async function sendNowNotifications(){
    if(!NOTIFICATIONS_SUPPORTED_HERE){
      showAlert('Notifiche',"Le notifiche non sono supportate nel browser web. Prova dall'app installata su telefono.");
      return;
    }
    setNotificationBusy(true);
    try{
      const summary:DailySummary=buildDailySummary(commitments,new Date(),new Date(),language);
      const identifier=await sendImmediateSummaryNotification(summary,false);
      if(identifier)showAlert('Notifiche','Notifica inviata.');
      else showAlert('Notifiche','Invio non riuscito: permesso notifiche non concesso. Controlla le impostazioni del telefono.');
    }catch(e){showAlert('Notifiche',e instanceof Error?e.message:'Invio non riuscito.');}
    finally{setNotificationBusy(false);}
  }

  async function copyNotificationLogs(){
    const text=notificationLogs.map(notificationLogLine).join('\n');
    if(!text){showAlert('Notifiche','Non ci sono log da copiare.');return;}
    await Clipboard.setStringAsync(text);showAlert('Notifiche','Log copiato.');
  }

  function clearNotificationLogs(){void clearNotificationLog();showAlert('Notifiche','Log ripulito.');}

  async function wipe(){
    if(busy)return;
    const ok=await showConfirm('Eliminare ogni attività su FlowOS?','Le attività vengono eliminate solo da FlowOS. Google Calendar e Google Tasks non vengono modificati.','Elimina tutto');
    if(!ok)return;
    setBusy(true);
    try{await deleteAllFlowOSOnlyData();await hydrate();showAlert('FlowOS','Attività eliminate da FlowOS.');}
    catch(e){showAlert('FlowOS',e instanceof Error?e.message:'Eliminazione non riuscita.');}
    finally{setBusy(false);}
  }

  async function deleteAccount(){
    if(busy)return;
    const ok=await showConfirm('Eliminare definitivamente l’account FlowOS?','L’operazione è irreversibile.','Elimina definitivamente');
    if(!ok)return;
    setBusy(true);
    try{await deleteFlowOSAccount();router.replace('/login');}
    catch(e){showAlert('FlowOS',e instanceof Error?e.message:'Eliminazione account non riuscita.');}
    finally{setBusy(false);}
  }

  async function logout(){
    if(busy)return;
    try{await signOut();router.replace('/login');}
    catch(e){showAlert('FlowOS',e instanceof Error?e.message:'Logout non riuscito.');}
  }

  async function copyLogs(){
    const entries=readDiagnostics();
    const text=`FlowOS ${Application.nativeApplicationVersion??'unknown'} · versionCode ${Application.nativeBuildVersion??'unknown'}\n${entries.map(logLine).join('\n')}`;
    if(!entries.length){showAlert('Logger','Nessun log disponibile.');return;}
    await Clipboard.setStringAsync(text);showAlert('Logger','Log copiato.');
  }

  async function persistFlowosAISettings(next:FlowOSAISettings){setFlowosAIBusy(true);try{await saveFlowOSAISettings(next);setFlowosAISettings(next);setFlowosAIStatus('');}catch(e){showAlert(t('FlowOS AI'),e instanceof Error?e.message:'Salvataggio impostazioni AI non riuscito.');}finally{setFlowosAIBusy(false);}}
  async function changeFlowosAIProvider(provider:FlowOSAIProviderId){const p=FLOWOS_AI_PROVIDERS.find(x=>x.id===provider),next={...flowosAISettings,provider,model:p?.defaultModel??'',enabled:false};await persistFlowosAISettings(next);setFlowosAIKeySaved(await hasFlowOSAIAPIKey(provider));}
  async function saveFlowosAIKey(){if(flowosAIBusy)return;setFlowosAIBusy(true);try{await saveFlowOSAIAPIKey(flowosAISettings.provider,flowosAIApiKey);setFlowosAIApiKey('');setFlowosAIKeySaved(true);setFlowosAIStatus(t('API key salvata.'));}catch(e){showAlert(t('FlowOS AI'),e instanceof Error?e.message:t('Inserisci una API key valida.'));}finally{setFlowosAIBusy(false);}}
  async function removeFlowosAIKey(){if(flowosAIBusy)return;setFlowosAIBusy(true);try{await deleteFlowOSAIAPIKey(flowosAISettings.provider);const next={...flowosAISettings,enabled:false};await saveFlowOSAISettings(next);setFlowosAISettings(next);setFlowosAIKeySaved(false);setFlowosAIStatus(t('API key eliminata.'));}catch(e){showAlert(t('FlowOS AI'),e instanceof Error?e.message:'Eliminazione API key non riuscita.');}finally{setFlowosAIBusy(false);}}
  async function toggleFlowosAI(enabled:boolean){if(enabled&&!flowosAIKeySaved){showAlert(t('FlowOS AI'),t('La API key non è ancora configurata. Salvala prima di attivare FlowOS AI.'));return;}await persistFlowosAISettings({...flowosAISettings,enabled});}
  async function testFlowosAI(){if(flowosAIBusy)return;setFlowosAIBusy(true);setFlowosAIStatus('');try{const result=await testFlowOSAIConnection(flowosAISettings);setFlowosAIStatus(result.trim()||t('Connessione AI verificata.'));}catch(e){showAlert(t('FlowOS AI'),e instanceof Error?e.message:'Verifica della connessione AI non riuscita.');}finally{setFlowosAIBusy(false);}}
  async function updateFlowosAIModel(model:string){const next={...flowosAISettings,model};setFlowosAISettings(next);try{await saveFlowOSAISettings(next);}catch(e){showAlert(t('FlowOS AI'),e instanceof Error?e.message:'Salvataggio modello AI non riuscito.');}}

  const authMissing=missingAuth(google,error);
  const connected=Boolean(google?.connection&&google.connection.last_sync_status!=='disconnected'&&!authMissing);
  const normalizedSettingsQuery=settingsQuery.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const showSettingsSection=(_category:string,keywords:string)=>!normalizedSettingsQuery||keywords.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(normalizedSettingsQuery);
  const hasSettingsMatch=[['ai','flowos ai intelligenza artificiale provider api key modello gemini openai claude mistral groq xai openrouter'],['appearance','lingua language aspetto dimensione caratteri font size testo'],['calendar','calendario eventi completati visibilità passato google calendar'],['widgets','widget personalizzazione temi densità colori anteprima'],['google','google sincronizzazione calendari tasks'],['notifications','notifiche reminder riepilogo permessi android sistema activity reminders'],['diagnostics','diagnostica log errori avvisi'],['account','account privacy dati logout']].some(([category,keywords])=>showSettingsSection(category,keywords));
  const syncStatusColor=google?.connection?.last_sync_status==='ok'?palette.success:google?.connection?.last_sync_status==='error'?palette.danger:google?.connection?.last_sync_status==='syncing'?palette.info:palette.muted;
  const diagnosticErrors=logs.filter(entry=>entry.level==='error').length;
  const diagnosticWarnings=logs.filter(entry=>entry.level==='warn').length;
  const diagnosticInfo=logs.filter(entry=>entry.level==='info').length;
  const todayContrast=Math.min(contrastRatio(widgetAppearance.today.textColor,widgetAppearance.today.backgroundColor),contrastRatio(widgetAppearance.today.buttonTextColor,widgetAppearance.today.buttonBackgroundColor));
  const calendarContrast=Math.min(contrastRatio(widgetAppearance.calendar.textColor,widgetAppearance.calendar.backgroundColor),contrastRatio(widgetAppearance.calendar.buttonTextColor,widgetAppearance.calendar.buttonBackgroundColor));
  const todayContrastReliable=[widgetAppearance.today.backgroundOpacity,widgetAppearance.today.textOpacity,widgetAppearance.today.buttonBackgroundOpacity,widgetAppearance.today.buttonTextOpacity].every(value=>value===100);
  const calendarContrastReliable=[widgetAppearance.calendar.backgroundOpacity,widgetAppearance.calendar.textOpacity,widgetAppearance.calendar.buttonBackgroundOpacity,widgetAppearance.calendar.buttonTextOpacity].every(value=>value===100);

  return <ScreenShell title={t('Impostazioni')}>
    <Card style={styles.settingsSearchCard}>
      <TextInput value={settingsQuery} onChangeText={setSettingsQuery} placeholder={t('Cerca impostazioni')} placeholderTextColor={palette.muted} style={styles.settingsSearchInput} accessibilityLabel={t('Cerca impostazioni')}/>
    </Card>
    {!hasSettingsMatch?<Text style={styles.meta}>{t('Nessuna impostazione trovata.')}</Text>:null}
    <Card style={{display:showSettingsSection('appearance','lingua language aspetto dimensione caratteri font size testo')?'flex':'none'}}>
      <Text style={styles.label}>{t('Lingua')}</Text>
      <Text style={styles.meta}>{t('Lingua app e widget')}</Text>
      <View style={styles.languageGrid}>{LANGUAGES.map(option=><Pressable key={option.code} onPress={()=>{void (async()=>{if(languageBusy)return;setLanguageBusy(true);try{await setLanguage(option.code);await syncTodayWidget(commitments);await refreshNotificationsForLanguage(commitments,option.code);}finally{setLanguageBusy(false);}})();}} style={[styles.languageOption,language===option.code&&styles.languageOptionActive]}><Text style={[styles.languageOptionText,language===option.code&&styles.languageOptionTextActive]}>{option.label}</Text></Pressable>)}</View> 
     </Card>
    <Card style={{display:showSettingsSection('appearance','tema applicazione chiaro scuro automatico app appearance theme dark light system')?'flex':'none'}}>
      <Text style={styles.label}>{t('Aspetto applicazione')}</Text><Text style={styles.meta}>{t('Scegli il tema chiaro, scuro o automatico in base al dispositivo.')}</Text>
      <View style={styles.presetRow}>{([{id:'system',label:'Tema automatico'},{id:'light',label:'Chiaro'},{id:'dark',label:'Scuro'}] as const).map(option=><Pressable key={option.id} accessibilityRole="button" accessibilityState={{selected:widgetAppearance.appTheme===option.id}} onPress={()=>setWidgetAppearance(current=>({...current,appTheme:option.id}))} style={[styles.presetChip,widgetAppearance.appTheme===option.id&&styles.presetChipActive]}><Text style={[styles.presetChipText,widgetAppearance.appTheme===option.id&&styles.presetChipTextActive]}>{t(option.label)}</Text></Pressable>)}</View>
      <Text style={styles.meta}>{t('Tema attivo')}: {t(widgetAppearance.appTheme==='system'?'Tema automatico':widgetAppearance.appTheme==='light'?'Chiaro':'Scuro')}</Text>
      <Text style={styles.meta}>{t('Dimensione caratteri attiva')}: {t(widgetAppearance.appFontSize==='small'?'Piccola':widgetAppearance.appFontSize==='large'?'Grande':'Standard')}</Text>
      <Text style={styles.item}>{t('Dimensione caratteri')}</Text><View style={styles.presetRow}>{([{id:'small',label:'Piccola'},{id:'standard',label:'Standard'},{id:'large',label:'Grande'}] as const).map(option=><Pressable key={option.id} accessibilityRole="button" accessibilityState={{selected:widgetAppearance.appFontSize===option.id}} onPress={()=>setWidgetAppearance(current=>({...current,appFontSize:option.id}))} style={[styles.presetChip,widgetAppearance.appFontSize===option.id&&styles.presetChipActive]}><Text style={[styles.presetChipText,widgetAppearance.appFontSize===option.id&&styles.presetChipTextActive]}>{t(option.label)}</Text></Pressable>)}</View>
      <Button label={t('Salva aspetto')} onPress={()=>void saveAppearance()} loading={widgetAppearanceBusy}/>
    </Card>

    <Card style={{display:showSettingsSection('ai','flowos ai intelligenza artificiale provider api key modello gemini openai claude mistral groq xai openrouter')?'flex':'none'}}>
      <Text style={styles.label}>{t('FlowOS AI')}</Text>
      <Text style={styles.meta}>{t('Attiva FlowOS AI per aggiungere funzionalità basate sull’intelligenza artificiale. Se è disattivata, FlowOS continua a funzionare esattamente come prima.')}</Text>
      <View style={styles.resource}><View style={styles.resourceText}><Text style={styles.item}>{t('FlowOS AI')}</Text><Text style={styles.meta}>{flowosAISettings.enabled?'ON':'OFF'}</Text></View><Switch value={flowosAISettings.enabled} onValueChange={v=>{void toggleFlowosAI(v);}} disabled={flowosAIBusy}/></View>
      <Text style={styles.meta}>{t('FlowOS AI include interpretazione dei comandi vocali, messaggi per compleanni e anniversari, ricerca web, confronto prodotti e bozze di comunicazioni professionali.')}</Text>
      <Text style={styles.item}>{t('Provider AI')}</Text><View style={styles.presetRow}>{FLOWOS_AI_PROVIDERS.map(p=><Pressable key={p.id} accessibilityRole="button" accessibilityState={{selected:flowosAISettings.provider===p.id}} onPress={()=>{void changeFlowosAIProvider(p.id);}} style={[styles.presetChip,flowosAISettings.provider===p.id&&styles.presetChipActive]}><Text style={[styles.presetChipText,flowosAISettings.provider===p.id&&styles.presetChipTextActive]}>{p.label}</Text></Pressable>)}</View>
      <Text style={styles.item}>{t('Modello AI')}</Text><Text style={styles.meta}>{t('Inserisci il nome esatto del modello disponibile presso il provider.')}</Text><TextInput value={flowosAISettings.model} onChangeText={v=>{void updateFlowosAIModel(v);}} placeholder={flowosAISettings.provider==='gemini'?'gemini-3.8-flash':'model-id'} autoCapitalize="none" autoCorrect={false} style={styles.input}/>
      {flowosAISettings.provider==='custom'?<><Text style={styles.item}>{t('Endpoint personalizzato (HTTPS)')}</Text><TextInput value={flowosAISettings.customBaseUrl} onChangeText={v=>{const n={...flowosAISettings,customBaseUrl:v};setFlowosAISettings(n);void saveFlowOSAISettings(n);}} placeholder="https://provider.example/v1" autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input}/></>:null}
      <Text style={styles.item}>{t('API key del provider')}</Text><TextInput value={flowosAIApiKey} onChangeText={setFlowosAIApiKey} placeholder={t('Inserisci la API key per il provider selezionato.')} secureTextEntry autoCapitalize="none" autoCorrect={false} style={styles.input}/>
      <View style={styles.actions}><Button style={styles.actionButton} label={t('Salva API key')} onPress={()=>{void saveFlowosAIKey();}} disabled={!flowosAIApiKey.trim()||flowosAIBusy} loading={flowosAIBusy}/><Button style={styles.actionButton} secondary label={t('Elimina API key')} onPress={()=>{void removeFlowosAIKey();}} disabled={!flowosAIKeySaved||flowosAIBusy}/></View>
      <Text style={styles.meta}>{flowosAIKeySaved?t('API key salvata in modo protetto su questo dispositivo. Non viene sincronizzata con FlowOS o Google.'):t('Stato API key')+': '+t('Non configurata')}</Text>
      <Button secondary label={t('Verifica connessione')} onPress={()=>{void testFlowosAI();}} disabled={!flowosAIKeySaved||flowosAIBusy}/>
      <Button secondary label={t('Apri strumenti AI')} onPress={()=>router.push('/ai-tools' as never)} disabled={!flowosAISettings.enabled||!flowosAIKeySaved}/>
      {flowosAIStatus?<Text style={styles.meta}>{flowosAIStatus}</Text>:null}
      <Text style={styles.meta}>{t('Prima di ogni operazione AI viene richiesta una conferma. In base alla funzione, possono essere inviati al provider selezionato la trascrizione vocale e i titoli delle attività, il titolo e la data di un’occasione personale, la richiesta e le fonti inserite oppure destinatario, obiettivo e contesto del messaggio. Note e descrizioni delle attività non vengono inviate dai comandi vocali e dalle occasioni personali.')}</Text>
      <Text style={styles.meta}>{t('FlowOS non paga le richieste AI: il provider addebita direttamente l’utilizzo alla persona proprietaria della API key.')}</Text>
      <Text style={styles.meta}>{t('Il livello gratuito e i relativi limiti dipendono dal provider e possono cambiare. Alcuni provider possono utilizzare i contenuti inviati per migliorare i propri servizi. Non inviare dati riservati o sensibili e verifica le condizioni del provider.')}</Text>
      {flowosAIOwner?<Text style={styles.meta}>{t('Account proprietario riconosciuto. Puoi utilizzare una API key personale con il livello gratuito del provider, se disponibile.')}</Text>:null}
      {Platform.OS==='web'?<Text style={styles.error}>{t('Per proteggere la tua API key, la configurazione AI è disponibile nell’app mobile FlowOS e non nel browser.')}</Text>:null}
    </Card>

    <Card style={{display:showSettingsSection('google','google sincronizzazione calendario tasks intervallo')?'flex':'none'}}>
      <Text style={styles.label}>{t('Sincronizzazione con Google')}</Text>
      <Text style={styles.meta}>{t('Intervallo importazione:')} {google?.range?`${google.range.labelStart} → ${google.range.labelEnd}`:t('caricamento…')}</Text>
      <View style={styles.inline}><TextInput value={rangeStart} onChangeText={setRangeStart} placeholder={t('GG-MM-AAAA')} style={styles.input}/><TextInput value={rangeEnd} onChangeText={setRangeEnd} placeholder="GG-MM-AAAA" style={styles.input}/><Button secondary label={t('Salva')} onPress={()=>{void saveRange();}}/></View>
      {(connected||reconnecting)?<>
        <Text style={styles.item}>{friendlyCalendarName(google?.connection?.google_email??t('Account Google'),google?.connection?.google_email,language)}</Text>
        <View style={styles.syncStatusRow}><View style={[styles.syncStatusDot,{backgroundColor:syncStatusColor}]}/><Text style={styles.meta}>{reconnecting?t('Ricollegamento Google in corso…'):`${t('Stato:')} ${google?.connection?.last_sync_status?t(google.connection.last_sync_status):''} · ${t('Ultima:')} ${syncDate(google?.connection?.last_sync_at,language)}`}</Text></View>
        {error?<Text style={styles.error}>{error}</Text>:null}
        {progress>0?<><View style={styles.progressHeader}><Text style={styles.meta}>{t(stage)}</Text><Text style={styles.meta}>{progress}%</Text></View><View style={styles.track}><View style={[styles.fill,{width:`${progress}%`}]}/></View></>:null}
        <View style={styles.actions}><Button style={styles.actionButton} label={busy?t('Sincronizzazione in corso…'):t('Sincronizza ora')} onPress={()=>{void sync();}} disabled={busy}/><Button style={styles.actionButton} secondary label={t('Scollega Google')} onPress={()=>{void run(disconnectGoogleWorkspace);}} disabled={busy}/></View>
      </>:<>
        <Text style={styles.error}>{t('Autorizzazione Google scaduta')}</Text>
        <Button label={t('Ricollega Google')} onPress={()=>{void reconnectGoogle();}} disabled={busy}/>
      </>}
    </Card>

    {connected?<><Card style={{display:showSettingsSection('google','google calendario calendari sincronizzati')?'flex':'none'}}><Text style={styles.label}>{t('Calendari sincronizzati')}</Text>{google?.calendars.map(c=><View key={c.id} style={styles.resource}><View style={styles.resourceText}><Text style={styles.item}>{friendlyCalendarName(c.summary,google?.connection?.google_email,language)}</Text><Text style={styles.meta}>{t(c.access_role)}{c.is_default?` · ${t('predefinito')}`:''}</Text></View><Switch value={c.selected} onValueChange={v=>{void run(()=>setCalendarSelected(c.id,v));}}/><Pressable disabled={!c.selected||!['owner','writer'].includes(c.access_role)||c.is_default} onPress={()=>{void run(()=>setDefaultCalendar(c.id));}}><Text style={styles.link}>{t('Default')}</Text></Pressable></View>)}</Card>
    <Card style={{display:showSettingsSection('google','google tasks liste sincronizzate')?'flex':'none'}}><Text style={styles.label}>{t('Liste Google Tasks sincronizzate')}</Text>{google?.taskLists.map(l=><View key={l.id} style={styles.resource}><View style={styles.resourceText}><Text style={styles.item}>{l.title}</Text><Text style={styles.meta}>{l.is_default?t('Predefinita'):t('Lista attività')}</Text></View><Switch value={l.selected} onValueChange={v=>{void run(()=>setTaskListSelected(l.id,v));}}/><Pressable disabled={!l.selected||l.is_default} onPress={()=>{void run(()=>setDefaultTaskList(l.id));}}><Text style={styles.link}>{t('Default')}</Text></Pressable></View>)}</Card></>:null}

    <Card style={{display:showSettingsSection('calendar','calendario tasks eventi completati visibilità passato google calendar')?'flex':'none'}}>
      <Text style={styles.label}>{t('Visualizzazione Calendario')}</Text>
      <Text style={styles.meta}>{t('Scegli se mostrare le tasks e gli eventi già completati nel Calendario e nel widget Calendario.')}</Text>
      <View style={styles.notificationRow}>
        <View style={{flex:1}}>
          <Text style={styles.item}>{t('Mostra anche le tasks completate')}</Text>
          <Text style={styles.meta}>{t('Disattivato per impostazione predefinita. Attivalo per mostrare anche le tasks completate.')}</Text>
        </View>
        <Switch value={widgetAppearance.showCompletedCalendarTasks} onValueChange={value=>{
          const previous=widgetAppearance.showCompletedCalendarTasks;
          const next={...widgetAppearance,showCompletedCalendarTasks:value};
          setWidgetAppearance(next);
          void (async()=>{try{await saveWidgetAppearance(next);await syncTodayWidget(commitments);}catch(e){setWidgetAppearance(current=>({...current,showCompletedCalendarTasks:previous}));showAlert('Calendario',e instanceof Error?e.message:'Salvataggio non riuscito.');}})();
        }}/>
      </View>
      <View style={styles.notificationRow}>
        <View style={{flex:1}}>
          <Text style={styles.item}>{t('Mostra anche gli eventi completati')}</Text>
          <Text style={styles.meta}>{t('Attivo per impostazione predefinita. Disattivalo per nascondere gli eventi completati.')}</Text>
        </View>
        <Switch value={widgetAppearance.showCompletedCalendarEvents} onValueChange={value=>{
          const previous=widgetAppearance.showCompletedCalendarEvents;
          const next={...widgetAppearance,showCompletedCalendarEvents:value};
          setWidgetAppearance(next);
          void (async()=>{try{await saveWidgetAppearance(next);await syncTodayWidget(commitments);}catch(e){setWidgetAppearance(current=>({...current,showCompletedCalendarEvents:previous}));showAlert('Calendario',e instanceof Error?e.message:'Salvataggio non riuscito.');}})();
        }}/>
      </View>
    </Card>
    <Card style={{display:showSettingsSection('widgets','widget personalizzazione temi densità colori anteprima')?'flex':'none'}}>
      <Text style={styles.label}>{t('Personalizzazione widget')}</Text>
      <Text style={styles.meta}>{t('Scegli sfondo, opacità e colori di testo e pulsanti per ciascun widget. I colori delle schede possono essere personalizzati per ogni calendario e lista Google Tasks.')}</Text>
      <Text style={styles.meta}>{t(widgetAppearance.theme==='flowos-light'?'FlowOS Light':widgetAppearance.theme==='flowos-dark'?'FlowOS Dark':widgetAppearance.theme==='minimal-transparent'?'Minimal Transparent':widgetAppearance.theme==='high-contrast'?'High Contrast':'Soft / Pastel')} · {t(widgetAppearance.density==='compact'?'Compatta':widgetAppearance.density==='comfortable'?'Dettagliata':'Standard')}</Text>
      <Button label={t('Apri personalizzazione widget')} onPress={()=>setWidgetPersonalizationOpen(true)}/>
    </Card>
    <Modal visible={widgetPersonalizationOpen} animationType="slide" onRequestClose={()=>setWidgetPersonalizationOpen(false)}>
      <ScreenShell title={t('Personalizzazione widget')} headerActions={<Button secondary label={t('Indietro')} onPress={()=>setWidgetPersonalizationOpen(false)}/>}>
        <Card>
      <Text style={styles.label}>{t('Personalizzazione widget')}</Text>
      <Text style={styles.meta}>{t('Scegli sfondo, opacità e colori di testo e pulsanti per ciascun widget. I colori delle schede possono essere personalizzati per ogni calendario e lista Google Tasks.')}</Text>
      <Text style={styles.meta}>{t(widgetAppearance.theme==='flowos-light'?'FlowOS Light':widgetAppearance.theme==='flowos-dark'?'FlowOS Dark':widgetAppearance.theme==='minimal-transparent'?'Minimal Transparent':widgetAppearance.theme==='high-contrast'?'High Contrast':'Soft / Pastel')} · {t(widgetAppearance.density==='compact'?'Compatta':widgetAppearance.density==='comfortable'?'Dettagliata':'Standard')}</Text>
      <ProgressiveHint id="widget-personalization">{t('Suggerimento Widget: scegli un tema, regola la densità e controlla l’anteprima prima di salvare.')}</ProgressiveHint>
      <Text style={styles.item}>{t('Tema')}</Text><View style={styles.presetRow}>{([{id:'flowos-light',label:'FlowOS Light'},{id:'flowos-dark',label:'FlowOS Dark'},{id:'minimal-transparent',label:'Minimal Transparent'},{id:'high-contrast',label:'High Contrast'},{id:'soft-pastel',label:'Soft / Pastel'}] as const).map(option=><Pressable key={option.id} accessibilityRole="button" accessibilityState={{selected:widgetAppearance.theme===option.id}} onPress={()=>chooseWidgetTheme(option.id)} style={[styles.presetChip,widgetAppearance.theme===option.id&&styles.presetChipActive]}><Text style={[styles.presetChipText,widgetAppearance.theme===option.id&&styles.presetChipTextActive]}>{t(option.label)}</Text></Pressable>)}</View>
      <Text style={styles.item}>{t('Densità globale')}</Text><Text style={styles.meta}>{t('La densità modifica sia la dimensione dei testi sia la quantità di dettagli e lo spazio occupato dalle attività nei widget. Dettagliata mostra più informazioni e riquadri più alti; Compatta riduce testi e spazi per mostrare più attività.')}</Text><View style={styles.presetRow}>{([{id:'comfortable',label:'Dettagliata'},{id:'balanced',label:'Standard'},{id:'compact',label:'Compatta'}] as const).map(option=><Pressable key={option.id} accessibilityRole="button" accessibilityState={{selected:widgetAppearance.density===option.id}} onPress={()=>chooseWidgetDensity(option.id)} style={[styles.presetChip,widgetAppearance.density===option.id&&styles.presetChipActive]}><Text style={[styles.presetChipText,widgetAppearance.density===option.id&&styles.presetChipTextActive]}>{t(option.label)}</Text></Pressable>)}</View>
      <Text style={styles.item}>{t('Anteprima in tempo reale')}</Text><View style={[styles.widgetPreview,{backgroundColor:colorWithOpacity(widgetAppearance.today.backgroundColor,widgetAppearance.today.backgroundOpacity),borderColor:widgetAppearance.today.buttonBackgroundColor}]}><Text style={{fontSize:widgetAppearance.density==='compact'?12:widgetAppearance.density==='comfortable'?16:14,fontWeight:'700',color:widgetAppearance.today.textColor}}>{t('Oggi')} · 09:30</Text><Text style={{fontSize:widgetAppearance.density==='compact'?11:widgetAppearance.density==='comfortable'?14:12,color:widgetAppearance.today.textColor}}>{t('Preparare la giornata')}</Text><View style={[styles.previewButton,{backgroundColor:widgetAppearance.today.buttonBackgroundColor}]}><Text style={{fontSize:12,fontWeight:'700',color:widgetAppearance.today.buttonTextColor}}>{t('Completa')}</Text></View></View>
      <View style={[styles.widgetPreview,{backgroundColor:colorWithOpacity(widgetAppearance.calendar.backgroundColor,widgetAppearance.calendar.backgroundOpacity),borderColor:widgetAppearance.calendar.buttonBackgroundColor}]}>
        <Text style={{fontSize:widgetAppearance.density==='compact'?12:widgetAppearance.density==='comfortable'?16:14,fontWeight:'700',color:widgetAppearance.calendar.textColor}}>{t('Calendario')}</Text>
        <View style={styles.calendarPreviewDays}>{Array.from({length:7},(_,index)=>{const today=new Date();const weekday=(today.getDay()+6)%7;const date=new Date(today.getFullYear(),today.getMonth(),today.getDate()-weekday+index);const selected=index===weekday;return <View key={index} style={styles.calendarPreviewDayColumn}><Text style={{fontSize:9,color:widgetAppearance.calendar.textColor}}>{date.toLocaleDateString(localeForLanguage(language),{weekday:'narrow'})}</Text><View style={[styles.calendarPreviewDay,selected&&{backgroundColor:widgetAppearance.calendar.buttonBackgroundColor}]}><Text style={{fontSize:11,fontWeight:'700',color:selected?widgetAppearance.calendar.buttonTextColor:widgetAppearance.calendar.textColor}}>{date.getDate()}</Text></View></View>;})}</View>
        <View style={[styles.calendarPreviewEvent,{backgroundColor:colorWithOpacity(widgetAppearance.calendar.buttonBackgroundColor,widgetAppearance.calendar.buttonBackgroundOpacity)}]}><Text style={{fontSize:10,fontWeight:'700',color:widgetAppearance.calendar.buttonTextColor}}>09:30 · {t('Evento')}</Text></View>
      </View>
      <Text style={[styles.meta,!todayContrastReliable||todayContrast<4.5?styles.contrastWarning:null]}>{t('Widget Oggi')}: {todayContrastReliable?`${t('Rapporto di contrasto')} ${todayContrast.toFixed(2)}:1 · ${todayContrast>=4.5?t('Contrasto conforme WCAG'):t('Contrasto inferiore a 4,5:1')}`:t('Contrasto variabile con opacità/trasparenza')}</Text>
      <Text style={[styles.meta,!calendarContrastReliable||calendarContrast<4.5?styles.contrastWarning:null]}>{t('Widget Calendario')}: {calendarContrastReliable?`${t('Rapporto di contrasto')} ${calendarContrast.toFixed(2)}:1 · ${calendarContrast>=4.5?t('Contrasto conforme WCAG'):t('Contrasto inferiore a 4,5:1')}`:t('Contrasto variabile con opacità/trasparenza')}</Text>
      <View style={styles.notificationRow}><View style={{flex:1}}><Text style={styles.item}>{t('Spazio inutilizzato trasparente nel widget Oggi')}</Text><Text style={styles.meta}>{t('Rende trasparente lo spazio sotto l’ultima attività, mantenendo lo scorrimento verticale. Disattiva per mantenere lo sfondo del widget anche nello spazio vuoto.')}</Text></View><Switch value={widgetAppearance.todayTransparentUnusedSpace} onValueChange={value=>{const next={...widgetAppearance,todayTransparentUnusedSpace:value};setWidgetAppearance(next);void (async()=>{try{await saveWidgetAppearance(next);await syncTodayWidget(commitments);}catch(e){setWidgetAppearance(current=>({...current,todayTransparentUnusedSpace:!value}));showAlert('Widget',e instanceof Error?e.message:'Salvataggio non riuscito.');}})();}}/></View>
      {(['today','calendar'] as const).map(section=><View key={section} style={styles.widgetAppearanceSection}>
        <View style={styles.widgetSectionHeader}><Text style={styles.item}>{section==='today'?t('Widget Oggi'):t('Widget Calendario')}</Text><Pressable accessibilityRole="button" onPress={()=>{void resetWidgetCategory(section);}}><Text style={styles.link}>{t('Ripristina categoria')}</Text></Pressable></View>
        <Text style={styles.meta}>{t('Colore dello sfondo')}</Text><ColorSwatches language={language} value={widgetAppearance[section].backgroundColor} onSelect={value=>updateWidgetSection(section,'backgroundColor',value)}/>
        <OpacityField label={t('Opacità del colore dello sfondo (%)')} value={widgetAppearance[section].backgroundOpacity} onChange={value=>updateWidgetSection(section,'backgroundOpacity',value)}/>
        <Text style={styles.meta}>{t('Colore del testo')}</Text><ColorSwatches language={language} value={widgetAppearance[section].textColor} onSelect={value=>updateWidgetSection(section,'textColor',value)}/>
        <OpacityField label={t('Opacità del colore del testo (%)')} value={widgetAppearance[section].textOpacity} onChange={value=>updateWidgetSection(section,'textOpacity',value)}/>
        <Text style={styles.meta}>{t('Sfondo dei pulsanti')}</Text><ColorSwatches language={language} value={widgetAppearance[section].buttonBackgroundColor} onSelect={value=>updateWidgetSection(section,'buttonBackgroundColor',value)}/>
        <OpacityField label={t('Opacità dello sfondo dei pulsanti (%)')} value={widgetAppearance[section].buttonBackgroundOpacity} onChange={value=>updateWidgetSection(section,'buttonBackgroundOpacity',value)}/>
        <Text style={styles.meta}>{t('Testo e simboli dei pulsanti')}</Text><ColorSwatches language={language} value={widgetAppearance[section].buttonTextColor} onSelect={value=>updateWidgetSection(section,'buttonTextColor',value)}/>
        <OpacityField label={t('Opacità del testo e dei simboli dei pulsanti (%)')} value={widgetAppearance[section].buttonTextOpacity} onChange={value=>updateWidgetSection(section,'buttonTextOpacity',value)}/>
      </View>)}
      <Text style={styles.item}>{t('Colori delle schede delle attività')}</Text>
      {google?.calendars.map(calendar=>{const key=`calendar:${calendar.google_calendar_id}`;const defaultColor=defaultActivitySourceColor(key);const value=widgetAppearance.sources[key]??{color:defaultColor,opacity:100};return <View key={key} style={styles.sourceAppearanceRow}><Text style={styles.meta}>{friendlyCalendarName(calendar.summary,google?.connection?.google_email,language)}</Text><Text style={styles.meta}>{t('Colore della scheda')}</Text><ColorSwatches language={language} value={value.color} onSelect={color=>updateSourceAppearance(key,'color',color,defaultColor)}/><OpacityField label={t('Opacità del colore della scheda (%)')} value={value.opacity} onChange={opacity=>updateSourceAppearance(key,'opacity',opacity,defaultColor)}/></View>;})}
      {google?.taskLists.map(list=>{const key=`task:${list.google_task_list_id}`;const defaultColor=defaultActivitySourceColor(key);const value=widgetAppearance.sources[key]??{color:defaultColor,opacity:100};return <View key={key} style={styles.sourceAppearanceRow}><Text style={styles.meta}>{list.title}</Text><Text style={styles.meta}>{t('Colore della scheda')}</Text><ColorSwatches language={language} value={value.color} onSelect={color=>updateSourceAppearance(key,'color',color,defaultColor)}/><OpacityField label={t('Opacità del colore della scheda (%)')} value={value.opacity} onChange={opacity=>updateSourceAppearance(key,'opacity',opacity,defaultColor)}/></View>;})}
      {!google?.calendars.length&&!google?.taskLists.length?<Text style={styles.meta}>{t('Collega Google per personalizzare i colori delle singole sorgenti.')}</Text>:null}
      <View style={styles.actions}><Button style={styles.actionButton} label={widgetAppearanceBusy?'Salvataggio…':t('Salva colori')} onPress={()=>{void saveAppearance();}} disabled={widgetAppearanceBusy}/><Button style={styles.actionButton} secondary label={t('Ripristina default')} onPress={()=>{void restoreAppearanceDefaults();}} disabled={widgetAppearanceBusy}/></View>
    </Card>
      </ScreenShell>
    </Modal>
    <Card style={{display:showSettingsSection('notifications','permessi android autorizzazioni notification permission')?'flex':'none'}}>
      <Text style={styles.label}>{t('Permessi Android')}</Text>
      <Text style={styles.meta}>{notificationPermissionStatus==='granted'?t('Permessi notifiche concessi'):notificationPermissionStatus==='denied'?t('Permessi notifiche non concessi'):t('Stato permessi non disponibile')}</Text>
      <Button secondary label={t(notificationPermissionStatus==='granted'?'Gestisci nelle impostazioni del dispositivo':'Abilita notifiche')} onPress={()=>{void manageNotificationPermission();}} disabled={!NOTIFICATIONS_SUPPORTED_HERE}/>
    </Card>
        <Card style={{display:showSettingsSection('notifications','notifiche di sistema android impostazioni dispositivo')?'flex':'none'}}>
      <Text style={styles.label}>{t('Notifiche di sistema')}</Text>
      <Text style={styles.meta}>{t('Puoi gestire i canali e le preferenze delle notifiche nelle impostazioni del dispositivo.')}</Text>
      <Button secondary label={t('Gestisci nelle impostazioni del dispositivo')} onPress={()=>{void Linking.openSettings().catch(error=>showAlert(t('Notifiche'),error instanceof Error?error.message:'Impossibile aprire le impostazioni.'));}} disabled={Platform.OS==='web'}/>
    </Card>
    <Card style={{display:showSettingsSection('notifications','notifiche promemoria riepilogo giornaliero riepiloghi automatici')?'flex':'none'}}>
      <Text style={styles.label}>{t('Riepiloghi automatici')}</Text>
      <View style={styles.notificationRow}><View style={{flex:1}}><Text style={styles.item}>{t('Ricevi il riepilogo giornaliero')}</Text><Text style={styles.meta}>{t('FlowOS sincronizza Google Calendar e Google Tasks prima di inviarlo. Se il telefono era spento o offline, il riepilogo viene recuperato alla riapertura dell’app.')}</Text></View><Switch value={notificationsEnabled} disabled={notificationBusy} onValueChange={value=>{void toggleNotifications(value);}}/></View>
      <View style={styles.timeBox}>
        <View style={styles.timeHeader}><View style={{flex:1}}><Text style={styles.timeTitle}>{t('Orario di invio')}</Text><Text style={styles.meta}>{t('Fuso orario del dispositivo:')} {timeZone}</Text></View><Text style={styles.timeValue}>{timeLabel(summaryHour,summaryMinute)}</Text></View>
        <Button secondary label={timePickerOpen?t('Nascondi orari'):t('Scegli orario')} onPress={()=>setTimePickerOpen(value=>!value)} disabled={notificationBusy||timeSaving}/>
        {timePickerOpen?<View style={styles.picker}><Text style={styles.pickerLabel}>{t('Ora')}</Text><View style={styles.optionGrid}>{Array.from({length:24},(_,hour)=><Pressable key={hour} onPress={()=>setSummaryHour(hour)} style={[styles.option,summaryHour===hour&&styles.optionActive]}><Text style={[styles.optionText,summaryHour===hour&&styles.optionTextActive]}>{String(hour).padStart(2,'0')}</Text></Pressable>)}</View><Text style={styles.pickerLabel}>{t('Minuti')}</Text><View style={styles.minuteRow}>{[0,15,30,45].map(minute=><Pressable key={minute} onPress={()=>setSummaryMinute(minute)} style={[styles.option,summaryMinute===minute&&styles.optionActive]}><Text style={[styles.optionText,summaryMinute===minute&&styles.optionTextActive]}>{String(minute).padStart(2,'0')}</Text></Pressable>)}</View><Button label={timeSaving?t('Salvataggio…'):`${t('Salva')} ${timeLabel(summaryHour,summaryMinute)}`} onPress={()=>{void saveSummaryTime();}} disabled={timeSaving}/></View>:null}
      </View>
      {lastRecovery?<Text style={styles.meta}>{t('Ultimo recupero automatico:')} {lastRecovery}</Text>:null}
      <View style={styles.actions}><Button secondary label={t('Invia le notifiche adesso')} onPress={()=>{void sendNowNotifications();}} disabled={notificationBusy||!notificationsEnabled}/></View>
      <Text style={styles.note}>{t('L’orario scelto è un’ora locale, non UTC: se cambi fuso orario, il trigger segue l’ora locale del dispositivo.')}</Text>
    </Card>

    <Card style={{display:showSettingsSection('notifications','notifiche log logger registro')?'flex':'none'}}>
      <Text style={styles.label}>{t('Logger notifiche')}</Text>
      <Text style={styles.meta}>{t('Registra pianificazione, invio e sincronizzazione legati alle notifiche.')}</Text>
      <View style={styles.actions}><Button secondary style={styles.actionButton} label={showNotificationLogs?t('Nascondi log'):t('Mostra log')} onPress={()=>setShowNotificationLogs(value=>!value)}/><Button secondary style={styles.actionButton} label={t('Copia log')} onPress={()=>{void copyNotificationLogs();}}/><Button secondary style={styles.actionButton} label={t('Pulisci log')} onPress={clearNotificationLogs}/></View>
      {showNotificationLogs?<ScrollView style={styles.notificationLogBox} nestedScrollEnabled showsVerticalScrollIndicator persistentScrollbar contentContainerStyle={styles.notificationLogContent}>{notificationLogs.length?notificationLogs.map((entry,index)=><Text key={`${entry.at}-${index}`} selectable style={[styles.notificationLogText,entry.level==='error'&&styles.notificationLogError,entry.level==='warn'&&styles.notificationLogWarn]}>{notificationLogLine(entry)}</Text>):<Text style={styles.meta}>{t('Nessun evento registrato.')}</Text>}</ScrollView>:null}
    </Card>

    <Card style={{display:showSettingsSection('diagnostics','diagnostica log errori avvisi informazioni')?'flex':'none'}}>
      <Text style={styles.label}>{t('Diagnostica')}</Text>
      <View style={styles.diagnosticHeader}><Text style={styles.meta}>FlowOS {Application.nativeApplicationVersion??'unknown'} · versionCode {Application.nativeBuildVersion??'unknown'} · {logs.length} {t('eventi')}</Text><Text style={styles.meta}>{diagnosticErrors} {t('errori')} · {diagnosticWarnings} {t('avvisi')} · {diagnosticInfo} {t('info')}</Text></View>
      <View style={styles.actions}><Button secondary style={styles.actionButton} label={showLogs?t('Nascondi log'):t('Mostra log')} onPress={()=>setShowLogs(v=>!v)}/><Button secondary style={styles.actionButton} label={t('Copia log')} onPress={()=>{void copyLogs();}}/><Button secondary style={styles.actionButton} label={t('Pulisci log')} onPress={()=>{clearDiagnostics();setLogs([]);}}/></View>
      {showLogs?<ScrollView style={styles.logBox} nestedScrollEnabled showsVerticalScrollIndicator persistentScrollbar contentContainerStyle={styles.logContent}>{logs.length?logs.map((entry,index)=><Text key={`${entry.at}-${index}`} selectable style={[styles.logText,entry.level==='error'&&styles.logError,entry.level==='warn'&&styles.logWarn,entry.level==='info'&&styles.logInfo]}>{logLine(entry)}</Text>):<Text style={styles.logText}>{t('Nessun evento registrato.')}</Text>}</ScrollView>:null}
    </Card>

    <Card style={{display:showSettingsSection('account','dati account privacy elimina attività')?'flex':'none'}}><Text style={styles.label}>{t('Dati FlowOS')}</Text><Text style={styles.meta}>{t('Puoi cancellare le attività locali in qualsiasi momento, indipendentemente dal collegamento Google.')}</Text><Pressable onPress={()=>{void wipe();}} style={styles.dangerButton}><Text style={styles.danger}>{t('Elimina ogni attività su FlowOS senza alcun impatto su Google')}</Text></Pressable></Card>
    <Card style={{display:showSettingsSection('account','account privacy logout esci elimina')?'flex':'none'}}><Text style={styles.label}>{t('Account FlowOS')}</Text><Button secondary label={t('Informativa sulla privacy')} onPress={()=>{void Linking.openURL(language==='it'?'https://getflowos.netlify.app/it/privacy-policy/':'https://getflowos.netlify.app/privacy-policy/');}}/><Button secondary label={t('Esci da FlowOS')} onPress={()=>{void logout();}} disabled={busy}/><Pressable onPress={()=>{void deleteAccount();}} style={styles.delete}><Text style={styles.danger}>{t('Elimina definitivamente l’account FlowOS')}</Text></Pressable></Card>
  </ScreenShell>;
}

const styles=StyleSheet.create({languageGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},languageOption:{borderRadius:12,paddingHorizontal:14,paddingVertical:10,backgroundColor:palette.soft,borderWidth:1,borderColor:palette.border},languageOptionActive:{backgroundColor:palette.primary,borderColor:palette.primary},languageOptionText:{fontSize:12,fontWeight:'700',color:palette.muted},languageOptionTextActive:{color:'#FFF'},
  label:{fontSize:17,fontWeight:'700',color:palette.ink,marginBottom:6},
  syncStatusRow:{flexDirection:'row',alignItems:'center',gap:8,marginTop:4},syncStatusDot:{width:9,height:9,borderRadius:5},
  settingsSearchCard:{padding:12,gap:0},settingsSearchInput:{backgroundColor:palette.card,borderWidth:1,borderColor:palette.border,borderRadius:12,paddingHorizontal:13,paddingVertical:11,fontSize:14,color:palette.ink},
  widgetAppearanceSection:{marginTop:12,paddingTop:10,borderTopWidth:1,borderTopColor:palette.border,gap:7},widgetSectionHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},presetRow:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:6,marginBottom:8},presetChip:{paddingHorizontal:10,paddingVertical:8,borderRadius:11,backgroundColor:palette.soft,borderWidth:1,borderColor:palette.border},presetChipActive:{backgroundColor:palette.soft,borderColor:palette.primary},presetChipText:{fontSize:11,fontWeight:'600',color:palette.ink},presetChipTextActive:{color:palette.primary,fontWeight:'700'},widgetPreview:{borderRadius:14,padding:12,gap:8,borderWidth:1,minHeight:92},calendarPreviewDays:{flexDirection:'row',justifyContent:'space-between',gap:3},calendarPreviewDayColumn:{flex:1,alignItems:'center',gap:4},calendarPreviewDay:{width:27,height:27,borderRadius:14,alignItems:'center',justifyContent:'center'},calendarPreviewEvent:{alignSelf:'flex-start',paddingHorizontal:9,paddingVertical:6,borderRadius:8},previewButton:{alignSelf:'flex-start',paddingHorizontal:12,paddingVertical:7,borderRadius:9},contrastWarning:{color:palette.danger,fontWeight:'700'},colorFields:{flexDirection:'row',gap:7,alignItems:'flex-end'},colorPickerPanel:{borderWidth:1,borderColor:palette.border,borderRadius:18,padding:9,backgroundColor:palette.card,gap:9},colorSwatchRows:{aspectRatio:1,gap:1},colorSwatchRow:{flex:1,flexDirection:'row',alignItems:'center'},colorSwatchTouch:{width:'12.5%',height:'100%',alignItems:'center',justifyContent:'center'},colorSwatch:{width:'76%',aspectRatio:1,borderRadius:4,borderWidth:1,borderColor:'#AAB1C0'},colorSwatchSelected:{borderWidth:3,borderColor:palette.primary},colorSelectionPreview:{flexDirection:'row',alignItems:'center',gap:8,borderTopWidth:1,borderTopColor:palette.border,paddingTop:8},colorSelectionDot:{width:18,height:18,borderRadius:9,borderWidth:1,borderColor:'#AAB1C0'},colorSelectionName:{flex:1,fontSize:12,fontWeight:'700',color:palette.ink},colorSelectionSample:{width:54,height:22,borderRadius:7,borderWidth:1,borderColor:'#AAB1C0'},colorField:{flex:1,minWidth:0},opacityField:{width:'100%',minWidth:0,flexDirection:'row',alignItems:'center',gap:8},opacityLabel:{flex:1,minWidth:0,flexShrink:1},opacityInput:{width:64,minWidth:64,maxWidth:64,flexShrink:0,textAlign:'center'},colorInput:{width:76,borderWidth:1,borderColor:palette.border,borderRadius:9,paddingHorizontal:9,paddingVertical:8,fontSize:12,color:palette.ink,marginTop:3},sourceAppearanceRow:{paddingTop:8,marginTop:5,borderTopWidth:1,borderTopColor:palette.border,gap:5},
  meta:{fontSize:12,lineHeight:17,color:palette.muted},
  item:{fontSize:14,fontWeight:'700',color:palette.ink},
  inline:{flexDirection:'row',alignItems:'center',gap:6,marginTop:8},
  input:{flex:1,minWidth:0,borderWidth:1,borderColor:palette.border,borderRadius:10,paddingHorizontal:10,paddingVertical:9,fontSize:12,color:palette.ink},
  actions:{flexDirection:'row',gap:6,marginTop:10},
  actionButton:{flex:1,minWidth:0,paddingHorizontal:4},
  error:{fontSize:12,lineHeight:17,color:palette.warning,marginTop:7},
  errorStrong:{fontWeight:'700'},
  progressHeader:{flexDirection:'row',justifyContent:'space-between',marginTop:10},
  track:{height:7,borderRadius:4,backgroundColor:palette.border,overflow:'hidden',marginTop:5},
  fill:{height:7,backgroundColor:palette.primary},
  resource:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:8,borderTopWidth:1,borderTopColor:palette.border},
  resourceText:{flex:1},
  link:{fontSize:11,fontWeight:'700',color:palette.primary},
  notificationRow:{flexDirection:'row',alignItems:'center',gap:12,marginTop:8},
  timeBox:{marginTop:12,padding:12,borderRadius:14,backgroundColor:palette.soft,gap:10},
  timeHeader:{flexDirection:'row',alignItems:'center',gap:10},
  timeTitle:{fontSize:14,fontWeight:'700',color:palette.ink},
  timeValue:{fontSize:24,fontWeight:'700',color:palette.primary},
  picker:{gap:9},
  pickerLabel:{fontSize:11,fontWeight:'700',color:palette.muted,textTransform:'uppercase'},
  optionGrid:{flexDirection:'row',flexWrap:'wrap',gap:5},
  minuteRow:{flexDirection:'row',gap:7},
  option:{minWidth:45,paddingHorizontal:9,paddingVertical:8,borderRadius:10,backgroundColor:palette.soft,alignItems:'center'},
  optionActive:{backgroundColor:palette.primary},
  optionText:{fontSize:12,fontWeight:'700',color:palette.muted},
  optionTextActive:{color:'#FFF'},
  note:{fontSize:11,lineHeight:16,color:palette.muted,marginTop:10,fontStyle:'italic'},
  notificationLogBox:{marginTop:10,height:260,maxHeight:260,borderRadius:12,backgroundColor:palette.card,borderWidth:1,borderColor:palette.border},
  notificationLogContent:{padding:10,paddingBottom:36,gap:5},
  notificationLogText:{fontSize:9,lineHeight:13,color:palette.ink,fontFamily:'monospace'},
  notificationLogWarn:{color:palette.warning},notificationLogError:{color:palette.danger},
  diagnosticHeader:{gap:2},
  logBox:{marginTop:10,height:420,maxHeight:420,borderRadius:12,backgroundColor:palette.card,borderWidth:1,borderColor:palette.border},
  logContent:{padding:10,paddingBottom:48,gap:3},
  logInfo:{color:palette.muted},logWarn:{color:palette.warning},logError:{color:palette.danger},logText:{fontFamily:'monospace',fontSize:10,lineHeight:15,color:palette.ink},
  dangerButton:{marginTop:10,padding:12,borderRadius:12,backgroundColor:palette.soft},
  danger:{fontSize:12,fontWeight:'700',color:palette.danger},
  delete:{marginTop:12,padding:8,alignItems:'center'}
});
