import { PropsWithChildren, RefObject, ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Appearance, DynamicColorIOS, Image, Platform, PlatformColor, Pressable, ScrollView, ScrollViewProps, StyleSheet, StyleProp, Text, View, ViewProps, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BuildInfo } from './BuildInfo';
import { getWidgetAppearance, type AppTheme, type AppFontSize, type WidgetDensity } from '@/lib/widgetAppearance';
import { supabase } from '@/lib/supabase';
import { t } from '@/lib/i18n';

export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function showConfirm(title: string, message: string, confirmLabel = t('Conferma')): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return Promise.resolve(false);
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: t('Annulla'), style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

const adaptiveColor=(light:string,dark:string,androidResource:string)=>Platform.OS==='ios'?DynamicColorIOS({light,dark}):Platform.OS==='android'?PlatformColor(androidResource):light;
export const palette = {
  bg:adaptiveColor('#F6F7FB','#10121A','?android:attr/colorBackground'),
  card:adaptiveColor('#FFFFFF','#1B1E29','?android:attr/colorBackgroundFloating'),
  ink:adaptiveColor('#172033','#F2F3F8','?android:attr/textColorPrimary'),
  muted:adaptiveColor('#5F687B','#AAB1C2','?android:attr/textColorSecondary'),
  primary:'#6658D3',
  soft:adaptiveColor('#ECE9FF','#2A2546','?android:attr/colorControlHighlight'),
  success:Platform.OS==='ios'?DynamicColorIOS({light:'#15866B',dark:'#55C6A2'}):'#15866B',
  info:Platform.OS==='ios'?DynamicColorIOS({light:'#2874C8',dark:'#69A7F2'}):'#2874C8',
  warning:Platform.OS==='ios'?DynamicColorIOS({light:'#A65E0B',dark:'#F0B45B'}):'#A65E0B',
  danger:Platform.OS==='ios'?DynamicColorIOS({light:'#A12626',dark:'#FF7777'}):'#A12626',
  border:adaptiveColor('#E2E4EA','#383D4C','?android:attr/colorControlHighlight'),
};

export const layoutTokens = { cardRadius:16, buttonRadius:12, sectionGap:18, cardPadding:14, inlineGap:6 } as const;
export const typeScale = { screenTitle:26, sectionTitle:18, cardTitle:16, body:14, metadata:12, label:12 } as const;
export function getTypeScale(size:AppFontSize='standard'){
  const factor=size==='small'?0.92:size==='large'?1.12:1;
  return {screenTitle:Math.round(typeScale.screenTitle*factor),sectionTitle:Math.round(typeScale.sectionTitle*factor),cardTitle:Math.round(typeScale.cardTitle*factor),body:Math.round(typeScale.body*factor),metadata:Math.round(typeScale.metadata*factor),label:Math.round(typeScale.label*factor)};
}

const DensityContext=createContext<{density:WidgetDensity;setDensity:(density:WidgetDensity)=>void;appTheme:AppTheme;setAppTheme:(theme:AppTheme)=>void;appFontSize:AppFontSize;setAppFontSize:(size:AppFontSize)=>void}>({density:'balanced',setDensity:()=>undefined,appTheme:'system',setAppTheme:()=>undefined,appFontSize:'standard',setAppFontSize:()=>undefined});
export function DensityProvider({children}:PropsWithChildren){
  const [density,setDensity]=useState<WidgetDensity>('balanced');
  const [appThemeState,setAppThemeState]=useState<AppTheme>('system');
  const [appFontSize,setAppFontSize]=useState<AppFontSize>('standard');
  const setAppTheme=(theme:AppTheme)=>{setAppThemeState(theme);Appearance.setColorScheme(theme==='system'?'unspecified':theme);};
  useEffect(()=>{let active=true;const load=()=>{void getWidgetAppearance().then(value=>{if(active){setDensity(value.density);setAppTheme(value.appTheme);setAppFontSize(value.appFontSize);}}).catch(()=>undefined);};load();const {data:{subscription}}=supabase.auth.onAuthStateChange(load);return()=>{active=false;subscription.unsubscribe();};},[]);
  return <DensityContext.Provider value={{density,setDensity,appTheme:appThemeState,setAppTheme,appFontSize,setAppFontSize}}>{children}</DensityContext.Provider>;
}
export function useAppDensity(){return useContext(DensityContext);}

