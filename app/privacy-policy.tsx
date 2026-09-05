import { Linking, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { Button, Card, palette } from '@/components/ui';

export default function PrivacyPolicy() {
  const deleteUrl = 'https://getflowos.netlify.app/delete-account/';
  const webPolicyUrl = 'https://getflowos.netlify.app/privacy-policy/';
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.wrap}>
    <Text style={styles.eyebrow}>FLOWOS</Text>
    <Text style={styles.title}>Privacy Policy</Text>
    <Text style={styles.date}>Last updated: September 5, 2026</Text>

    <Card><Text style={styles.heading}>Developer and privacy contact</Text><Text style={styles.body}>FlowOS. For privacy questions or requests, contact alex16nardi@gmail.com. The complete current policy is available online.</Text><Button label="Open full Privacy Policy" onPress={() => { void Linking.openURL(webPolicyUrl); }} /></Card>
    <Card><Text style={styles.heading}>Data handled</Text><Text style={styles.body}>FlowOS handles the data needed to provide the service: your Google account identity, FlowOS account identifier, tasks, events, reminders and other commitments you create, application preferences, and data synchronized with Google Calendar and Google Tasks when you connect Google.</Text></Card>
    <Card><Text style={styles.heading}>Google</Text><Text style={styles.body}>If you connect Google, FlowOS accesses the Google Calendar and Google Tasks data covered by the permissions you authorize, to synchronize events and tasks. Google OAuth tokens are stored server-side in a private database area and are not exposed to the application client. Google data is used only for the FlowOS features you request and is not used for advertising.</Text></Card>
    <Card><Text style={styles.heading}>Weather and location</Text><Text style={styles.body}>If you enable weather, FlowOS requests device location while the feature is being used to obtain today's forecast from Open-Meteo. FlowOS does not maintain a location history or build a location profile.</Text></Card>
    <Card><Text style={styles.heading}>AI</Text><Text style={styles.body}>When you use an AI-powered feature, text needed to interpret or plan a commitment may be sent to OpenAI through a FlowOS server. The relevant API requests are configured not to store responses through the API storage option.</Text></Card>
    <Card><Text style={styles.heading}>Security and retention</Text><Text style={styles.body}>Application data is protected by authentication and row-level access controls. Google OAuth tokens are stored in a private server-side area. FlowOS retains account and application data while needed to provide the service, unless deletion is requested or a longer retention period is required by law.</Text></Card>
    <Card><Text style={styles.heading}>Account deletion</Text><Text style={styles.body}>You can request permanent deletion of your FlowOS account and associated data from the dedicated page. The deletion process removes FlowOS data, Google connection data and stored OAuth tokens, subject to data that must lawfully be retained.</Text><Button danger label="Delete account" onPress={() => { void Linking.openURL(deleteUrl); }} /></Card>
    <Text style={styles.footer}>The complete Privacy Policy, including information about third-party services and your choices, is available online at getflowos.netlify.app/privacy-policy/.</Text>
  </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:20,paddingBottom:40,gap:14},eyebrow:{fontSize:12,fontWeight:'900',letterSpacing:1.5,color:palette.primary},title:{fontSize:32,fontWeight:'900',color:palette.ink},date:{fontSize:13,color:palette.muted,marginBottom:4},heading:{fontSize:18,fontWeight:'900',color:palette.ink,marginBottom:8},body:{fontSize:14,lineHeight:21,color:palette.muted},footer:{fontSize:12,lineHeight:18,color:palette.muted,paddingBottom:30}});
