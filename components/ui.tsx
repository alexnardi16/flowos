import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

export const palette = { bg:'#F6F7FB', card:'#FFFFFF', ink:'#172033', muted:'#687086', primary:'#6658D3', soft:'#ECE9FF', success:'#15866B', warning:'#B66A14' };

export function Card({ children, style }: PropsWithChildren<{style?: ViewStyle}>) { return <View style={[styles.card, style]}>{children}</View>; }
export function Chip({ children }: PropsWithChildren) { return <View style={styles.chip}><Text style={styles.chipText}>{children}</Text></View>; }
export function Button({ label, onPress, secondary=false }: {label:string; onPress:()=>void; secondary?:boolean}) { return <Pressable onPress={onPress} style={({pressed})=>[styles.button,secondary&&styles.secondary,pressed&&{opacity:.75}]}><Text style={[styles.buttonText,secondary&&{color:palette.primary}]}>{label}</Text></Pressable>; }

const styles=StyleSheet.create({
  card:{backgroundColor:palette.card,borderRadius:24,padding:18,shadowColor:'#000',shadowOpacity:.06,shadowRadius:18,shadowOffset:{width:0,height:6},elevation:2},
  chip:{alignSelf:'flex-start',backgroundColor:palette.soft,borderRadius:99,paddingHorizontal:10,paddingVertical:6},
  chipText:{fontSize:12,fontWeight:'700',color:palette.primary},
  button:{backgroundColor:palette.primary,borderRadius:16,paddingVertical:13,paddingHorizontal:16,alignItems:'center',justifyContent:'center',minWidth:92},
  secondary:{backgroundColor:palette.soft},buttonText:{color:'#fff',fontWeight:'800',fontSize:15}
});