export function ScreenShell({ title, subtitle, children, scrollProps, scrollRef, headerActions }: PropsWithChildren<{ title:string; subtitle?:string; scrollProps?:ScrollViewProps; scrollRef?:RefObject<ScrollView|null>; headerActions?:ReactNode }>) {
  const insets = useSafeAreaInsets();
  const {density,appFontSize}=useAppDensity();
  const textScale=getTypeScale(appFontSize);
  const contentPaddingBottom = Math.max(118, insets.bottom + 112);
  return <SafeAreaView edges={['top','bottom']} style={styles.screenSafe}>
    <View style={styles.screenHeader}>
      <View style={styles.screenBrandRow}>
        <View style={styles.screenBrandLeft}>
          <Image source={require("../assets/flowos-app-icon-512-store.png")} style={styles.screenLogo} resizeMode="contain" accessibilityLabel="Logo FlowOS" />
          <Text style={styles.screenBrand}>FlowOS</Text>
        </View>
        <BuildInfo inline />
      </View>
      <Text style={[styles.screenTitle,{fontSize:textScale.screenTitle,lineHeight:Math.round(textScale.screenTitle*1.23)}]}>{title}</Text>
      {subtitle ? <Text style={[styles.screenSubtitle,{fontSize:textScale.body}]}>{subtitle}</Text> : null}
      {headerActions}
    </View>
    <ScrollView ref={scrollRef} {...scrollProps} style={styles.screenScroll} showsVerticalScrollIndicator persistentScrollbar contentContainerStyle={[styles.screenContent, scrollProps?.contentContainerStyle, { paddingHorizontal:density==='compact'?16:density==='comfortable'?22:20,gap:density==='compact'?10:density==='comfortable'?18:14,paddingBottom:contentPaddingBottom }]}>
      {children}
    </ScrollView>
  </SafeAreaView>;
}

export function Card({ children, style, onLayout }: PropsWithChildren<{style?: StyleProp<ViewStyle>; onLayout?: ViewProps['onLayout']}>) {
  const {density}=useAppDensity();
  return <View style={[styles.card,{padding:density==='compact'?10:density==='comfortable'?18:14},style]} onLayout={onLayout}>{children}</View>;
}

export function ActivityKindTag({kind,completed=false}:{kind:'task'|'event';completed?:boolean}) {
  const {appFontSize}=useAppDensity();const textScale=getTypeScale(appFontSize);
  const color=completed?palette.success:palette.primary;
  return <View accessibilityRole="text" accessibilityLabel={completed?`${kind==='event'?t('EVENTO'):t('TASK')} · ${t('COMPLETATA')}`:kind==='event'?t('EVENTO'):t('TASK')} style={[styles.kindTag,{backgroundColor:palette.soft}]}><Ionicons name={kind==='event'?'calendar-outline':'checkbox-outline'} size={13} color={color}/><Text style={[styles.kindTagText,{color,fontSize:Math.max(10,textScale.label-1)}]}>{completed?t('COMPLETATA'):kind==='event'?t('EVENTO'):t('TASK')}</Text></View>;
}

export function Chip({ children, tone='primary' }: PropsWithChildren<{tone?:'primary'|'success'|'warning'|'neutral'}>) {
  const {appFontSize}=useAppDensity();const textScale=getTypeScale(appFontSize);
  return <View style={[styles.chip, styles[`chip_${tone}`]]}><Text style={[styles.chipText,{fontSize:textScale.label}, styles[`chipText_${tone}`]]}>{children}</Text></View>;
}

export function Button({ label, onPress, secondary=false, danger=false, disabled=false, loading=false, style }: {
  label:string; onPress:()=>void; secondary?:boolean; danger?:boolean; disabled?:boolean; loading?:boolean; style?: StyleProp<ViewStyle>;
}) {
  const {density,appFontSize}=useAppDensity();
  const textScale=getTypeScale(appFontSize);
  const inactive = disabled || loading;
  return <Pressable disabled={inactive} onPress={onPress} accessibilityRole="button" accessibilityState={{disabled:inactive,busy:loading}} style={({pressed})=>[
    styles.button,{minHeight:density==='comfortable'?52:48,paddingVertical:density==='compact'?10:12}, secondary&&styles.secondary, danger&&styles.danger, inactive&&styles.disabled, pressed&&!inactive&&styles.pressed, style,
  ]}>
    {loading ? <ActivityIndicator color={secondary ? palette.primary : '#fff'} size="small"/> : <Text style={[styles.buttonText,{fontSize:textScale.body+1},secondary&&styles.secondaryText]}>{label}</Text>}
  </Pressable>;
}

