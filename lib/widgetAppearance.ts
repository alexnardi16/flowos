import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export type SourceAppearance = { color: string; opacity: number };
export type WidgetTheme = 'flowos-light' | 'flowos-dark' | 'minimal-transparent' | 'high-contrast' | 'soft-pastel';
export type WidgetDensity = 'comfortable' | 'balanced' | 'compact';
export type AppTheme = 'system' | 'light' | 'dark';
export type WidgetAppearance = {
  appTheme: AppTheme;
  theme: WidgetTheme;
  density: WidgetDensity;
  todayTransparentUnusedSpace: boolean;
  today: { backgroundColor: string; backgroundOpacity: number; textColor: string; textOpacity: number; buttonBackgroundColor: string; buttonBackgroundOpacity: number; buttonTextColor: string; buttonTextOpacity: number };
  calendar: { backgroundColor: string; backgroundOpacity: number; textColor: string; textOpacity: number; buttonBackgroundColor: string; buttonBackgroundOpacity: number; buttonTextColor: string; buttonTextOpacity: number };
  sources: Record<string, SourceAppearance>;
};

export const DEFAULT_WIDGET_APPEARANCE: WidgetAppearance = {
  appTheme: 'system',
  theme: 'flowos-light',
  density: 'balanced',
  todayTransparentUnusedSpace: true,
  today: { backgroundColor: '#F1F4FF', backgroundOpacity: 100, textColor: '#172033', textOpacity: 100, buttonBackgroundColor: '#6658D3', buttonBackgroundOpacity: 100, buttonTextColor: '#FFFFFF', buttonTextOpacity: 100 },
  calendar: { backgroundColor: '#F1F4FF', backgroundOpacity: 100, textColor: '#172033', textOpacity: 100, buttonBackgroundColor: '#4254C5', buttonBackgroundOpacity: 100, buttonTextColor: '#FFFFFF', buttonTextOpacity: 100 },
  sources: {},
};
const STORAGE_PREFIX = 'flowos-widget-appearance-v1';

async function storageKey() {
  try {
    const { data } = await supabase.auth.getSession();
    return `${STORAGE_PREFIX}:${data.session?.user.id ?? 'local'}`;
  } catch {
    return `${STORAGE_PREFIX}:local`;
  }
}

export async function getWidgetAppearance(): Promise<WidgetAppearance> {
  try {
    const raw = await AsyncStorage.getItem(await storageKey());
    if (!raw) return DEFAULT_WIDGET_APPEARANCE;
    const parsed = JSON.parse(raw) as Partial<WidgetAppearance>;
    return {
      appTheme: ['system','light','dark'].includes(String(parsed.appTheme)) ? parsed.appTheme as AppTheme : DEFAULT_WIDGET_APPEARANCE.appTheme,
      theme: ['flowos-light','flowos-dark','minimal-transparent','high-contrast','soft-pastel'].includes(String(parsed.theme)) ? parsed.theme as WidgetTheme : DEFAULT_WIDGET_APPEARANCE.theme,
      density: ['comfortable','balanced','compact'].includes(String(parsed.density)) ? parsed.density as WidgetDensity : DEFAULT_WIDGET_APPEARANCE.density,
      todayTransparentUnusedSpace: parsed.todayTransparentUnusedSpace !== false,
      today: { ...DEFAULT_WIDGET_APPEARANCE.today, ...(parsed.today ?? {}) },
      calendar: { ...DEFAULT_WIDGET_APPEARANCE.calendar, ...(parsed.calendar ?? {}) },
      sources: parsed.sources && typeof parsed.sources === 'object' ? parsed.sources : {},
    };
  } catch {
    return DEFAULT_WIDGET_APPEARANCE;
  }
}

export async function saveWidgetAppearance(value: WidgetAppearance) {
  await AsyncStorage.setItem(await storageKey(), JSON.stringify(value));
}

