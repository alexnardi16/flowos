import { Linking, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { Button, Card, palette } from '@/components/ui';

export default function PrivacyPolicy() {
  const deleteUrl = 'https://getflowos.netlify.app/delete-account';
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.wrap}>
    <Text style={styles.eyebrow}>FLOWOS</Text>
    <Text style={styles.title}>Privacy Policy</Text>
    <Text style={styles.date}>Ultimo aggiornamento: 9 settembre 2026</Text>

    <Card><Text style={styles.heading}>Dati trattati</Text><Text style={styles.body}>FlowOS tratta i dati necessari per fornire il servizio: account e identificativi di autenticazione, attività create nell'app, dati sincronizzati con Google Calendar e Google Tasks e preferenze di sincronizzazione.</Text></Card>
    <Card><Text style={styles.heading}>Google</Text><Text style={styles.body}>Se colleghi Google, FlowOS accede ai calendari e alle liste Google Tasks che autorizzi, per sincronizzare eventi e attività. I token OAuth sono conservati lato server in un'area privata e non vengono esposti al client. Puoi scollegare Google dalle Impostazioni.</Text></Card>
    <Card><Text style={styles.heading}>Posizione e meteo</Text><Text style={styles.body}>La versione attuale di FlowOS non richiede, raccoglie o trasmette la posizione del dispositivo. Le funzionalità meteo basate sulla posizione non fanno parte della versione distribuita.</Text></Card>
    <Card><Text style={styles.heading}>IA</Text><Text style={styles.body}>Quando la modalità IA è disponibile, il testo inserito per interpretare un'attività può essere inviato a OpenAI tramite un server FlowOS. La richiesta è configurata per non memorizzare la risposta presso OpenAI.</Text></Card>
    <Card><Text style={styles.heading}>Notifiche e diagnostica locale</Text><Text style={styles.body}>FlowOS può utilizzare le notifiche locali del dispositivo per i promemoria. Alcune informazioni tecniche limitate relative alle notifiche e alla diagnostica possono essere conservate localmente sul dispositivo e non vengono utilizzate per creare un profilo pubblicitario.</Text></Card>
    <Card><Text style={styles.heading}>Conservazione e sicurezza</Text><Text style={styles.body}>I dati FlowOS sono associati al tuo account. L'accesso ai dati applicativi è protetto da Row Level Security. I token Google sono conservati in un'area database privata e gestiti da Edge Functions autenticate.</Text></Card>
    <Card><Text style={styles.heading}>Eliminazione dell'account</Text><Text style={styles.body}>Puoi richiedere l'eliminazione definitiva dell'account e dei dati associati dalla pagina dedicata. L'operazione elimina i dati FlowOS, i token Google e l'account di autenticazione. L'eliminazione è irreversibile.</Text><Button danger label="Elimina account" onPress={() => { void Linking.openURL(deleteUrl); }} /></Card>
    <Text style={styles.footer}>Per richieste relative alla privacy o ai dati personali, utilizza i canali di contatto indicati nella scheda dello sviluppatore su Google Play.</Text>
  </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:20,paddingBottom:40,gap:14},eyebrow:{fontSize:12,fontWeight:'900',letterSpacing:1.5,color:palette.primary},title:{fontSize:32,fontWeight:'900',color:palette.ink},date:{fontSize:13,color:palette.muted,marginBottom:4},heading:{fontSize:18,fontWeight:'900',color:palette.ink,marginBottom:8},body:{fontSize:14,lineHeight:21,color:palette.muted},footer:{fontSize:12,lineHeight:18,color:palette.muted,paddingBottom:30}});