export function SectionTitle({ title, subtitle }: {title:string; subtitle?:string}) {
  const {density,appFontSize}=useAppDensity();
  const textScale=getTypeScale(appFontSize);
  return <View style={[styles.sectionHeader,{marginTop:density==='compact'?4:8,gap:density==='compact'?1:3}]}><Text style={[styles.sectionTitle,{fontSize:textScale.sectionTitle}]}>{title}</Text>{subtitle?<Text style={[styles.sectionSubtitle,{fontSize:textScale.metadata+1}]}>{subtitle}</Text>:null}</View>;
}

export function EmptyState({ title, message, actionLabel, onAction }: {title:string; message:string; actionLabel?:string; onAction?:()=>void}) {
  return <Card style={styles.emptyCard}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyMessage}>{message}</Text>{actionLabel&&onAction?<Button label={actionLabel} onPress={onAction}/>:null}</Card>;
}

const styles=StyleSheet.create({
  screenSafe:{flex:1,backgroundColor:palette.bg},
  screenHeader:{paddingHorizontal:20,paddingTop:8,paddingBottom:4,gap:14,backgroundColor:palette.bg,zIndex:1},
  screenScroll:{flex:1},
  screenContent:{paddingHorizontal:20,paddingTop:8,gap:14},
  screenBrandRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:38},
  screenBrandLeft:{flexDirection:'row',alignItems:'center',gap:9},
  screenLogo:{width:34,height:34,borderRadius:9},
  screenBrand:{fontSize:16,lineHeight:20,fontWeight:'700',letterSpacing:0.2,color:palette.primary,marginTop:2},
  screenTitle:{fontSize:typeScale.screenTitle,lineHeight:32,fontWeight:'700',color:palette.ink,marginTop:-2},
  screenSubtitle:{fontSize:14,lineHeight:20,color:palette.muted,marginTop:-4},
  card:{backgroundColor:palette.card,borderRadius:layoutTokens.cardRadius,padding:layoutTokens.cardPadding,borderWidth:1,borderColor:palette.border,shadowColor:'#000',shadowOpacity:.045,shadowRadius:14,shadowOffset:{width:0,height:5},elevation:2},
  kindTag:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:5,borderRadius:99,paddingHorizontal:9,paddingVertical:5},kindTagText:{fontSize:10,fontWeight:'700',letterSpacing:.2},
  chip:{alignSelf:'flex-start',borderRadius:99,paddingHorizontal:10,paddingVertical:6},
  chip_primary:{backgroundColor:palette.soft},chip_success:{backgroundColor:palette.soft},chip_warning:{backgroundColor:palette.soft},chip_neutral:{backgroundColor:palette.soft},
  chipText:{fontSize:11,fontWeight:'700',letterSpacing:.35},chipText_primary:{color:palette.primary},chipText_success:{color:palette.success},chipText_warning:{color:palette.warning},chipText_neutral:{color:palette.muted},
  button:{backgroundColor:palette.primary,borderRadius:layoutTokens.buttonRadius,paddingVertical:12,paddingHorizontal:17,alignItems:'center',justifyContent:'center',minWidth:96,minHeight:48},
  secondary:{backgroundColor:palette.soft},danger:{backgroundColor:palette.danger},disabled:{opacity:.5},pressed:{transform:[{scale:.985}]},
  buttonText:{color:'#fff',fontWeight:'700',fontSize:15,textAlign:'center'},secondaryText:{color:palette.primary,textAlign:'center'},
  sectionHeader:{gap:3,marginTop:8},sectionTitle:{fontSize:typeScale.sectionTitle,fontWeight:'700',color:palette.ink},sectionSubtitle:{fontSize:13,lineHeight:18,color:palette.muted},
  emptyCard:{gap:12},emptyTitle:{fontSize:20,fontWeight:'700',color:palette.ink},emptyMessage:{fontSize:14,lineHeight:20,color:palette.muted},
});