import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export type SourceAppearance = { color: string; opacity: number };
export type WidgetAppearance = {
  today: { backgroundColor: string; backgroundOpacity: number; textColor: string; textOpacity: number; buttonBackgroundColor: string; buttonBackgroundOpacity: number; buttonTextColor: string; buttonTextOpacity: number };
  calendar: { backgroundColor: string; backgroundOpacity: number; textColor: string; textOpacity: number; buttonBackgroundColor: string; buttonBackgroundOpacity: number; buttonTextColor: string; buttonTextOpacity: number };
  sources: Record<string, SourceAppearance>;
};

export const DEFAULT_WIDGET_APPEARANCE: WidgetAppearance = {
  today: { backgroundColor: '#F1F4FF', backgroundOpacity: 100, textColor: '#172033', textOpacity: 100, buttonBackgroundColor: '#4254C5', buttonBackgroundOpacity: 100, buttonTextColor: '#FFFFFF', buttonTextOpacity: 100 },
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

export function sourceAppearanceColor(key: string, fallback: string, appearance: WidgetAppearance) {
  const custom = appearance.sources[key];
  return custom ? colorWithOpacity(custom.color, custom.opacity) : fallback;
}
