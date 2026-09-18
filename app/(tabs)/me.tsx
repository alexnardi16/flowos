import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Button, Card, ScreenShell, palette, showAlert, showConfirm } from '@/components/ui';
import { clearDiagnostics, readDiagnostics, recordDiagnostic, subscribeDiagnostics, type DiagnosticEntry } from '@/lib/diagnostics';
import { deleteAllFlowOSOnlyData } from '@/lib/commitmentsRepository';
import { deleteFlowOSAccount } from '@/lib/account';
import { connectGoogleFromSession, disconnectGoogleWorkspace, getGoogleWorkspaceStatus, isSyncGenuinelyStale, recoverStaleGoogleSyncState, setCalendarSelected, setDefaultCalendar, setDefaultTaskList, setTaskListSelected, friendlyCalendarName, setSyncRange, signInWithGoogle, subscribeToSyncProgress, syncGoogleWorkspace, type GoogleWorkspaceStatus } from '@/lib/googleWorkspace';
import { buildDailySummary, type DailySummary } from '@/lib/dailySummary';
import { registerBackgroundSync, runDailySummaryRefresh, unregisterBackgroundSync, checkAndRecoverMissedDailySummary } from '@/lib/notificationSettingsBridge';
import { clearNotificationLog, getNotificationLog, subscribeNotificationLog, type NotificationLogEntry } from '@/lib/notificationLog';
import { DEFAULT_DAILY_SUMMARY_HOUR, DEFAULT_DAILY_SUMMARY_MINUTE, disableDailySummaryNotification, getDailySummaryTime, getLastRecoveryDateKey, isDailySummaryEnabledStored, NOTIFICATIONS_SUPPORTED_HERE, sendImmediateSummaryNotification, setDailySummaryEnabledStored, setDailySummaryTime } from '@/lib/notificationService';
import { useFlowStore } from '@/lib/store';
import { useAuth } from '@/providers/AuthProvider';
import * as Application from 'expo-application';

