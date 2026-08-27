import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { palette } from '@/components/ui';
import { recordDiagnostic, subscribeDiagnostics } from '@/lib/diagnostics';
import { useFlowStore } from '@/lib/store';
import { useAuth } from '@/providers/AuthProvider';

function isTodayItem(value: string | undefined, allDay?: boolean) {
  if (!value) return false;
  const date = new Date(value), now = new Date();
  if (allDay) return date.getUTCFullYear()===now.getFullYear() && date.getUTCMonth()===now.getMonth() && date.getUTCDate()===now.getDate();
  return date.getFullYear()===now.getFullYear() && date.getMonth()===now.getMonth() && date.getDate()===now.getDate();
}

export default function TabsLayout() {
  const { configured, loading, session } = useAuth();
  const commitments = useFlowStore((state) => state.commitments);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeDiagnostics((entries) => {
      // The Settings badge is reserved for actionable errors from the current
      // FlowOS session. Do not count warnings or the persistent notification
      // log here: old notification warnings must never look like a new error.
      setErrorCount(entries.filter((entry) => entry.level === 'error').length);
    });
    return unsubscribe;
  }, []);

  const todayCount = useMemo(() => commitments.filter((item) => item.status !== 'done' && isTodayItem(item.scheduledAt ?? item.dueAt, item.allDay)).length, [commitments]);
  const actionCount = useMemo(() => commitments.filter((item) => item.status !== 'done' && item.confidence < 0.85).length, [commitments]);

  useEffect(() => {
    recordDiagnostic('tabs-layout-state', { configured, loading, hasSession: Boolean(session), userId: session?.user.id ?? null });
  }, [configured, loading, session]);

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bg }}><ActivityIndicator /></View>;
  if (configured && !session) { recordDiagnostic('tabs-layout-redirect-login'); return <Redirect href="/login" />; }

  return <Tabs initialRouteName="today" screenOptions={{headerShown:false,tabBarActiveTintColor:palette.primary,tabBarStyle:{height:74,paddingBottom:12,paddingTop:8,borderTopWidth:0,elevation:10},tabBarLabelStyle:{fontWeight:'700'}}}>
    <Tabs.Screen name="today" options={{title:'Oggi',tabBarBadge:todayCount>0?todayCount:undefined,tabBarIcon:({color,size})=><Ionicons name="sparkles" color={color} size={size}/>}}/>
    <Tabs.Screen name="plan" options={{title:'Tutto',tabBarIcon:({color,size})=><Ionicons name="calendar" color={color} size={size}/>}}/>
    <Tabs.Screen name="calendar" options={{title:'Calendario',tabBarIcon:({color,size})=><Ionicons name="calendar-outline" color={color} size={size}/>}}/>
    <Tabs.Screen name="capture" options={{title:'Aggiungi',tabBarIcon:({color,size})=><Ionicons name="add-circle" color={color} size={size+10}/>}}/>
    <Tabs.Screen name="inbox" options={{title:'Controlla',tabBarBadge:actionCount>0?actionCount:undefined,tabBarIcon:({color,size})=><Ionicons name="layers" color={color} size={size}/>}}/>
    <Tabs.Screen name="me" options={{title:'Impostazioni',tabBarBadge:errorCount>0?errorCount:undefined,tabBarIcon:({color,size})=><Ionicons name="person" color={color} size={size}/>}}/>
  </Tabs>;
}
