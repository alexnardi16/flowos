import type { ErrorBoundaryProps } from 'expo-router';
import { router } from 'expo-router';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { BuildInfo } from '../components/BuildInfo';
import { formatDiagnostics, recordDiagnostic } from '../lib/diagnostics';
import { finishNativeGoogleOAuth } from '../lib/googleLogin';
import { AuthProvider } from '../providers/AuthProvider';
import { SnackbarHost } from '../components/SnackbarHost';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {useEffect(()=>{recordDiagnostic('react-error-boundary',error,'error');},[error]);const diagnostics=formatDiagnostics();return <View style={styles.errorRoot}><ScrollView contentContainerStyle={styles.errorContainer}><Text style={styles.errorEyebrow}>FLOWOS — ERRORE DI AVVIO</Text><Text style={styles.errorTitle}>L’app non è riuscita a caricare la schermata.</Text><Text style={styles.errorMessage}>{error.name}: {error.message}</Text><BuildInfo inline/><Text selectable style={styles.stackLabel}>JAVASCRIPT STACK</Text><Text selectable style={styles.stack}>{error.stack??'Nessuno stack JavaScript disponibile.'}</Text><Text selectable style={styles.diagnosticsLabel}>DIAGNOSTICA</Text><Text selectable style={styles.diagnostics}>{diagnostics||'Nessun evento diagnostico disponibile.'}</Text><Pressable style={styles.retryButton} onPress={retry}><Text style={styles.retryText}>Riprova</Text></Pressable></ScrollView></View>}

export default function Root(){
  useEffect(()=>{
    recordDiagnostic('root-layout-mounted');
    if(Platform.OS!=='web'){
      const handleNotificationResponse=(response:Notifications.NotificationResponse)=>{
        const data=response.notification.request.content.data as Record<string,unknown>|undefined;
        const commitmentId=typeof data?.commitmentId==='string'?data.commitmentId:undefined;
        if(commitmentId){recordDiagnostic('notification-manage-navigation',{commitmentId});router.replace({pathname:'/today',params:{widgetAction:'manage',id:commitmentId}});}
      };
      const notificationSubscription=Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
      void Notifications.getLastNotificationResponseAsync().then(response=>{if(response)handleNotificationResponse(response);}).catch(error=>recordDiagnostic('notification-response-read-failed',error,'warn'));
      const handleNativeUrl=(url:string)=>{if(!url.startsWith('flowos://'))return;const parsed=Linking.parse(url);const params=parsed.queryParams??{};const action=Array.isArray(params.widgetAction)?params.widgetAction[0]:params.widgetAction;const id=Array.isArray(params.id)?params.id[0]:params.id;const path=(parsed.path??'').replace(/^\//,'');if(typeof action==='string'&&typeof id==='string'&&(action==='manage'||action==='complete'||action==='postpone')){recordDiagnostic('widget-action-received',{action,hasId:Boolean(id)});router.replace({pathname:'/today',params:{widgetAction:action,id}});return;}if(path==='today'||path==='calendar'||path==='capture'){recordDiagnostic('widget-navigation-received',{path});router.replace(path==='today'?'/today':path==='calendar'?'/calendar':'/capture');return;}const hasOAuthPayload=/[?&#](code|error|access_token|refresh_token)=/.test(url);if(!hasOAuthPayload)return;recordDiagnostic('global-google-oauth-link-received',{hasCode:url.includes('code='),hasError:url.includes('error=')});void finishNativeGoogleOAuth(url).then(()=>{recordDiagnostic('global-google-oauth-completed');router.replace('/today');}).catch(error=>recordDiagnostic('global-google-oauth-failed',error,'error'));};
      const subscription=Linking.addEventListener('url',({url})=>handleNativeUrl(url));
      void Linking.getInitialURL().then(url=>{if(url)handleNativeUrl(url);}).catch(error=>recordDiagnostic('global-google-oauth-initial-url-failed',error,'warn'));
      return()=>{subscription.remove();notificationSubscription.remove();};
    }
    if(typeof window==='undefined')return;
    const onError=(event:ErrorEvent)=>recordDiagnostic('window-error',event.error??event.message,'error');
    const onUnhandledRejection=(event:PromiseRejectionEvent)=>recordDiagnostic('unhandled-promise-rejection',event.reason,'error');
    window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onUnhandledRejection);
    return()=>{window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onUnhandledRejection);};
  },[]);
  return <SafeAreaProvider><AuthProvider><StatusBar style="dark"/><View style={styles.root}><Stack screenOptions={{headerShown:false}}/><SnackbarHost/></View></AuthProvider></SafeAreaProvider>
}
const styles=StyleSheet.create({root:{flex:1,minHeight:'100%'},errorRoot:{flex:1,backgroundColor:'#F7F6F2'},errorContainer:{flexGrow:1,padding:28,paddingBottom:64},errorEyebrow:{fontSize:12,fontWeight:'800',letterSpacing:1.5,color:'#A12626',marginBottom:12},errorTitle:{fontSize:28,lineHeight:34,fontWeight:'900',color:'#111'},errorMessage:{marginTop:14,fontSize:16,lineHeight:23,color:'#A12626'},stackLabel:{marginTop:12,fontSize:11,fontWeight:'900',letterSpacing:1,color:'#A12626'},stack:{marginTop:7,padding:14,borderRadius:12,backgroundColor:'#FFF',fontFamily:'monospace',fontSize:10,lineHeight:15,color:'#222'},diagnosticsLabel:{marginTop:16,fontSize:11,fontWeight:'900',letterSpacing:1,color:'#555'},diagnostics:{marginTop:7,padding:14,borderRadius:12,backgroundColor:'#FFF',fontFamily:'monospace',fontSize:10,lineHeight:15,color:'#333'},retryButton:{alignSelf:'flex-start',marginTop:20,borderRadius:14,paddingHorizontal:18,paddingVertical:13,backgroundColor:'#111'},retryText:{color:'#FFF',fontWeight:'800'}});
