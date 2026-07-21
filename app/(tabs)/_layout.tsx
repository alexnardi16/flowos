import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { palette } from '@/components/ui';
import { recordDiagnostic } from '@/lib/diagnostics';
import { useAuth } from '@/providers/AuthProvider';

export default function TabsLayout() {
  const { configured, loading, session } = useAuth();

  useEffect(() => {
    recordDiagnostic('tabs-layout-state', {
      configured,
      loading,
      hasSession: Boolean(session),
      userId: session?.user.id ?? null,
    });
  }, [configured, loading, session]);

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bg }}><ActivityIndicator /></View>;
  }

  if (configured && !session) {
    recordDiagnostic('tabs-layout-redirect-login');
    return <Redirect href="/login" />;
  }

  return <Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:palette.primary,tabBarStyle:{height:74,paddingBottom:12,paddingTop:8,borderTopWidth:0,elevation:10},tabBarLabelStyle:{fontWeight:'700'}}}>
    <Tabs.Screen name="index" options={{title:'Oggi',tabBarIcon:({color,size})=><Ionicons name="sparkles" color={color} size={size}/>}}/>
    <Tabs.Screen name="plan" options={{title:'Piano',tabBarIcon:({color,size})=><Ionicons name="calendar" color={color} size={size}/>}}/>
    <Tabs.Screen name="capture" options={{title:'Aggiungi',tabBarIcon:({color,size})=><Ionicons name="add-circle" color={color} size={size+10}/>}}/>
    <Tabs.Screen name="inbox" options={{title:'Inbox',tabBarIcon:({color,size})=><Ionicons name="layers" color={color} size={size}/>}}/>
    <Tabs.Screen name="me" options={{title:'Io',tabBarIcon:({color,size})=><Ionicons name="person" color={color} size={size}/>}}/>
  </Tabs>;
}