export async function resetWidgetAppearance() {
  await AsyncStorage.removeItem(await storageKey());
  return DEFAULT_WIDGET_APPEARANCE;
}

export function normalizeHexColor(value: string, fallback = '#F1F4FF') {
  const candidate = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`;
  return /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate.toUpperCase() : fallback;
}

export function colorWithOpacity(color: string, opacity: number) {
  const hex = normalizeHexColor(color);
  const alpha = Math.max(0, Math.min(100, Number.isFinite(opacity) ? opacity : 100)) / 100;
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function applyWidgetTheme(appearance: WidgetAppearance, theme: WidgetTheme): WidgetAppearance {
  const presets: Record<WidgetTheme, { backgroundColor:string; textColor:string; buttonBackgroundColor:string; buttonTextColor:string; backgroundOpacity:number }> = {
    'flowos-light': { backgroundColor:'#F1F4FF', textColor:'#172033', buttonBackgroundColor:'#6658D3', buttonTextColor:'#FFFFFF', backgroundOpacity:100 },
    'flowos-dark': { backgroundColor:'#171A26', textColor:'#F7F7FC', buttonBackgroundColor:'#7669E8', buttonTextColor:'#FFFFFF', backgroundOpacity:100 },
    'minimal-transparent': { backgroundColor:'#F6F7FB', textColor:'#172033', buttonBackgroundColor:'#6658D3', buttonTextColor:'#FFFFFF', backgroundOpacity:0 },
    'high-contrast': { backgroundColor:'#FFFFFF', textColor:'#000000', buttonBackgroundColor:'#000000', buttonTextColor:'#FFFFFF', backgroundOpacity:100 },
    'soft-pastel': { backgroundColor:'#FFF8F0', textColor:'#302B3A', buttonBackgroundColor:'#9278C8', buttonTextColor:'#FFFFFF', backgroundOpacity:100 },
  };
  const preset=presets[theme];
  const apply=(section:WidgetAppearance['today'])=>({...section,...preset,textOpacity:100,buttonBackgroundOpacity:100,buttonTextOpacity:100});
  return {...appearance,theme,todayTransparentUnusedSpace:theme==='minimal-transparent'?true:appearance.todayTransparentUnusedSpace,today:apply(appearance.today),calendar:apply(appearance.calendar)};
}

export function resetWidgetAppearanceCategory(appearance:WidgetAppearance,section:'today'|'calendar') {
  const themedDefaults=applyWidgetTheme(DEFAULT_WIDGET_APPEARANCE,appearance.theme);
  return {...appearance,[section]:{...themedDefaults[section]}};
}

function linearChannel(value:number){const channel=value/255;return channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4;}
export function contrastRatio(foreground:string,background:string){
  const fg=normalizeHexColor(foreground,'#000000'),bg=normalizeHexColor(background,'#FFFFFF');
  const luminance=(hex:string)=>0.2126*linearChannel(parseInt(hex.slice(1,3),16))+0.7152*linearChannel(parseInt(hex.slice(3,5),16))+0.0722*linearChannel(parseInt(hex.slice(5,7),16));
  const a=luminance(fg),b=luminance(bg);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}

const DARK_SOURCE_COLORS=['#2D3D5B','#29483E','#55412A','#46345F','#542F43','#254A4A','#45452E','#3F3A5A'];
function stableSourceIndex(key:string){let hash=2166136261;for(let index=0;index<key.length;index+=1){hash^=key.charCodeAt(index);hash=Math.imul(hash,16777619);}return (hash>>>0)%DARK_SOURCE_COLORS.length;}
export function sourceAppearanceColor(key: string, fallback: string, appearance: WidgetAppearance) {
  const custom = appearance.sources[key];
  if(custom)return colorWithOpacity(custom.color,custom.opacity);
  if(appearance.theme==='flowos-dark')return key==='flowos'?'#303543':DARK_SOURCE_COLORS[stableSourceIndex(key)];
  return fallback;
}
