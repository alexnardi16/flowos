import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, palette } from '@/components/ui';
import { useFlowStore } from '@/lib/store';
import type { Commitment } from '@/types';

const FILTERS_KEY = 'flowos-plan-filters-v1';
type FilterKey = 'events' | 'tasks' | 'past' | 'overdue';
type Filters = Record<FilterKey, boolean>;
const DEFAULT_FILTERS: Filters = { events: true, tasks: true, past: false, overdue: true };

function formatDuration(minutes: number) {
  const total = Math.max(0, Math.round(minutes));
  if (total === 0) return '0 minuti';
  const days = Math.floor(total / 1440), hours = Math.floor((total % 1440) / 60), mins = total % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} ${days === 1 ? 'giorno' : 'giorni'}`);
  if (hours) parts.push(`${hours} ${hours === 1 ? 'ora' : 'ore'}`);
  if (mins) parts.push(`${mins} ${mins === 1 ? 'minuto' : 'minuti'}`);
  return parts.join(' e ');
}
function itemDate(item: Commitment) { return item.scheduledAt ?? item.dueAt; }
function formatDateTime(value?: string) { return value ? new Date(value).toLocaleString('it-IT', { weekday:'short', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Data e ora non definite'; }
function searchable(item: Commitment) { return [item.title,item.description,item.context,item.outcome,item.kind].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }

export default function Plan() {
  const commitments = useFlowStore((state) => state.commitments);
  const autoPlan = useFlowStore((state) => state.autoPlan);
  const removeOnlyFromFlowOS = useFlowStore((state) => state.removeOnlyFromFlowOS);
  const removeAlsoFromGoogle = useFlowStore((state) => state.removeAlsoFromGoogle);
  const [planning,setPlanning] = useState(false);
  const [query,setQuery] = useState('');
  const [filters,setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [deletingId,setDeletingId] = useState<string|null>(null);

  useEffect(() => { void AsyncStorage.getItem(FILTERS_KEY).then((raw) => { if (raw) setFilters({ ...DEFAULT_FILTERS, ...JSON.parse(raw) }); }).catch(() => undefined); }, []);
  useEffect(() => { void AsyncStorage.setItem(FILTERS_KEY, JSON.stringify(filters)); }, [filters]);

  const items = useMemo(() => {
    const now = Date.now();
    const normalizedQuery = query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return commitments.filter((item) => {
      const isEvent = item.kind === 'event';
      const isTask = ['task','reminder','routine'].includes(item.kind);
      const date = itemDate(item), isPast = Boolean(date && new Date(date).getTime() < now), isOpen = item.status !== 'done';
      if (isEvent && !filters.events) return false;
      if (isTask && !filters.tasks) return false;
      if (!isEvent && !isTask) return false;
      if (isPast && !filters.past && !(isTask && isOpen && filters.overdue)) return false;
      if (item.status === 'done' && !filters.past) return false;
      return !normalizedQuery || searchable(item).includes(normalizedQuery);
    }).sort((a,b) => {
      const ad=itemDate(a), bd=itemDate(b);
      if (!ad) return 1; if (!bd) return -1;
      return new Date(ad).getTime()-new Date(bd).getTime();
    });
  }, [commitments,filters,query]);

  function toggle(key: FilterKey) { setFilters((current) => ({ ...current, [key]: !current[key] })); }
  async function handleAutoPlan() { setPlanning(true); try { await autoPlan(); } finally { setPlanning(false); } }
  async function removeLocal(id:string) { setDeletingId(id); try { await removeOnlyFromFlowOS(id); } finally { setDeletingId(null); } }
  async function removeGoogle(id:string) { setDeletingId(id); try { await removeAlsoFromGoogle(id); } finally { setDeletingId(null); } }
  function confirmGoogleDelete(item: Commitment) {
    Alert.alert(
      'Eliminare definitivamente da Google?',
      `“${item.title}” verrà eliminato da Google ${item.kind === 'event' ? 'Calendar' : 'Tasks'} e da FlowOS. Questa operazione non può essere annullata.`,
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina definitivamente', style: 'destructive', onPress: () => { void removeGoogle(item.id); } },
      ],
    );
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.wrap}>
    <Text style={styles.title}>Piano</Text><Text style={styles.sub}>Eventi e attività ordinati nel tempo.</Text>
    <TextInput value={query} onChangeText={setQuery} placeholder="Cerca evento, task, contesto…" placeholderTextColor={palette.muted} style={styles.search}/>
    <View style={styles.filters}><Filter label="Eventi" active={filters.events} onPress={() => toggle('events')}/><Filter label="Task" active={filters.tasks} onPress={() => toggle('tasks')}/><Filter label="Attività passate" active={filters.past} onPress={() => toggle('past')}/><Filter label="Task scadute aperte" active={filters.overdue} onPress={() => toggle('overdue')}/></View>
    <Button label={planning?'Sto pianificando…':'Genera piano automatico'} onPress={handleAutoPlan}/>
    <Text style={styles.helper}>“Orario fisso” indica un evento proveniente dal calendario che FlowOS non deve spostare automaticamente.</Text>
    {items.length ? items.map((item) => <Card key={item.id}>
      <View style={styles.row}><Chip>{item.kind==='event'?'EVENTO':item.status==='done'?'COMPLETATA':'TASK'}</Chip>{item.fixed?<Chip>ORARIO FISSO</Chip>:null}</View>
      <Text style={styles.item}>{item.title}</Text><Text style={styles.date}>{formatDateTime(itemDate(item))}</Text>
      <Text style={styles.meta}>Durata: {formatDuration(item.durationMinutes)}</Text><Text style={styles.meta}>{item.context||'Nessun contesto'} · energia {item.energy}</Text>
      <View style={styles.deleteActions}>
        <Pressable disabled={deletingId===item.id} onPress={() => { void removeLocal(item.id); }} style={styles.localDelete}><Text style={styles.localDeleteText}>Rimuovi solo da FlowOS</Text></Pressable>
        {item.externalId ? <Pressable disabled={deletingId===item.id} onPress={() => confirmGoogleDelete(item)} style={styles.googleDelete}><Text style={styles.googleDeleteText}>Elimina anche da Google</Text></Pressable> : null}
      </View>
    </Card>) : <Card><Text style={styles.empty}>Nessun elemento corrisponde ai filtri o alla ricerca.</Text></Card>}
  </ScrollView></SafeAreaView>;
}
function Filter({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}) { return <Pressable onPress={onPress} style={[styles.filter,active&&styles.filterActive]}><Text style={[styles.filterText,active&&styles.filterTextActive]}>{label}</Text></Pressable>; }
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:20,paddingBottom:110,gap:14},title:{fontSize:31,fontWeight:'900',color:palette.ink,marginTop:14},sub:{fontSize:16,color:palette.muted},search:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#E2E4EA',borderRadius:16,paddingHorizontal:16,paddingVertical:13,fontSize:15,color:palette.ink},filters:{flexDirection:'row',flexWrap:'wrap',gap:8},filter:{borderRadius:99,paddingHorizontal:12,paddingVertical:9,backgroundColor:'#ECEEF4'},filterActive:{backgroundColor:palette.primary},filterText:{fontSize:12,fontWeight:'800',color:palette.muted},filterTextActive:{color:'#FFF'},helper:{fontSize:13,lineHeight:18,color:palette.muted},row:{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'},item:{fontSize:18,fontWeight:'800',color:palette.ink,marginTop:12},date:{fontSize:14,fontWeight:'800',color:palette.primary,marginTop:8},meta:{fontSize:13,color:palette.muted,marginTop:5},deleteActions:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:14},localDelete:{paddingVertical:9,paddingHorizontal:12,borderRadius:12,backgroundColor:'#ECEEF4'},localDeleteText:{color:palette.ink,fontWeight:'800'},googleDelete:{paddingVertical:9,paddingHorizontal:12,borderRadius:12,backgroundColor:'#FDECEC'},googleDeleteText:{color:'#A12626',fontWeight:'800'},empty:{fontWeight:'700',color:palette.muted}});