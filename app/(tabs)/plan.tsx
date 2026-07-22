import { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, palette } from '@/components/ui';
import { useFlowStore } from '@/lib/store';
import type { Commitment } from '@/types';

function formatDuration(minutes: number) {
  const total = Math.max(0, Math.round(minutes));
  if (total === 0) return '0 minuti';
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} ${days === 1 ? 'giorno' : 'giorni'}`);
  if (hours) parts.push(`${hours} ${hours === 1 ? 'ora' : 'ore'}`);
  if (mins) parts.push(`${mins} ${mins === 1 ? 'minuto' : 'minuti'}`);
  return parts.join(' e ');
}

function itemDate(item: Commitment) {
  return item.scheduledAt ?? item.dueAt;
}

function formatDateTime(value?: string) {
  if (!value) return 'Data e ora non definite';
  return new Date(value).toLocaleString('it-IT', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function searchable(item: Commitment) {
  return [item.title, item.description, item.context, item.outcome, item.kind]
    .filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

type FilterKey = 'events' | 'tasks' | 'past' | 'overdue';

export default function Plan() {
  const commitments = useFlowStore((state) => state.commitments);
  const autoPlan = useFlowStore((state) => state.autoPlan);
  const [planning, setPlanning] = useState(false);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({ events: true, tasks: true, past: false, overdue: true });

  const items = useMemo(() => {
    const now = Date.now();
    const normalizedQuery = query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return commitments.filter((item) => {
      const isEvent = item.kind === 'event';
      const isTask = ['task', 'reminder', 'routine'].includes(item.kind);
      const date = itemDate(item);
      const isPast = Boolean(date && new Date(date).getTime() < now);
      const isOpen = item.status !== 'done';
      if (isEvent && !filters.events) return false;
      if (isTask && !filters.tasks) return false;
      if (!isEvent && !isTask) return false;
      if (isPast && !filters.past && !(isTask && isOpen && filters.overdue)) return false;
      if (item.status === 'done' && !filters.past) return false;
      if (normalizedQuery && !searchable(item).includes(normalizedQuery)) return false;
      return true;
    }).sort((a, b) => {
      const aDate = itemDate(a);
      const bDate = itemDate(b);
      if (!aDate) return 1;
      if (!bDate) return -1;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });
  }, [commitments, filters, query]);

  function toggle(key: FilterKey) {
    setFilters((current) => ({ ...current, [key]: !current[key] }));
  }

  async function handleAutoPlan() {
    setPlanning(true);
    try { await autoPlan(); } finally { setPlanning(false); }
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Piano</Text>
      <Text style={styles.sub}>Eventi e attività ordinati nel tempo.</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder="Cerca evento, task, contesto…" placeholderTextColor={palette.muted} style={styles.search} />
      <View style={styles.filters}>
        <Filter label="Eventi" active={filters.events} onPress={() => toggle('events')} />
        <Filter label="Task" active={filters.tasks} onPress={() => toggle('tasks')} />
        <Filter label="Attività passate" active={filters.past} onPress={() => toggle('past')} />
        <Filter label="Task scadute aperte" active={filters.overdue} onPress={() => toggle('overdue')} />
      </View>
      <Button label={planning ? 'Sto pianificando…' : 'Genera piano automatico'} onPress={handleAutoPlan} />
      <Text style={styles.helper}>“Evento fisso” significa che data e ora arrivano dal calendario e non possono essere spostate automaticamente da FlowOS.</Text>
      {items.length ? items.map((item) => <Card key={item.id}>
        <View style={styles.row}>
          <Chip>{item.kind === 'event' ? 'EVENTO' : item.status === 'done' ? 'COMPLETATA' : 'TASK'}</Chip>
          {item.fixed ? <Chip>ORARIO FISSO</Chip> : null}
        </View>
        <Text style={styles.item}>{item.title}</Text>
        <Text style={styles.date}>{formatDateTime(itemDate(item))}</Text>
        <Text style={styles.meta}>Durata: {formatDuration(item.durationMinutes)}</Text>
        <Text style={styles.meta}>{item.context || 'Nessun contesto'} · energia {item.energy}</Text>
      </Card>) : <Card><Text style={styles.empty}>Nessun elemento corrisponde ai filtri o alla ricerca.</Text></Card>}
    </ScrollView>
  </SafeAreaView>;
}

function Filter({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.filter, active && styles.filterActive]}><Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:20,paddingBottom:110,gap:14},title:{fontSize:31,fontWeight:'900',color:palette.ink,marginTop:14},sub:{fontSize:16,color:palette.muted},search:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E2E4EA',borderRadius:16,paddingHorizontal:16,paddingVertical:13,fontSize:15,color:palette.ink},filters:{flexDirection:'row',flexWrap:'wrap',gap:8},filter:{borderRadius:99,paddingHorizontal:12,paddingVertical:9,backgroundColor:'#ECEEF4'},filterActive:{backgroundColor:palette.primary},filterText:{fontSize:12,fontWeight:'800',color:palette.muted},filterTextActive:{color:'#FFFFFF'},helper:{fontSize:13,lineHeight:18,color:palette.muted},row:{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'},item:{fontSize:18,fontWeight:'800',color:palette.ink,marginTop:12},date:{fontSize:14,fontWeight:'800',color:palette.primary,marginTop:8},meta:{fontSize:13,color:palette.muted,marginTop:5},empty:{fontWeight:'700',color:palette.muted}
});