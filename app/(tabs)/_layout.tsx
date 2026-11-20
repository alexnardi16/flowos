import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppChrome } from '@/components/AppChrome';
import { palette } from '@/components/ui';
import { recordDiagnostic } from '@/lib/diagnostics';
import { useFlowStore } from '@/lib/store';
import { useAuth } from '@/providers/AuthProvider';
import { t, useLanguage } from '@/lib/i18n';

export default function TabsLayout(){const{configured,loading,session}=useAuth();const { language } = useLanguage();const insets=useSafeAreaInsets();useEffect(()=>{recordDiagnostic('tabs-layout-state',{configured,loading,hasSession:Boolean(session),userId:session?.user.id??null});},[configured,loading,session]);if(loading)return <View style={styles.loading}><ActivityIndicator/></View>;if(configured&&!session){recordDiagnostic('tabs-layout-redirect-login');return <Redirect href="/login"/>;}const bottom=insets.bottom;const tabHeight=66+bottom;return <View style={styles.root}><Tabs initialRouteName="today" screenOptions={{headerShown:false,lazy:false,freezeOnBlur:true,tabBarActiveTintColor:palette.primary,tabBarStyle:{height:tabHeight,paddingBottom:Math.max(7,bottom+2),paddingTop:6,borderTopWidth:0,elevation:10},tabBarLabelStyle:{fontWeight:'700',fontSize:10}}}><Tabs.Screen name="today" options={{title:t('Oggi',undefined,language),tabBarIcon:({color,size})=><Ionicons name="sparkles-outline" color={color} size={size}/>}}/><Tabs.Screen name="plan" options={{title:t('Lista',undefined,language),tabBarIcon:({color,size})=><Ionicons name="document-text-outline" color={color} size={size}/>}}/><Tabs.Screen name="capture" options={{title:t('Aggiungi',undefined,language),tabBarItemStyle:{marginTop:0},tabBarIcon:({size})=><View style={styles.addTabIcon}><Ionicons name="add" color="#FFFFFF" size={size+2}/></View>}}/><Tabs.Screen name="calendar" options={{title:t('Calendario',undefined,language),tabBarIcon:({color,size})=><Ionicons name="calendar-outline" color={color} size={size}/>}}/><Tabs.Screen name="me" options={{title:t('Impostazioni',undefined,language),tabBarIcon:({color,size})=><Ionicons name="person-outline" color={color} size={size}/>}}/></Tabs><AppChrome/></View>}
const styles=StyleSheet.create({root:{flex:1},loading:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:palette.bg},addTabIcon:{width:32,height:32,borderRadius:16,backgroundColor:palette.primary,alignItems:'center',justifyContent:'center',marginTop:-3}});
