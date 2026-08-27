import { useMemo } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Chip, palette } from '@/components/ui';
import { formatDurationLabel } from '@/lib/itemTiming';
import { useFlowStore } from '@/lib/store';
import type { Commitment } from '@/types';

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function itemDate(item: Commitment) { return item.scheduledAt ?? item.dueAt; }
function monthLabel(date: Date) { return date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }); }

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
  const monthLabels = grouped.map((week) => monthLabel(week[3]));

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.wrap}>
    <Text style={styles.eyebrow}>FlowOS</Text>
    <Text style={styles.title}>Calendario</Text>
    <Text style={styles.sub}>Le prossime 6 settimane, sincronizzate con i tuoi calendari Google.</Text>
    <Card style={styles.legend}><Chip tone="primary">EVENTO</Chip><Chip tone="warning">TASK</Chip><Chip tone="success">REMINDER</Chip></Card>
    {grouped.map((week, weekIndex) => <View key={weekIndex} style={styles.weekBlock}>
      <Text style={styles.month}>{monthLabels[weekIndex]}</Text>
      <View style={styles.headerRow}>{week.map((date) => <Text key={date.toISOString()} style={styles.dayName}>{DAY_NAMES[(date.getDay() + 6) % 7]}</Text>)}</View>
      <View style={styles.grid}>{week.map((date) => {
        const items = byDay.get(dayKey(date)) ?? [];
        const today = dayKey(date) === dayKey(new Date());
        return <View key={date.toISOString()} style={[styles.day, today && styles.today]}>
          <Text style={[styles.dayNumber, today && styles.todayNumber]}>{date.getDate()}</Text>
          <View style={styles.items}>{items.slice(0, 3).map((item) => <View key={item.id} style={[styles.item, item.kind === 'event' ? styles.event : item.kind === 'task' ? styles.task : styles.reminder]}>
            <Text numberOfLines={1} style={styles.itemTitle}>{item.title}</Text>
            <Text numberOfLines={1} style={styles.itemMeta}>{item.allDay ? 'Tutto il giorno' : new Date(itemDate(item)!).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · {formatDurationLabel(item)}</Text>
          </View>)}{items.length > 3 ? <Text style={styles.more}>+{items.length - 3} altro</Text> : null}</View>
        </View>;
      })}</View>
    </View>)}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:16,paddingBottom:110,gap:12},eyebrow:{fontSize:12,fontWeight:'900',letterSpacing:1.4,color:palette.primary,marginTop:14},title:{fontSize:32,fontWeight:'900',color:palette.ink},sub:{fontSize:14,lineHeight:20,color:palette.muted},legend:{flexDirection:'row',gap:8,flexWrap:'wrap',padding:10},weekBlock:{gap:6},month:{fontSize:16,fontWeight:'900',color:palette.ink,textTransform:'capitalize',marginTop:6},headerRow:{flexDirection:'row',gap:4},dayName:{flex:1,textAlign:'center',fontSize:10,fontWeight:'800',color:palette.muted},grid:{flexDirection:'row',gap:4},day:{flex:1,minHeight:106,borderRadius:10,backgroundColor:'#FFF',borderWidth:1,borderColor:palette.border,padding:5},today:{borderColor:palette.primary,borderWidth:2},dayNumber:{fontSize:12,fontWeight:'900',color:palette.muted},todayNumber:{color:palette.primary},items:{gap:3,marginTop:4},item:{borderRadius:5,paddingHorizontal:4,paddingVertical:3},event:{backgroundColor:'#EEF1FE'},task:{backgroundColor:'#FFF7E8'},reminder:{backgroundColor:'#EAFBF3'},itemTitle:{fontSize:9,fontWeight:'800',color:palette.ink},itemMeta:{fontSize:7,color:palette.muted,marginTop:1},more:{fontSize:8,fontWeight:'800',color:palette.primary},});
