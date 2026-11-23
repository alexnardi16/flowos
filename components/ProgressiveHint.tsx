import { FeedbackPressable as Pressable } from '@/components/FeedbackPressable';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palette } from '@/components/ui';
import { t } from '@/lib/i18n';

export function ProgressiveHint({id,children}:{id:string;children:string}) {
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    let active=true;
    void AsyncStorage.getItem(`flowos-onboarding-${id}-v1`).then(value=>{if(active&&!value)setVisible(true);}).catch(()=>{if(active)setVisible(true);});
    return()=>{active=false;};
  },[id]);
  if(!visible)return null;
  return <View style={styles.container}>
    <Text style={styles.message}>{children}</Text>
    <Pressable accessibilityRole="button" onPress={()=>{setVisible(false);void AsyncStorage.setItem(`flowos-onboarding-${id}-v1`,'1').catch(()=>undefined);}} style={styles.dismiss}><Text style={styles.dismissText}>{t('Ho capito')}</Text></Pressable>
  </View>;
}
const styles=StyleSheet.create({
  container:{padding:12,borderRadius:12,backgroundColor:palette.soft,borderWidth:1,borderColor:palette.border,gap:8},
  message:{fontSize:12,lineHeight:17,color:palette.ink},
  dismiss:{alignSelf:'flex-end',minHeight:36,justifyContent:'center',paddingHorizontal:8},
  dismissText:{fontSize:12,fontWeight:'700',color:palette.primary}
});