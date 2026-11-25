import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Linking, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button, Card, palette, showAlert } from '@/components/ui';
import { FeedbackPressable as Pressable } from '@/components/FeedbackPressable';
import type { Commitment } from '@/types';
import { t, useLanguage, localeForLanguage } from '@/lib/i18n';
import { loadFlowOSAISettings, hasFlowOSAIAPIKey, generateFlowOSAIText } from '@/lib/flowosAI';
import { getUpcomingPersonalOccasions, buildPersonalMessagePrompt, type PersonalOccasion } from '@/lib/personalMessages';

type Channel = 'whatsapp' | 'email' | 'linkedin';
const tones = ['Caloroso','Affettuoso','Elegante','Informale','Professionale'] as const;

export function PersonalOccasionAssistant({commitments}:{commitments:Commitment[]}) {
  const {language}=useLanguage();
  const [enabled,setEnabled]=useState(false);
  const [configured,setConfigured]=useState(false);
  const [selected,setSelected]=useState<PersonalOccasion|null>(null);
  const [tone,setTone]=useState<(typeof tones)[number]>('Caloroso');
  const [channel,setChannel]=useState<Channel>('whatsapp');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [consent,setConsent]=useState(false);
  useFocusEffect(useCallback(()=>{let active=true;void(async()=>{try{const settings=await loadFlowOSAISettings();const key=await hasFlowOSAIAPIKey(settings.provider);if(active){setEnabled(settings.enabled);setConfigured(key);}}catch{if(active){setEnabled(false);setConfigured(false);}}})();return()=>{active=false;};},[]));
  const occasions=useMemo(()=>getUpcomingPersonalOccasions(commitments),[commitments]);
  if(!enabled)return null;
  const dateLabel=(date:Date)=>date.toLocaleDateString(localeForLanguage(language),{day:'numeric',month:'long',year:'numeric'});
  async function generate(){
    if(!selected||busy)return;
    if(!enabled||!configured){showAlert(t('FlowOS AI'),t('FlowOS AI deve essere attivata e configurata nelle Impostazioni per usare questa funzione.'));return;}
    setBusy(true);
    try{const prompt=buildPersonalMessagePrompt({occasion:selected,tone,channel,language});const result=await generateFlowOSAIText(prompt);setMessage(result.trim());}
    catch(error){showAlert(t('FlowOS AI'),error instanceof Error?error.message:'Generazione del messaggio non riuscita.');}
    finally{setBusy(false);}
  }
  async function copyMessage(){if(!message)return;try{await Clipboard.setStringAsync(message);showAlert(t('FlowOS AI'),t('Messaggio copiato.'));}catch{showAlert(t('FlowOS AI'),t('Copia non riuscita.'));}}
  async function openChannel(){
    if(!message)return;
    const encoded=encodeURIComponent(message);
    const url=channel==='whatsapp'?'https://wa.me/?text='+encoded:channel==='email'?'mailto:?subject='+encodeURIComponent(selected?.type==='birthday'?'Happy birthday':'Best wishes')+'&body='+encoded:'https://www.linkedin.com/messaging/';
    try{if(channel==='linkedin')await Clipboard.setStringAsync(message);await Linking.openURL(url);if(channel==='linkedin')showAlert(t('LinkedIn'),t('Per LinkedIn il testo viene copiato: FlowOS apre la messaggistica, ma non può precompilare o inviare il messaggio.'));else showAlert(t('FlowOS AI'),t('Messaggio pronto: incollalo nella conversazione prima di inviarlo.'));}
    catch{showAlert(t('FlowOS AI'),t('Impossibile aprire l’app selezionata. Copia il testo e incollalo manualmente.'));}
  }
  const channels:Channel[]=['whatsapp','email','linkedin'];
  return <Card style={styles.card}>
    <Text style={styles.heading}>{t('Occasioni personali')}</Text>
    <Text style={styles.description}>{t('Compleanni e anniversari in arrivo')}</Text>
    {occasions.length===0?<Text style={styles.description}>{t('Nessuna occasione personale nei prossimi 12 mesi.')}</Text>:<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>{occasions.map(occasion=><Pressable key={occasion.item.id} accessibilityRole="button" onPress={()=>{setSelected(occasion);setMessage('');setConsent(false);}} style={[styles.occasion,selected?.item.id===occasion.item.id&&styles.selected]}><Text style={styles.occasionType}>{t(occasion.type==='birthday'?'Compleanno':'Anniversario')}</Text><Text style={styles.person}>{occasion.personName||occasion.item.title}</Text><Text style={styles.date}>{dateLabel(occasion.date)}</Text><Text style={styles.action}>{t('Crea un messaggio')}</Text></Pressable>)}</ScrollView>}
    <Text style={styles.disclaimer}>{t('Il messaggio non viene mai inviato automaticamente.')}</Text>
    <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={()=>setSelected(null)}>
      <View style={styles.backdrop}><View style={styles.modal}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>{t('Crea un messaggio')}</Text>
          <Text style={styles.description}>{selected?.personName||selected?.item.title} · {selected?dateLabel(selected.date):''}</Text>
          <Text style={styles.fieldLabel}>{t('Tono')}</Text><View style={styles.chips}>{tones.map(value=><Pressable key={value} onPress={()=>{setTone(value);setMessage('');}} style={[styles.chip,tone===value&&styles.chipSelected]}><Text style={[styles.chipText,tone===value&&styles.chipTextSelected]}>{t(value)}</Text></Pressable>)}</View>
          <Text style={styles.fieldLabel}>{t('Canale')}</Text><View style={styles.chips}>{channels.map(value=><Pressable key={value} onPress={()=>{setChannel(value);setMessage('');}} style={[styles.chip,channel===value&&styles.chipSelected]}><Text style={[styles.chipText,channel===value&&styles.chipTextSelected]}>{value==='email'?'Gmail':value==='whatsapp'?'WhatsApp':'LinkedIn'}</Text></Pressable>)}</View>
          {!consent?<><Text style={styles.description}>{t('Prima di generare, conferma che il titolo e la data dell’occasione saranno inviati direttamente al provider AI selezionato. Non vengono inviati note o altri dettagli privati.')}</Text><Button label={t('Confermo e genera')} onPress={()=>{setConsent(true);void generate();}} disabled={!configured||busy} loading={busy}/></>:<Button label={t('Genera messaggio')} onPress={()=>void generate()} disabled={!configured||busy} loading={busy}/>}
          {!configured?<Text style={styles.description}>{t('FlowOS AI deve essere attivata e configurata nelle Impostazioni per usare questa funzione.')}</Text>:null}
          {message?<><View style={styles.messageBox}><Text style={styles.message}>{message}</Text></View><Button label={t('Copia messaggio')} secondary onPress={()=>void copyMessage()}/><Button label={t(channel==='whatsapp'?'Apri WhatsApp':channel==='email'?'Apri Gmail':'Apri LinkedIn')} onPress={()=>void openChannel()}/></>:null}
          <Button label={t('Annulla')} secondary onPress={()=>setSelected(null)}/>
        </ScrollView>
      </View></View>
    </Modal>
  </Card>;
}

