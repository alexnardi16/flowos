import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button, palette, showAlert, showConfirm } from '@/components/ui';
import { formatReminderOffsetLabel } from '@/lib/customReminders';
import { useFlowStore } from '@/lib/store';
import type { Commitment, CommitmentKind, ReminderOffset } from '@/types';

const REMINDER_PRESETS = [10, 60, 1440];

function toDateInput(iso?: string, allDay?: boolean): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (allDay) return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function toTimeInput(iso?: string, allDay?: boolean): string {
  if (!iso || allDay) return '00:00';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function combine(dateStr: string, timeStr: string, allDay: boolean): string | undefined {
  if (!dateStr) return undefined;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  if (allDay) return new Date(Date.UTC(y, m - 1, d, 0, 0)).toISOString();
  const [hh, mm] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0).toISOString();
}

export function ManageSheet({ item, onClose }: { item: Commitment; onClose: () => void }) {
  const updateCommitment = useFlowStore((state) => state.updateCommitment);
  const removeOnlyFromFlowOS = useFlowStore((state) => state.removeOnlyFromFlowOS);
  const removeAlsoFromGoogle = useFlowStore((state) => state.removeAlsoFromGoogle);
  const removeSeriesFromGoogle = useFlowStore((state) => state.removeSeriesFromGoogle);
  const syncItemToGoogleNow = useFlowStore((state) => state.syncItemToGoogleNow);

  const dateField = item.scheduledAt ? 'scheduledAt' : 'dueAt';
  const [title, setTitle] = useState(item.title);
  const [kind, setKind] = useState<CommitmentKind>(item.kind);
  const [allDay, setAllDay] = useState(Boolean(item.allDay));
  const [dateStr, setDateStr] = useState(toDateInput(item[dateField], item.allDay));
  const [timeStr, setTimeStr] = useState(toTimeInput(item[dateField], item.allDay));
  const [days, setDays] = useState(String(Math.floor(item.durationMinutes / 1440)));
  const [hours, setHours] = useState(String(Math.floor((item.durationMinutes % 1440) / 60)));
  const [minutes, setMinutes] = useState(String(item.durationMinutes % 60));
  const [location, setLocation] = useState(item.location ?? '');
  const [notes, setNotes] = useState(item.notes ?? '');
  const [link, setLink] = useState(item.link ?? '');
  const [description, setDescription] = useState(item.description ?? '');
  const [reminders, setReminders] = useState<ReminderOffset[]>(item.reminders ?? []);
  const [customMinutes, setCustomMinutes] = useState('');
  const [busy, setBusy] = useState(false);

  function addReminder(minutesBefore: number) {
    if (reminders.some((r) => r.minutesBefore === minutesBefore)) return;
    setReminders((current) => [...current, { id: `${Date.now()}-${minutesBefore}`, minutesBefore }].sort((a, b) => a.minutesBefore - b.minutesBefore));
  }
  function removeReminder(id: string) {
    setReminders((current) => current.filter((r) => r.id !== id));
  }

  async function save() {
    setBusy(true);
    try {
      const durationMinutes = Math.max(1, (Number(days) || 0) * 1440 + (Number(hours) || 0) * 60 + (Number(minutes) || 0));
      const when = combine(dateStr, timeStr, allDay);
      const updated: Commitment = {
        ...item,
        title: title.trim() || item.title,
        kind,
        allDay,
        durationMinutes,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        link: link.trim() || undefined,
        description: description.trim() || undefined,
        reminders: reminders.length ? reminders : undefined,
        scheduledAt: kind === 'event' ? when : undefined,
        dueAt: kind !== 'event' ? when : undefined,
      };
      await updateCommitment(updated);
      onClose();
    } catch (error) {
      showAlert('Gestisci', error instanceof Error ? error.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  async function removeLocal() {
    setBusy(true);
    try { await removeOnlyFromFlowOS(item.id); onClose(); }
    catch (error) { showAlert('Gestisci', error instanceof Error ? error.message : 'Eliminazione non riuscita.'); }
    finally { setBusy(false); }
  }
  async function removeGoogle() {
    const ok = await showConfirm('Eliminare definitivamente da Google?', `"${item.title}" verrà eliminato da Google ${item.kind === 'event' ? 'Calendar' : 'Tasks'} e da FlowOS. Questa occorrenza soltanto. Questa operazione non può essere annullata.`, 'Elimina definitivamente');
    if (!ok) return;
    setBusy(true);
    try { await removeAlsoFromGoogle(item.id); onClose(); }
    catch (error) { showAlert('Gestisci', error instanceof Error ? error.message : 'Eliminazione non riuscita.'); }
    finally { setBusy(false); }
  }
  async function removeSeries() {
    const ok = await showConfirm('Eliminare tutta la serie ricorrente?', `"${item.title}" e TUTTE le altre occorrenze verranno eliminate da Google e da FlowOS. Questa operazione non può essere annullata.`, 'Elimina tutta la serie');
    if (!ok) return;
    setBusy(true);
    try { await removeSeriesFromGoogle(item.id); onClose(); }
    catch (error) { showAlert('Gestisci', error instanceof Error ? error.message : 'Eliminazione non riuscita.'); }
    finally { setBusy(false); }
  }
  async function syncNow() {
    setBusy(true);
    try { await syncItemToGoogleNow(); showAlert('Gestisci', 'Sincronizzazione con Google avviata.'); }
    catch (error) { showAlert('Gestisci', error instanceof Error ? error.message : 'Sincronizzazione non riuscita.'); }
    finally { setBusy(false); }
  }

  const isFlowOSOnly = !item.externalId;

  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Gestisci</Text>

      <Text style={styles.label}>Titolo</Text>
      <TextInput value={title} onChangeText={setTitle} style={styles.input} />

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.row}>{(['event', 'task', 'reminder'] as const).map((k) => <Pressable key={k} onPress={() => setKind(k)} style={[styles.choice, kind === k && styles.choiceActive]}><Text style={[styles.choiceText, kind === k && styles.choiceTextActive]}>{k === 'event' ? 'Evento' : k === 'task' ? 'Task' : 'Reminder'}</Text></Pressable>)}</View>

      <View style={styles.rowBetween}><Text style={styles.label}>Giornata intera</Text><Switch value={allDay} onValueChange={setAllDay} /></View>

      <Text style={styles.label}>Data</Text>
      <TextInput value={dateStr} onChangeText={setDateStr} placeholder="AAAA-MM-GG" style={styles.input} />
      {!allDay ? <><Text style={styles.label}>Orario</Text><TextInput value={timeStr} onChangeText={setTimeStr} placeholder="HH:MM" style={styles.input} /></> : null}

      <Text style={styles.label}>Durata</Text>
      <View style={styles.row}>
        <TextInput value={days} onChangeText={(v) => setDays(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="gg" style={[styles.input, styles.durationInput]} />
        <TextInput value={hours} onChangeText={(v) => setHours(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="hh" style={[styles.input, styles.durationInput]} />
        <TextInput value={minutes} onChangeText={(v) => setMinutes(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="min" style={[styles.input, styles.durationInput]} />
      </View>

      <Text style={styles.label}>Descrizione</Text>
      <TextInput value={description} onChangeText={setDescription} style={styles.input} multiline />
      <Text style={styles.label}>Note</Text>
      <TextInput value={notes} onChangeText={setNotes} style={styles.input} multiline />
      <Text style={styles.label}>Luogo</Text>
      <TextInput value={location} onChangeText={setLocation} style={styles.input} />
      <Text style={styles.label}>Link</Text>
      <TextInput value={link} onChangeText={setLink} style={styles.input} autoCapitalize="none" />

      <Text style={styles.label}>Notifiche di rappel</Text>
      {reminders.length ? <View style={styles.reminderList}>{reminders.map((r) => (
        <View key={r.id} style={styles.reminderChip}>
          <Text style={styles.reminderChipText}>{formatReminderOffsetLabel(r.minutesBefore)}</Text>
          <Pressable onPress={() => removeReminder(r.id)}><Text style={styles.reminderRemove}>✕</Text></Pressable>
        </View>
      ))}</View> : <Text style={styles.help}>Nessun rappel configurato.</Text>}
      <View style={styles.row}>
        {REMINDER_PRESETS.map((minutes) => <Pressable key={minutes} onPress={() => addReminder(minutes)} style={styles.presetButton}><Text style={styles.presetButtonText}>+ {formatReminderOffsetLabel(minutes)}</Text></Pressable>)}
      </View>
      <View style={styles.row}>
        <TextInput value={customMinutes} onChangeText={(v) => setCustomMinutes(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="minuti personalizzati" style={[styles.input, { flex: 1 }]} />
        <Pressable onPress={() => { const m = Number(customMinutes); if (m > 0) { addReminder(m); setCustomMinutes(''); } }} style={styles.presetButton}><Text style={styles.presetButtonText}>Aggiungi</Text></Pressable>
      </View>

      <View style={styles.actionsRow}>
        <Button secondary label="Annulla" onPress={onClose} disabled={busy} />
        <Button label="Salva modifiche" onPress={() => void save()} loading={busy} />
      </View>

      {isFlowOSOnly ? <View style={styles.section}>
        <Text style={styles.sectionTitle}>Solo su FlowOS</Text>
        <Text style={styles.help}>Questo elemento non è mai stato sincronizzato con Google.</Text>
        <Button secondary label="Sincronizza con Google" onPress={() => void syncNow()} disabled={busy} />
      </View> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Elimina</Text>
        <Pressable disabled={busy} onPress={() => void removeLocal()} style={styles.localDelete}><Text style={styles.localDeleteText}>Elimina solo da FlowOS</Text></Pressable>
        {item.externalId ? <Pressable disabled={busy} onPress={() => void removeGoogle()} style={styles.googleDelete}><Text style={styles.googleDeleteText}>{item.googleRecurringEventId ? 'Elimina solo questa occorrenza' : 'Elimina da FlowOS e Google'}</Text></Pressable> : null}
        {item.googleRecurringEventId ? <Pressable disabled={busy} onPress={() => void removeSeries()} style={styles.googleDelete}><Text style={styles.googleDeleteText}>Elimina tutta la serie</Text></Pressable> : null}
      </View>
    </ScrollView>
  </Modal>;
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 50, paddingBottom: 60, gap: 6, backgroundColor: palette.bg },
  title: { fontSize: 26, fontWeight: '900', color: palette.ink, marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '800', color: palette.muted, marginTop: 12 },
  input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E4EA', borderRadius: 12, padding: 12, marginTop: 5, color: palette.ink },
  durationInput: { flex: 1 },
  row: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  choice: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 99, backgroundColor: '#ECEEF4' },
  choiceActive: { backgroundColor: palette.primary },
  choiceText: { fontWeight: '800', color: palette.muted },
  choiceTextActive: { color: '#FFF' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  section: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: palette.border, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: palette.ink },
  help: { fontSize: 12, color: palette.muted },
  localDelete: { alignSelf: 'flex-start', backgroundColor: '#FDECEC', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  localDeleteText: { color: '#A12626', fontWeight: '900' },
  googleDelete: { alignSelf: 'flex-start', backgroundColor: '#A12626', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  googleDeleteText: { color: '#FFF', fontWeight: '900' },
  reminderList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  reminderChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.soft, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  reminderChipText: { fontSize: 12, fontWeight: '800', color: palette.primary },
  reminderRemove: { fontSize: 12, fontWeight: '900', color: palette.muted },
  presetButton: { backgroundColor: '#ECEEF4', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9 },
  presetButtonText: { fontSize: 12, fontWeight: '800', color: palette.ink },
});
