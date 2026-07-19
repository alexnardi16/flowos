import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@/components/ui';
export default function TabsLayout(){return <Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:palette.primary,tabBarStyle:{height:74,paddingBottom:12,paddingTop:8,borderTopWidth:0,elevation:10},tabBarLabelStyle:{fontWeight:'700'}}}>
<Tabs.Screen name="index" options={{title:'Oggi',tabBarIcon:({color,size})=><Ionicons name="sparkles" color={color} size={size}/>}}/>
<Tabs.Screen name="plan" options={{title:'Piano',tabBarIcon:({color,size})=><Ionicons name="calendar" color={color} size={size}/>}}/>
<Tabs.Screen name="capture" options={{title:'Aggiungi',tabBarIcon:({color,size})=><Ionicons name="add-circle" color={color} size={size+10}/>}}/>
<Tabs.Screen name="inbox" options={{title:'Inbox',tabBarIcon:({color,size})=><Ionicons name="layers" color={color} size={size}/>}}/>
<Tabs.Screen name="me" options={{title:'Io',tabBarIcon:({color,size})=><Ionicons name="person" color={color} size={size}/>}}/>
</Tabs>}