const styles=StyleSheet.create({
  card:{gap:10},
  heading:{fontSize:16,fontWeight:'800',color:palette.ink},
  description:{fontSize:12,lineHeight:17,color:palette.muted},
  list:{gap:8,paddingVertical:2},
  occasion:{minWidth:150,maxWidth:190,borderWidth:1,borderColor:palette.border,borderRadius:12,padding:10,gap:5,backgroundColor:palette.card},
  selected:{borderColor:palette.primary},
  occasionType:{fontSize:10,fontWeight:'800',color:palette.primary,textTransform:'uppercase'},
  person:{fontSize:14,fontWeight:'700',color:palette.ink},
  date:{fontSize:11,color:palette.muted},
  action:{fontSize:11,fontWeight:'700',color:palette.primary},
  disclaimer:{fontSize:11,color:palette.muted},
  backdrop:{flex:1,backgroundColor:'rgba(12,16,28,0.5)',justifyContent:'center',padding:18},
  modal:{maxHeight:'88%',width:'100%',maxWidth:480,alignSelf:'center',backgroundColor:palette.card,borderRadius:20,padding:16,gap:12},
  fieldLabel:{fontSize:13,fontWeight:'800',color:palette.ink,marginTop:8},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:7},
  chip:{borderWidth:1,borderColor:palette.border,borderRadius:18,paddingHorizontal:11,paddingVertical:8},
  chipSelected:{backgroundColor:palette.primary,borderColor:palette.primary},
  chipText:{fontSize:11,fontWeight:'700',color:palette.ink},
  chipTextSelected:{color:'#FFFFFF'},
  messageBox:{borderWidth:1,borderColor:palette.border,borderRadius:12,padding:12,marginVertical:8},
  message:{fontSize:14,lineHeight:21,color:palette.ink}
});
