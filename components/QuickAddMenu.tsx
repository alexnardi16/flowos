import { FeedbackPressable as Pressable } from '@/components/FeedbackPressable';
import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@/components/ui';
import { t } from '@/lib/i18n';

export function QuickAddMenu({date,compact=false}:{date?:string;compact?:boolean}) {
  const [visible,setVisible]=useState(false);
  function open(kind?:'task'|'event',voice=false) {
    setVisible(false);
    router.push({pathname:'/capture',params:{...(kind?{kind}:{}),...(date?{date}:{}),...(voice?{voice:String(Date.now())}:{})}});
  }
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Creazione rapida')} onPress={()=>setVisible(true)} style={[styles.trigger,compact&&styles.triggerCompact]}>
      <Ionicons name="add" size={20} color="#FFFFFF"/>
      {!compact?<Text style={styles.triggerText}>{t('Aggiungi')}</Text>:null}
    </Pressable>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={()=>setVisible(false)}>
      <Pressable style={styles.overlay} onPress={()=>setVisible(false)}>
        <View style={styles.menu}>
          <Text style={styles.title}>{t('Cosa vuoi creare?')}</Text>
          <Pressable accessibilityRole="button" onPress={()=>open('task')} style={styles.option}><Ionicons name="checkbox-outline" size={20} color={palette.primary}/><Text style={styles.optionText}>{t('Task')}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={()=>open('event')} style={styles.option}><Ionicons name="calendar-outline" size={20} color={palette.primary}/><Text style={styles.optionText}>{t('Evento')}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={()=>open(undefined,true)} style={styles.option}><Ionicons name="mic-outline" size={20} color={palette.primary}/><Text style={styles.optionText}>{t('Comando vocale')}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={()=>setVisible(false)} style={styles.cancel}><Text style={styles.cancelText}>{t('Annulla')}</Text></Pressable>
        </View>
      </Pressable>
    </Modal>
  </>;
}
const styles=StyleSheet.create({
  trigger:{minHeight:44,minWidth:44,paddingHorizontal:12,borderRadius:13,backgroundColor:palette.primary,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},
  triggerCompact:{width:44,paddingHorizontal:0},triggerText:{fontSize:12,fontWeight:'700',color:'#FFFFFF'},
  overlay:{flex:1,backgroundColor:'rgba(12,16,30,0.32)',justifyContent:'flex-end',padding:14},
  menu:{marginBottom:42,backgroundColor:palette.card,borderRadius:20,padding:16,gap:8,borderWidth:1,borderColor:palette.border},
  title:{fontSize:17,fontWeight:'700',color:palette.ink,marginBottom:4},
  option:{minHeight:48,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:12,borderRadius:12,backgroundColor:palette.soft},
  optionText:{fontSize:15,fontWeight:'600',color:palette.ink},
  cancel:{minHeight:44,alignItems:'center',justifyContent:'center',marginTop:3},
  cancelText:{fontSize:14,fontWeight:'700',color:palette.muted}
});