function syncDate(value?:string|null){return value?new Date(value).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'mai sincronizzata';}
function logLine(entry:DiagnosticEntry){const time=new Date(entry.at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit',second:'2-digit'});return `${time} [${entry.level}] ${entry.event}${entry.details?` — ${entry.details}`:''}`;}
function notificationLogLine(entry:NotificationLogEntry){const time=new Date(entry.at).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});return `${time} [${entry.level}] ${entry.event}${entry.details?` — ${entry.details}`:''}`;}
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
  const[lastRecovery,setLastRecovery]=useState<string|null>(null);
  const[notificationLogs,setNotificationLogs]=useState<NotificationLogEntry[]>([]);
  const[showNotificationLogs,setShowNotificationLogs]=useState(false);
  const[summaryHour,setSummaryHour]=useState(DEFAULT_DAILY_SUMMARY_HOUR);
  const[summaryMinute,setSummaryMinute]=useState(DEFAULT_DAILY_SUMMARY_MINUTE);
  const[timePickerOpen,setTimePickerOpen]=useState(false);
  const[timeSaving,setTimeSaving]=useState(false);

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
  useEffect(()=>{if(google?.range){const toInput=(v:string)=>{const[d,m,y]=v.split('/');return `${d}-${m}-${y}`;};setRangeStart(toInput(google.range.labelStart));setRangeEnd(toInput(google.range.labelEnd));}},[google?.range?.labelStart,google?.range?.labelEnd]);
  useEffect(()=>{const u=subscribeToSyncProgress(p=>{setProgress(p.percent);setStage(p.stage);});return u;},[]);
  useEffect(()=>{
    void isDailySummaryEnabledStored().then(setNotificationsEnabled);
    void getDailySummaryTime().then(({hour,minute})=>{setSummaryHour(hour);setSummaryMinute(minute);});
    void getLastRecoveryDateKey().then(setLastRecovery);
    const unsubscribe=subscribeNotificationLog(setNotificationLogs);
    void getNotificationLog().then(setNotificationLogs);
    return unsubscribe;
  },[]);

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
      const summary:DailySummary=buildDailySummary(commitments,new Date());
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

  const authMissing=missingAuth(google,error);
  const connected=Boolean(google?.connection&&google.connection.last_sync_status!=='disconnected'&&!authMissing);

  return <ScreenShell title="Impostazioni">
    <Card>
      <Text style={styles.label}>Google Workspace</Text>
      <Text style={styles.meta}>Intervallo importazione: {google?.range?`${google.range.labelStart} → ${google.range.labelEnd}`:'caricamento…'}</Text>
      <View style={styles.inline}><TextInput value={rangeStart} onChangeText={setRangeStart} placeholder="GG-MM-AAAA" style={styles.input}/><TextInput value={rangeEnd} onChangeText={setRangeEnd} placeholder="GG-MM-AAAA" style={styles.input}/><Button secondary label="Salva" onPress={()=>{void saveRange();}}/></View>
      {(connected||reconnecting)?<>
        <Text style={styles.item}>{friendlyCalendarName(google?.connection?.google_email??'Account Google',google?.connection?.google_email)}</Text>
        <Text style={styles.meta}>{reconnecting?'Ricollegamento Google in corso…':`Stato: ${google?.connection?.last_sync_status} · Ultima: ${syncDate(google?.connection?.last_sync_at)}`}</Text>
        {error?<Text style={styles.error}>{error}</Text>:null}
        {progress>0?<><View style={styles.progressHeader}><Text style={styles.meta}>{stage}</Text><Text style={styles.meta}>{progress}%</Text></View><View style={styles.track}><View style={[styles.fill,{width:`${progress}%`}]}/></View></>:null}
        <View style={styles.actions}><Button label={busy?'Sincronizzazione…':'Sincronizza ora'} onPress={()=>{void sync();}} disabled={busy}/><Button secondary label="Scollega Google" onPress={()=>{void run(disconnectGoogleWorkspace);}} disabled={busy}/></View>
      </>:<>
        <Text style={styles.error}>L’autorizzazione Google è scaduta o non è più valida. Prima clicca <Text style={styles.errorStrong}>"Scollega Google"</Text>, poi clicca <Text style={styles.errorStrong}>"Ricollega Google"</Text>.</Text>
        <Button label="Ricollega Google" onPress={()=>{void reconnectGoogle();}} disabled={busy}/>
      </>}
    </Card>

    {connected?<><Card><Text style={styles.label}>Calendari sincronizzati</Text>{google?.calendars.map(c=><View key={c.id} style={styles.resource}><View style={styles.resourceText}><Text style={styles.item}>{friendlyCalendarName(c.summary,google?.connection?.google_email)}</Text><Text style={styles.meta}>{c.access_role}{c.is_default?' · predefinito':''}</Text></View><Switch value={c.selected} onValueChange={v=>{void run(()=>setCalendarSelected(c.id,v));}}/><Pressable disabled={!c.selected||!['owner','writer'].includes(c.access_role)||c.is_default} onPress={()=>{void run(()=>setDefaultCalendar(c.id));}}><Text style={styles.link}>{c.is_default?'Default':'Default'}</Text></Pressable></View>)}</Card>
    <Card><Text style={styles.label}>Liste Google Tasks</Text>{google?.taskLists.map(l=><View key={l.id} style={styles.resource}><View style={styles.resourceText}><Text style={styles.item}>{l.title}</Text><Text style={styles.meta}>{l.is_default?'Predefinita':'Lista attività'}</Text></View><Switch value={l.selected} onValueChange={v=>{void run(()=>setTaskListSelected(l.id,v));}}/><Pressable disabled={!l.selected||l.is_default} onPress={()=>{void run(()=>setDefaultTaskList(l.id));}}><Text style={styles.link}>{l.is_default?'Default':'Default'}</Text></Pressable></View>)}</Card></>:null}

    <Card>
      <Text style={styles.label}>Notifiche</Text>
      <View style={styles.notificationRow}><View style={{flex:1}}><Text style={styles.item}>Ricevi il riepilogo giornaliero</Text><Text style={styles.meta}>FlowOS sincronizza Google Calendar e Google Tasks prima di inviarlo. Se il telefono era spento o offline, il riepilogo viene recuperato alla riapertura dell’app.</Text></View><Switch value={notificationsEnabled} disabled={notificationBusy} onValueChange={value=>{void toggleNotifications(value);}}/></View>
      <View style={styles.timeBox}>
        <View style={styles.timeHeader}><View style={{flex:1}}><Text style={styles.timeTitle}>Orario di invio</Text><Text style={styles.meta}>Fuso orario del dispositivo: {timeZone}</Text></View><Text style={styles.timeValue}>{timeLabel(summaryHour,summaryMinute)}</Text></View>
        <Button secondary label={timePickerOpen?'Nascondi orari':'Scegli orario'} onPress={()=>setTimePickerOpen(value=>!value)} disabled={notificationBusy||timeSaving}/>
        {timePickerOpen?<View style={styles.picker}><Text style={styles.pickerLabel}>Ora</Text><View style={styles.optionGrid}>{Array.from({length:24},(_,hour)=><Pressable key={hour} onPress={()=>setSummaryHour(hour)} style={[styles.option,summaryHour===hour&&styles.optionActive]}><Text style={[styles.optionText,summaryHour===hour&&styles.optionTextActive]}>{String(hour).padStart(2,'0')}</Text></Pressable>)}</View><Text style={styles.pickerLabel}>Minuti</Text><View style={styles.minuteRow}>{[0,15,30,45].map(minute=><Pressable key={minute} onPress={()=>setSummaryMinute(minute)} style={[styles.option,summaryMinute===minute&&styles.optionActive]}><Text style={[styles.optionText,summaryMinute===minute&&styles.optionTextActive]}>{String(minute).padStart(2,'0')}</Text></Pressable>)}</View><Button label={timeSaving?'Salvataggio…':`Salva ${timeLabel(summaryHour,summaryMinute)}`} onPress={()=>{void saveSummaryTime();}} disabled={timeSaving}/></View>:null}
      </View>
      {lastRecovery?<Text style={styles.meta}>Ultimo recupero automatico: {lastRecovery}</Text>:null}
      <View style={styles.actions}><Button secondary label="Invia le notifiche adesso" onPress={()=>{void sendNowNotifications();}} disabled={notificationBusy||!notificationsEnabled}/></View>
      <Text style={styles.note}>L’orario scelto è un’ora locale, non UTC: se cambi fuso orario, il trigger segue l’ora locale del dispositivo.</Text>
    </Card>

    <Card>
      <Text style={styles.label}>Logger notifiche</Text>
      <Text style={styles.meta}>Registra pianificazione, invio e sincronizzazione legati alle notifiche.</Text>
      <View style={styles.actions}><Button secondary style={styles.actionButton} label={showNotificationLogs?'Nascondi log':'Mostra log'} onPress={()=>setShowNotificationLogs(value=>!value)}/><Button secondary style={styles.actionButton} label="Copia log" onPress={()=>{void copyNotificationLogs();}}/><Button secondary style={styles.actionButton} label="Pulisci log" onPress={clearNotificationLogs}/></View>
      {showNotificationLogs?<ScrollView style={styles.notificationLogBox} nestedScrollEnabled showsVerticalScrollIndicator persistentScrollbar contentContainerStyle={styles.notificationLogContent}>{notificationLogs.length?notificationLogs.map((entry,index)=><Text key={`${entry.at}-${index}`} selectable style={[styles.notificationLogText,entry.level==='error'&&styles.notificationLogError]}>{notificationLogLine(entry)}</Text>):<Text style={styles.meta}>Nessun evento registrato.</Text>}</ScrollView>:null}
    </Card>

    <Card>
      <Text style={styles.label}>Diagnostica</Text>
      <View style={styles.diagnosticHeader}><Text style={styles.meta}>FlowOS {Application.nativeApplicationVersion??'unknown'} · versionCode {Application.nativeBuildVersion??'unknown'} · {logs.length} eventi</Text></View>
      <View style={styles.actions}><Button secondary style={styles.actionButton} label={showLogs?'Nascondi log':'Mostra log'} onPress={()=>setShowLogs(v=>!v)}/><Button secondary style={styles.actionButton} label="Copia log" onPress={()=>{void copyLogs();}}/><Button secondary style={styles.actionButton} label="Pulisci log" onPress={()=>{clearDiagnostics();setLogs([]);}}/></View>
      {showLogs?<ScrollView style={styles.logBox} nestedScrollEnabled showsVerticalScrollIndicator persistentScrollbar contentContainerStyle={styles.logContent}>{logs.length?logs.map((entry,index)=><Text key={`${entry.at}-${index}`} selectable style={styles.logText}>{logLine(entry)}</Text>):<Text style={styles.logText}>Nessun evento registrato.</Text>}</ScrollView>:null}
    </Card>

    <Card><Text style={styles.label}>Dati FlowOS</Text><Text style={styles.meta}>Puoi cancellare le attività locali in qualsiasi momento, indipendentemente dal collegamento Google.</Text><Pressable onPress={()=>{void wipe();}} style={styles.dangerButton}><Text style={styles.danger}>Elimina ogni attività su FlowOS senza alcun impatto su Google</Text></Pressable></Card>
    <Card><Text style={styles.label}>Account FlowOS</Text><Button secondary label="Esci da FlowOS" onPress={()=>{void logout();}} disabled={busy}/><Pressable onPress={()=>{void deleteAccount();}} style={styles.delete}><Text style={styles.danger}>Elimina definitivamente l’account FlowOS</Text></Pressable></Card>
  </ScreenShell>;
}

