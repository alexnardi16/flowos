import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import type { Commitment } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase';
import type { Language } from './i18n';
import { getLanguage, getTranslateActivities, useLanguage } from './i18n';

const ORIGINAL_KEY='flowos-original-titles-v1';
const CACHE_KEY='flowos-activity-translations-v1';
type CacheEntry={original:string;translated:string};
type Cache=Record<string,Record<string,CacheEntry>>;
async function readOriginals():Promise<Record<string,string>>{try{const raw=await AsyncStorage.getItem(ORIGINAL_KEY);return raw?JSON.parse(raw):{};}catch{return{};}}
export async function rememberOriginalTitles(items:Commitment[]){const current=await readOriginals();let changed=false;for(const item of items){if(current[item.id]!==item.title){current[item.id]=item.title;changed=true;}}if(changed)await AsyncStorage.setItem(ORIGINAL_KEY,JSON.stringify(current));}
async function readCache():Promise<Cache>{try{const raw=await AsyncStorage.getItem(CACHE_KEY);return raw?JSON.parse(raw):{};}catch{return{};}}
async function writeCache(cache:Cache){await AsyncStorage.setItem(CACHE_KEY,JSON.stringify(cache));}
export async function getCachedTranslatedTitles(items:Commitment[],language?:Language):Promise<Record<string,string>>{
  const lang=language??await getLanguage();if(lang==='it'||!(await getTranslateActivities()))return{};
  const originals=await readOriginals();const cache=await readCache();const out:Record<string,string>={};
  for(const item of items){const original=originals[item.id]??item.title;const entry=cache[lang]?.[item.id];if(entry?.original===original&&entry.translated.trim())out[item.id]=entry.translated;}
  return out;
}
export async function translateActivityTitles(items:Commitment[],language:Language):Promise<Record<string,string>>{
  await rememberOriginalTitles(items);if(language==='it')return{};if(!isSupabaseConfigured)return getCachedTranslatedTitles(items,language);
  const originals=await readOriginals();const cache=await readCache();const result:Record<string,string>={};
  const missing=items.filter(item=>{const original=originals[item.id]??item.title;const entry=cache[language]?.[item.id];if(entry?.original===original&&entry.translated.trim()){result[item.id]=entry.translated;return false;}return Boolean(original.trim());});
  for(let start=0;start<missing.length;start+=50){
    const batch=missing.slice(start,start+50).map(item=>({id:item.id,text:originals[item.id]??item.title}));
    try{
      const {data,error}=await supabase.functions.invoke('translate-activities',{body:{language,titles:batch}});if(error)throw error;
      const rows=Array.isArray(data?.translations)?data.translations:[];cache[language]??={};
      for(const row of rows){if(typeof row?.id!=='string'||typeof row?.text!=='string')continue;const original=originals[row.id];if(!original)continue;cache[language][row.id]={original,translated:row.text.trim()||original};result[row.id]=row.text.trim()||original;}
      await writeCache(cache);
    }catch{for(const item of batch)result[item.id]=item.title;}
  }
  return result;
}
export async function getDisplayTitleMap(items:Commitment[]){await rememberOriginalTitles(items);return getCachedTranslatedTitles(items);}

export function useActivityTitleMap(items: Commitment[]) {
  const { language, translateActivities } = useLanguage();
  const [titles, setTitles] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!translateActivities || language === 'it') { if (!cancelled) setTitles({}); return; }
      const translated = await translateActivityTitles(items, language);
      if (!cancelled) setTitles(translated);
    })();
    return () => { cancelled = true; };
  }, [items, language, translateActivities]);
  return titles;
}
