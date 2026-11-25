import { Linking, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { Button, Card, palette } from '@/components/ui';
import { t, useLanguage } from '@/lib/i18n';

export default function PrivacyPolicy() {
  const { language } = useLanguage();
  const fullPolicyUrl = language === 'it'
    ? 'https://getflowos.netlify.app/it/privacy-policy/'
    : 'https://getflowos.netlify.app/privacy-policy/';
  const deleteUrl = 'https://getflowos.netlify.app/delete-account/';
  return <SafeAreaView style={styles.safe}><ScrollView showsVerticalScrollIndicator persistentScrollbar contentContainerStyle={styles.wrap}>
    <Text style={styles.eyebrow}>FLOWOS</Text>
    <Text style={styles.title}>{t('Informativa sulla privacy')}</Text>
    <Text style={styles.date}>{t('Ultimo aggiornamento: 25 novembre 2026')}</Text>
    <Card><Text style={styles.heading}>{t('Dati trattati')}</Text><Text style={styles.body}>{t('I dati del tuo account e le attività che crei sono trattati per fornire il servizio. I dati Google vengono trattati solo se colleghi Google Calendar o Google Tasks.')}</Text></Card>
    <Card><Text style={styles.heading}>{t('FlowOS AI')}</Text><Text style={styles.body}>{t('FlowOS AI è facoltativa ed è disattivata per impostazione predefinita. Le richieste sono inviate direttamente al provider selezionato dopo la tua conferma. In base alla funzione, possono includere trascrizioni vocali, titoli di attività, dati di occasioni personali, query e fonti di ricerca o dettagli dei messaggi. Il provider applica le proprie condizioni di conservazione e utilizzo dei dati.')}</Text><Text style={styles.body}>{t('Non inviare informazioni aziendali riservate, dati personali sensibili, password o token ai provider AI.')}</Text><Text style={styles.body}>{t('La API key del provider è conservata nell’archivio sicuro del dispositivo e non è sincronizzata con FlowOS o Google. Puoi eliminarla dalle Impostazioni AI.')}</Text><Text style={styles.body}>{t('I provider possono applicare costi e condizioni proprie; FlowOS non paga le richieste AI.')}</Text></Card>
    <Card><Text style={styles.heading}>{t('Eliminazione e diritti')}</Text><Text style={styles.body}>{t('Puoi eliminare il tuo account FlowOS dall’app o richiederne la cancellazione tramite la pagina pubblica dedicata.')}</Text><Button danger label={t('Elimina definitivamente l’account FlowOS')} onPress={() => { void Linking.openURL(deleteUrl); }} /></Card>
    <Button secondary label={t('Apri informativa completa')} onPress={() => { void Linking.openURL(fullPolicyUrl); }} />
    <Text style={styles.footer}>support.flowos@gmail.com</Text>
  </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:20,paddingBottom:40,gap:14},eyebrow:{fontSize:12,fontWeight:'900',letterSpacing:1.5,color:palette.primary},title:{fontSize:32,fontWeight:'900',color:palette.ink},date:{fontSize:13,color:palette.muted,marginBottom:4},heading:{fontSize:18,fontWeight:'900',color:palette.ink,marginBottom:8},body:{fontSize:14,lineHeight:21,color:palette.muted},footer:{fontSize:12,lineHeight:18,color:palette.muted,paddingBottom:30}});