const styles=StyleSheet.create({
  label:{fontSize:17,fontWeight:'900',color:palette.ink,marginBottom:6},
  meta:{fontSize:12,lineHeight:17,color:palette.muted},
  item:{fontSize:14,fontWeight:'800',color:palette.ink},
  inline:{flexDirection:'row',alignItems:'center',gap:6,marginTop:8},
  input:{flex:1,minWidth:0,borderWidth:1,borderColor:palette.border,borderRadius:10,paddingHorizontal:10,paddingVertical:9,fontSize:12,color:palette.ink},
  actions:{flexDirection:'row',gap:6,marginTop:10},
  actionButton:{flex:1,minWidth:0,paddingHorizontal:4},
  error:{fontSize:12,lineHeight:17,color:palette.warning,marginTop:7},
  errorStrong:{fontWeight:'900'},
  progressHeader:{flexDirection:'row',justifyContent:'space-between',marginTop:10},
  track:{height:7,borderRadius:4,backgroundColor:'#E5E7EE',overflow:'hidden',marginTop:5},
  fill:{height:7,backgroundColor:palette.primary},
  resource:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:8,borderTopWidth:1,borderTopColor:palette.border},
  resourceText:{flex:1},
  link:{fontSize:11,fontWeight:'800',color:palette.primary},
  notificationRow:{flexDirection:'row',alignItems:'center',gap:12,marginTop:8},
  timeBox:{marginTop:12,padding:12,borderRadius:14,backgroundColor:'#F7F5FF',gap:10},
  timeHeader:{flexDirection:'row',alignItems:'center',gap:10},
  timeTitle:{fontSize:14,fontWeight:'900',color:palette.ink},
  timeValue:{fontSize:24,fontWeight:'900',color:palette.primary},
  picker:{gap:9},
  pickerLabel:{fontSize:11,fontWeight:'900',color:palette.muted,textTransform:'uppercase'},
  optionGrid:{flexDirection:'row',flexWrap:'wrap',gap:5},
  minuteRow:{flexDirection:'row',gap:7},
  option:{minWidth:45,paddingHorizontal:9,paddingVertical:8,borderRadius:10,backgroundColor:'#ECEEF4',alignItems:'center'},
  optionActive:{backgroundColor:palette.primary},
  optionText:{fontSize:12,fontWeight:'800',color:palette.muted},
  optionTextActive:{color:'#FFF'},
  note:{fontSize:11,lineHeight:16,color:palette.muted,marginTop:10,fontStyle:'italic'},
  notificationLogBox:{marginTop:10,height:260,maxHeight:260,borderRadius:12,backgroundColor:'#111827'},
  notificationLogContent:{padding:10,paddingBottom:36,gap:5},
  notificationLogText:{fontSize:9,lineHeight:13,color:'#D1D5DB',fontFamily:'monospace'},
  notificationLogError:{color:'#FCA5A5'},
  diagnosticHeader:{gap:2},
  logBox:{marginTop:10,height:420,maxHeight:420,borderRadius:12,backgroundColor:'#111827'},
  logContent:{padding:10,paddingBottom:48,gap:3},
  logText:{fontFamily:'monospace',fontSize:10,lineHeight:15,color:'#F3F4F6'},
  dangerButton:{marginTop:10,padding:12,borderRadius:12,backgroundColor:'#FFF0F0'},
  danger:{fontSize:12,fontWeight:'900',color:'#A12626'},
  delete:{marginTop:12,padding:8,alignItems:'center'}
});
