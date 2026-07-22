import { useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, palette } from '@/components/ui';
import { useFlowStore } from '@/lib/store';
import type { Commitment } from '@/types';

export default function Inbox() {
  const commitments = useFlowStore((state) => state.commitments);
  const updateCommitment = useFlowStore((state) => state.updateCommitment);
  const removeOnlyFromFlowOS = useFlowStore((state) => state.removeOnlyFromFlowOS);
  const removeAlsoFromGoogle = useFlowStore((state) => state.removeAlsoFromGoogle);
  const [busyId,setBusyId] = useState<string|null>(null);
  const [editingId,setEditingId] = useState<string|null>(null);
  const [deleteId,setDeleteId] = useState<string|null>(null);
  const [draft,setDraft] = useState<Commitment|null>(null);
  const items = useMemo(() => commitments.filter((item) => item.status !== 'done' && item.confidence < 0.85), [commitments]);

  function startEdit(item: Commitment) { setEditingId(item.id); setDeleteId(null); setDraft({ ...item }); }
  function cancelEdit() { setEditingId(null); setDraft(null); }
  async function save(item: Commitment, confirm: boolean) {
    setBusyId(item.id);
    try { await updateCommitment({ ...item, confidence: confirm ? 1 : item.confidence }); cancelEdit(); }
    catch (error) { Alert.alert('Inbox', error instanceof Error ? error.message : 'Salvataggio non riuscito.'); }
    finally { setBusyId(null); }
  }
  async function remove(item: Commitment, google: boolean) {
    setBusyId(item.id);
    try { if (google) await removeAlsoFromGoogle(item.id); else await removeOnlyFromFlowOS(item.id); setDeleteId(null); }
    catch (error) { Alert.alert('Inbox', error instanceof Error ? error.message : 'Eliminazione non riuscita.'); }
    finally { setBusyId(null); }
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.wrap}>
    <Text style={styles.title}>Inbox</Text>
    <Text style={styles.sub}>Qui trovi gli elementi che FlowOS non è riuscito a interpretare con sufficiente sicurezza.</Text>
    <Card><Text style={styles.guideTitle}>Cosa devi fare</Text><Text style={styles.guide}>Controlla titolo, tipo, data e durata. Puoi modificare, confermare o eliminare ogni elemento.</Text></Card>
    {items.length ? items.map((item) => {
      const editing = editingId === item.id && draft;
      const deleting = deleteId === item.id;
      const current = editing ? draft : item;
      return <Card key={item.id}>
        {editing ? <>
          <Text style={styles.fieldLabel}>Titolo</Text><TextInput value={current.title} onChangeText={(title) => setDraft({ ...current, title })} style={styles.input}/>
          <Text style={styles.fieldLabel}>Tipo</Text><View style={styles.kindRow}>{(['event','task','reminder'] as const).map((kind) => <Pressable key={kind} onPress={() => setDraft({ ...current, kind })} style={[styles.kindButton,current.kind===kind&&styles.kindActive]}><Text style={[styles.kindText,current.kind===kind&&styles.kindTextActive]}>{kind}</Text></Pressable>)}</View>
          <Text style={styles.fieldLabel}>Data e ora ISO</Text><TextInput value={current.scheduledAt ?? current.dueAt ?? ''} onChangeText={(value) => setDraft(current.kind==='event'?{...current,scheduledAt:value}:{...current,dueAt:value})} placeholder="2026-07-22T14:30:00+02:00" style={styles.input}/>
          <Text style={styles.fieldLabel}>Durata in minuti</Text><TextInput value={String(current.durationMinutes)} onChangeText={(value) => setDraft({ ...current, durationMinutes: Math.max(1, Number(value.replace(/\D/g,'')) || 1) })} keyboardType="number-pad" style={styles.input}/>
          <View style={styles.actions}><Pressable onPress={cancelEdit} style={styles.secondaryButton}><Text style={styles.secondaryText}>Annulla</Text></Pressable><Pressable disabled={busyId===item.id} onPress={() => { void save(current,false); }} style={styles.saveButton}><Text style={styles.confirmText}>Salva modifiche</Text></Pressable><Pressable disabled={busyId===item.id} onPress={() => { void save(current,true); }} style={styles.confirmButton}><Text style={styles.confirmText}>Salva e conferma</Text></Pressable></View>
        </> : <>
          <Text style={styles.item}>{item.title}</Text>
          <Text style={styles.meta}>Tipo proposto: {item.kind} · affidabilità {Math.round(item.confidence*100)}%</Text>
          <Text style={styles.meta}>Data: {item.scheduledAt||item.dueAt?new Date(item.scheduledAt??item.dueAt!).toLocaleString('it-IT'):'non definita'}</Text>
          <Text style={styles.meta}>Durata proposta: {item.durationMinutes} minuti</Text>
          <View style={styles.actions}><Pressable onPress={() => startEdit(item)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Modifica</Text></Pressable><Pressable disabled={busyId===item.id} onPress={() => { void save(item,true); }} style={styles.confirmButton}><Text style={styles.confirmText}>{busyId===item.id?'Conferma…':'Conferma'}</Text></Pressable><Pressable onPress={() => setDeleteId(deleting?null:item.id)} style={styles.deleteButton}><Text style={styles.deleteText}>Elimina</Text></Pressable></View>
          {deleting ? <View style={styles.deleteBox}><Text style={styles.deleteTitle}>Dove vuoi eliminarlo?</Text><Pressable disabled={busyId===item.id} onPress={() => { void remove(item,false); }} style={styles.localDelete}><Text style={styles.deleteText}>Rimuovi solo da FlowOS</Text></Pressable>{item.externalId ? <Pressable disabled={busyId===item.id} onPress={() => { void remove(item,true); }} style={styles.googleDelete}><Text style={styles.googleDeleteText}>Elimina anche da Google</Text></Pressable> : <Text style={styles.meta}>Questo elemento non risulta ancora sincronizzato con Google.</Text>}</View> : null}
        </>}
      </Card>;
    }) : <Card><Text style={styles.empty}>Tutto chiaro. Nessun elemento richiede la tua verifica.</Text></Card>}
  </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:palette.bg},wrap:{padding:20,paddingBottom:110,gap:14},title:{fontSize:31,fontWeight:'900',color:palette.ink,marginTop:14},sub:{fontSize:16,lineHeight:22,color:palette.muted,marginBottom:2},guideTitle:{fontSize:16,fontWeight:'900',color:palette.ink},guide:{fontSize:14,lineHeight:20,color:palette.muted,marginTop:8},item:{fontSize:18,fontWeight:'800',color:palette.ink},meta:{fontSize:13,lineHeight:18,color:palette.muted,marginTop:6},fieldLabel:{fontSize:12,fontWeight:'800',color:palette.muted,marginTop:10},input:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#E2E4EA',borderRadius:12,padding:12,marginTop:5,color:palette.ink},kindRow:{flexDirection:'row',gap:8,marginTop:6},kindButton:{paddingHorizontal:11,paddingVertical:8,borderRadius:99,backgroundColor:'#ECEEF4'},kindActive:{backgroundColor:palette.primary},kindText:{fontWeight:'800',color:palette.muted},kindTextActive:{color:'#FFF'},actions:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:14},confirmButton:{backgroundColor:palette.primary,borderRadius:14,paddingHorizontal:16,paddingVertical:11},saveButton:{backgroundColor:palette.success,borderRadius:14,paddingHorizontal:16,paddingVertical:11},secondaryButton:{backgroundColor:'#ECEEF4',borderRadius:14,paddingHorizontal:16,paddingVertical:11},secondaryText:{color:palette.ink,fontWeight:'900'},confirmText:{color:'#FFF',fontWeight:'900'},deleteButton:{backgroundColor:'#FDECEC',borderRadius:14,paddingHorizontal:16,paddingVertical:11},deleteText:{color:'#A12626',fontWeight:'900'},deleteBox:{marginTop:12,padding:12,borderRadius:14,backgroundColor:'#FFF7F7',gap:8},deleteTitle:{fontWeight:'900',color:palette.ink},localDelete:{alignSelf:'flex-start',backgroundColor:'#FDECEC',borderRadius:12,paddingHorizontal:12,paddingVertical:9},googleDelete:{alignSelf:'flex-start',backgroundColor:'#A12626',borderRadius:12,paddingHorizontal:12,paddingVertical:9},googleDeleteText:{color:'#FFF',fontWeight:'900'},empty:{fontWeight:'800',color:palette.success}});