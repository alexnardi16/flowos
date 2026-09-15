import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BuildInfo } from './BuildInfo';
import { subscribeToSyncProgress } from '@/lib/googleWorkspace';
import { palette } from './ui';
export function AppChrome(){const pathname=usePathname();const insets=useSafeAreaInsets();const[progress,setProgress]=useState<{percent:number;stage:string}|null>(null);useEffect(()=>subscribeToSyncProgress(value=>setProgress(value.percent>=100?null:value)),[]);const tabSafeBottom=insets.bottom;return <>{progress?<View pointerEvents="none" style={[styles.sync,{bottom:66+tabSafeBottom+6}]}><View style={[styles.syncFill,{width:`${progress.percent}%`}]}/><Text style={styles.syncText}>{progress.stage} · {progress.percent}%</Text></View>:null}<View pointerEvents="none" style={[styles.footer,{bottom:Math.max(2,tabSafeBottom)}]}><BuildInfo/></View></>}
const styles=StyleSheet.create({sync:{position:'absolute',left:12,right:12,height:25,borderRadius:13,overflow:'hidden',justifyContent:'center',backgroundColor:'#ECEEF4',zIndex:9998,elevation:20},syncFill:{position:'absolute',left:0,top:0,bottom:0,backgroundColor:palette.soft},syncText:{textAlign:'center',fontSize:10,fontWeight:'800',color:palette.primary},footer:{position:'absolute',left:0,right:0,height:16,alignItems:'center',zIndex:10000}});
