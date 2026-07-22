import { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

export const palette = {
  bg:'#F6F7FB', card:'#FFFFFF', ink:'#172033', muted:'#687086', primary:'#6658D3',
  soft:'#ECE9FF', success:'#15866B', warning:'#B66A14', danger:'#A12626', border:'#E2E4EA',
};

export function Card({ children, style }: PropsWithChildren<{style?: ViewStyle}>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({ children, tone='primary' }: PropsWithChildren<{tone?:'primary'|'success'|'warning'|'neutral'}>) {
  return <View style={[styles.chip, styles[`chip_${tone}`]]}><Text style={[styles.chipText, styles[`chipText_${tone}`]]}>{children}</Text></View>;
}

export function Button({ label, onPress, secondary=false, danger=false, disabled=false, loading=false }: {
  label:string; onPress:()=>void; secondary?:boolean; danger?:boolean; disabled?:boolean; loading?:boolean;
}) {
  const inactive = disabled || loading;
  return <Pressable disabled={inactive} onPress={onPress} accessibilityRole="button" accessibilityState={{disabled:inactive,busy:loading}} style={({pressed})=>[
    styles.button, secondary&&styles.secondary, danger&&styles.danger, inactive&&styles.disabled, pressed&&!inactive&&styles.pressed,
  ]}>
    {loading ? <ActivityIndicator color={secondary ? palette.primary : '#fff'} size="small"/> : <Text style={[styles.buttonText,secondary&&styles.secondaryText]}>{label}</Text>}
  </Pressable>;
}

export function SectionTitle({ title, subtitle }: {title:string; subtitle?:string}) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{subtitle?<Text style={styles.sectionSubtitle}>{subtitle}</Text>:null}</View>;
}

export function EmptyState({ title, message, actionLabel, onAction }: {title:string; message:string; actionLabel?:string; onAction?:()=>void}) {
  return <Card style={styles.emptyCard}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyMessage}>{message}</Text>{actionLabel&&onAction?<Button label={actionLabel} onPress={onAction}/>:null}</Card>;
}

const styles=StyleSheet.create({
  card:{backgroundColor:palette.card,borderRadius:22,padding:18,borderWidth:1,borderColor:'#EEF0F5',shadowColor:'#000',shadowOpacity:.045,shadowRadius:14,shadowOffset:{width:0,height:5},elevation:2},
  chip:{alignSelf:'flex-start',borderRadius:99,paddingHorizontal:10,paddingVertical:6},
  chip_primary:{backgroundColor:palette.soft},chip_success:{backgroundColor:'#E8F6F1'},chip_warning:{backgroundColor:'#FFF3E5'},chip_neutral:{backgroundColor:'#EEF0F4'},
  chipText:{fontSize:11,fontWeight:'800',letterSpacing:.35},chipText_primary:{color:palette.primary},chipText_success:{color:palette.success},chipText_warning:{color:palette.warning},chipText_neutral:{color:palette.muted},
  button:{backgroundColor:palette.primary,borderRadius:15,paddingVertical:13,paddingHorizontal:17,alignItems:'center',justifyContent:'center',minWidth:96,minHeight:46},
  secondary:{backgroundColor:palette.soft},danger:{backgroundColor:palette.danger},disabled:{opacity:.5},pressed:{transform:[{scale:.985}]},
  buttonText:{color:'#fff',fontWeight:'800',fontSize:15},secondaryText:{color:palette.primary},
  sectionHeader:{gap:3,marginTop:8},sectionTitle:{fontSize:19,fontWeight:'900',color:palette.ink},sectionSubtitle:{fontSize:13,lineHeight:18,color:palette.muted},
  emptyCard:{gap:12},emptyTitle:{fontSize:20,fontWeight:'900',color:palette.ink},emptyMessage:{fontSize:14,lineHeight:20,color:palette.muted},
});