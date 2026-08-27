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
  const grouped = useMemo(() => {
    const map = new Map<string, Commitment[]>();
    for (const item of commitments) {
      const value = itemDate(item);
      if (!value) continue;
      const key = dayKey(new Date(value));
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    }
    return map;
  }, [commitments]);
  const months = useMemo(() => {
    const seen = new Set<string>();
    return weeks.map((date) => {
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return { key, label: monthLabel(date) };
    }).filter(Boolean) as { key: string; label: string }[];
  }, [weeks]);

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.wrap}>
    <Text style={styles.eyebrow}>FlowOS</Text><Text style={styles.title}>Calendario</Text><Text style={styles.sub}>Le prossime sei settimane.</Text>
    {months.map((month) => <Text key={month.key} style={styles.month}>{month.label}</Text>)}
    <View style={styles.grid}>{weeks.map((date) => {
      const key = dayKey(date); const items = grouped.get(key) ?? [];
      return <Card key={key} style={styles.day}><Text style={styles.dayName}>{DAY_NAMES[(date.getDay() + 6) % 7]}</Text><Text style={styles.dayNumber}>{date.getDate()}</Text>{items.slice(0, 4).map((item) => <View key={item.id} style={styles.item}><Chip tone={item.status === 'done' ? 'success' : 'primary'}>{item.kind === 'event' ? 'EVENTO' : item.kind === 'task' ? 'TASK' : 'REMINDER'}</Chip><Text numberOfLines={2} style={styles.itemTitle}>{item.title}</Text><Text style={styles.meta}>{formatDurationLabel(item)}</Text></View>)}</Card>;
    })}</View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:20,paddingBottom:110,gap:12},eyebrow:{fontSize:12,fontWeight:'900',letterSpacing:1.4,color:palette.primary,marginTop:14},title:{fontSize:32,fontWeight:'900',color:palette.ink},sub:{fontSize:15,lineHeight:22,color:palette.muted},month:{fontSize:18,fontWeight:'900',color:palette.ink,marginTop:10,textTransform:'capitalize'},grid:{flexDirection:'row',flexWrap:'wrap',gap:8},day:{width:'31.8%',minHeight:125,padding:9},dayName:{fontSize:10,fontWeight:'800',color:palette.muted},dayNumber:{fontSize:18,fontWeight:'900',color:palette.ink,marginBottom:5},item:{gap:3,marginTop:5},itemTitle:{fontSize:11,fontWeight:'800',color:palette.ink},meta:{fontSize:10,color:palette.muted}});
