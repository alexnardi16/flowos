import { useMemo } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Chip, palette } from '@/components/ui';
import { formatDurationLabel } from '@/lib/itemTiming';
import { useFlowStore } from '@/lib/store';
import type { Commitment } from '@/types';

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MONTH_NAMES = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function itemDate(item: Commitment) { return item.scheduledAt ?? item.dueAt; }
function monthLabel(date: Date) { return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`; }
function weekLabel(week: Date[]) {
  const start = monthLabel(week[0]);
  const end = monthLabel(week[6]);
  return start === end ? start : `${start} - ${end}`;
}
function kindLabel(kind: Commitment['kind']) { return kind === 'event' ? 'EVENTO' : kind === 'task' ? 'TASK' : kind === 'reminder' ? 'REMINDER' : 'ALTRO'; }
function itemStyle(item: Commitment) { return item.kind === 'event' ? styles.event : item.kind === 'task' ? styles.task : styles.reminder; }

export default function Calendar() {
  const commitments = useFlowStore((state) => state.commitments);
  const weeks = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, Commitment[]>();
    for (const item of commitments.filter((item) => !item.deletedAt && item.status !== 'done')) {
      const value = itemDate(item);
      if (!value) continue;
      const d = new Date(value);
      const key = item.allDay ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}` : dayKey(d);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => new Date(itemDate(a) ?? 0).getTime() - new Date(itemDate(b) ?? 0).getTime());
    return map;
  }, [commitments]);

  const grouped = Array.from({ length: 6 }, (_, week) => weeks.slice(week * 7, week * 7 + 7));

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.wrap}>
    <Text style={styles.eyebrow}>FlowOS</Text>
    <Text style={styles.title}>Calendario</Text>
    <Text style={styles.sub}>Le prossime 6 settimane, sincronizzate con i tuoi calendari Google.</Text>
    <Card style={styles.legend}><Chip tone="primary">EVENTO</Chip><Chip tone="warning">TASK</Chip><Chip tone="success">REMINDER</Chip></Card>

    {grouped.map((week, weekIndex) => <View key={weekIndex} style={styles.weekBlock}>
      <Text style={styles.month}>{weekLabel(week)}</Text>
      {week.map((date) => {
        const items = byDay.get(dayKey(date)) ?? [];
        const today = dayKey(date) === dayKey(new Date());
        return <View key={date.toISOString()} style={[styles.dayRow, today && styles.today]}>
          <View style={styles.dayLabel}>
            <Text style={[styles.dayName, today && styles.todayText]}>{DAY_NAMES[(date.getDay() + 6) % 7]}</Text>
            <Text style={[styles.dayNumber, today && styles.todayText]}>{date.getDate()}</Text>
          </View>
          <View style={styles.items}>
            {items.length ? items.slice(0, 5).map((item) => <View key={item.id} style={[styles.item, itemStyle(item)]}>
              <View style={styles.itemTop}><Chip tone={item.kind === 'event' ? 'primary' : item.kind === 'task' ? 'warning' : 'success'}>{kindLabel(item.kind)}</Chip><Text style={styles.itemTime}>{item.allDay ? 'Tutto il giorno' : new Date(itemDate(item)!).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</Text></View>
              <Text numberOfLines={2} style={styles.itemTitle}>{item.title}</Text>
              <Text numberOfLines={1} style={styles.itemMeta}>{formatDurationLabel(item)}{item.location ? ` · ${item.location}` : ''}</Text>
            </View>) : <Text style={styles.emptyDay}>Nessuna attività</Text>}
            {items.length > 5 ? <Text style={styles.more}>+{items.length - 5} altre attività</Text> : null}
          </View>
        </View>;
      })}
    </View>)}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:palette.bg},
  wrap:{padding:16,paddingBottom:110,gap:14},
  eyebrow:{fontSize:12,fontWeight:'900',letterSpacing:1.4,color:palette.primary,marginTop:14},
  title:{fontSize:32,fontWeight:'900',color:palette.ink},
  sub:{fontSize:14,lineHeight:20,color:palette.muted},
  legend:{flexDirection:'row',gap:8,flexWrap:'wrap',padding:10},
  weekBlock:{gap:8},
  month:{fontSize:18,lineHeight:24,fontWeight:'900',color:palette.ink,textTransform:'capitalize',marginTop:4},
  dayRow:{flexDirection:'row',gap:10,alignItems:'stretch',padding:8,borderRadius:14,backgroundColor:'#FFF',borderWidth:1,borderColor:palette.border},
  today:{borderColor:palette.primary,borderWidth:2},
  dayLabel:{width:48,alignItems:'center',justifyContent:'flex-start',paddingTop:3},
  dayName:{fontSize:11,fontWeight:'900',color:palette.muted,textTransform:'uppercase'},
  dayNumber:{fontSize:23,lineHeight:28,fontWeight:'900',color:palette.ink,marginTop:2},
  todayText:{color:palette.primary},
  items:{flex:1,gap:6,minWidth:0},
  item:{borderRadius:11,padding:9,borderWidth:1},
  event:{backgroundColor:'#EEF1FE',borderColor:'#C7D0FB'},
  task:{backgroundColor:'#FFF7E8',borderColor:'#F3DCA8'},
  reminder:{backgroundColor:'#EAFBF3',borderColor:'#B9EAD4'},
  itemTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  itemTime:{fontSize:11,fontWeight:'800',color:palette.muted},
  itemTitle:{fontSize:14,lineHeight:19,fontWeight:'900',color:palette.ink,marginTop:6},
  itemMeta:{fontSize:11,lineHeight:16,color:palette.muted,marginTop:3},
  emptyDay:{fontSize:12,color:palette.muted,paddingVertical:8},
  more:{fontSize:12,fontWeight:'900',color:palette.primary,paddingVertical:2},
});
