import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { Button, Card, SectionTitle, palette, showAlert, showConfirm } from '@/components/ui';
import { friendlyCalendarName, getGoogleWorkspaceStatus, type GoogleCalendar, type GoogleTaskList } from '@/lib/googleWorkspace';
import { formatReminderOffsetLabel } from '@/lib/customReminders';
import { useFlowStore } from '@/lib/store';
import { requestComplete } from '@/lib/completePrompt';
import { buildRecurrenceOccurrences } from '@/lib/recurrence';
import { createUuid } from '@/lib/uuid';
import type { Commitment, CommitmentKind, ReminderOffset, RecurrenceFrequency } from '@/types';
import { localeForLanguage, t, useLanguage } from '@/lib/i18n';

type RepeatOption = 'none' | RecurrenceFrequency;
const REPEAT_KEYS: Record<RepeatOption, string> = { none: 'Non ripetere', daily: 'Ogni giorno', weekly: 'Ogni settimana', monthly: 'Ogni mese', yearly: 'Ogni anno' };
const REMINDER_PRESETS = [0, 15, 60, 1440];

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

export function ManageSheet({ item, onClose }: { item: Commitment; onClose: () => void }) { const { language } = useLanguage();
  const updateCommitment = useFlowStore((state) => state.updateCommitment);
  const addCommitment = useFlowStore((state) => state.addCommitment);
  const commitments = useFlowStore((state) => state.commitments);
  const complete = useFlowStore((state) => state.complete);
  const removeOnlyFromFlowOS = useFlowStore((state) => state.removeOnlyFromFlowOS);
  const removeAlsoFromGoogle = useFlowStore((state) => state.removeAlsoFromGoogle);
  const removeSeriesFromGoogle = useFlowStore((state) => state.removeSeriesFromGoogle);
  const syncItemToGoogleNow = useFlowStore((state) => state.syncItemToGoogleNow);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [calendarId, setCalendarId] = useState<string | undefined>(item.googleCalendarId);
  const [taskListId, setTaskListId] = useState<string | undefined>(item.googleTaskListId);
  const [ownEmail, setOwnEmail] = useState<string | null>(null);
  useEffect(() => {
    void getGoogleWorkspaceStatus().then((status) => {
      const writable = status.calendars.filter((calendar) => calendar.selected && ['owner', 'writer'].includes(calendar.access_role));
      const lists = status.taskLists.filter((list) => list.selected);
      setCalendars(writable); setTaskLists(lists); setOwnEmail(status.connection?.google_email ?? null);
      setCalendarId((current) => current ?? (writable.find((calendar) => calendar.google_calendar_id === item.googleCalendarId) ?? writable.find((calendar) => calendar.is_default) ?? writable[0])?.google_calendar_id);
      setTaskListId((current) => current ?? (lists.find((list) => list.google_task_list_id === item.googleTaskListId) ?? lists.find((list) => list.is_default) ?? lists[0])?.google_task_list_id);
    }).catch(() => undefined);
  }, [item.googleCalendarId, item.googleTaskListId]);

  const dateField = item.scheduledAt ? 'scheduledAt' : 'dueAt';
  const [title, setTitle] = useState(item.title);
  const [kind, setKind] = useState<CommitmentKind>(item.kind);
  const [allDay, setAllDay] = useState(Boolean(item.allDay));
  const [dateStr, setDateStr] = useState(toDateInput(item[dateField], item.allDay));
  const [timeStr, setTimeStr] = useState(toTimeInput(item[dateField], item.allDay));
  const [durationMode, setDurationMode] = useState<'duration'|'end'>('duration');
  const [repeat, setRepeat] = useState<RepeatOption>(item.recurrenceRule?.frequency ?? 'none');
  const [repeatUntil, setRepeatUntil] = useState(item.recurrenceRule?.until ? toDateInput(item.recurrenceRule.until, false) : item.recurrenceSeriesEndAt ? toDateInput(item.recurrenceSeriesEndAt, false) : '');
  const [showDetails, setShowDetails] = useState(Boolean(item.description || item.notes || item.location || item.link));
  const [days, setDays] = useState(String(Math.floor(item.durationMinutes / 1440)));
  const [hours, setHours] = useState(String(Math.floor((item.durationMinutes % 1440) / 60)));
  const [minutes, setMinutes] = useState(String(item.durationMinutes % 60));
  const initialEnd = new Date(new Date(item[dateField] ?? Date.now()).getTime() + Math.max(1,item.durationMinutes)*60000);
  const [endDate, setEndDate] = useState(initialEnd.toISOString().slice(0,10));
  const [endTime, setEndTime] = useState(initialEnd.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}));
  const [datePickerTarget, setDatePickerTarget] = useState<'start'|'end'|'recurrence'|null>(null);
  const [priority, setPriority] = useState(String(item.priority ?? ''));
  const [location, setLocation] = useState(item.location ?? '');
  const [notes, setNotes] = useState(item.notes ?? '');
  const [link, setLink] = useState(item.link ?? '');
  const [description, setDescription] = useState(item.description ?? '');
  const [reminders, setReminders] = useState<ReminderOffset[]>(() => {
    const configured = item.reminders ?? [];
    if (configured.some((reminder) => reminder.minutesBefore === 0)) return configured;
    return [...configured, {
      id: `default-start-${item.id}`,
      minutesBefore: 0,
      createdAt: new Date().toISOString(),
    }].sort((a, b) => a.minutesBefore - b.minutesBefore);
  });
  const [customDays, setCustomDays] = useState('');
  const [customHours, setCustomHours] = useState('');
  const [customMinutes, setCustomMinutes] = useState('');
  const [busy, setBusy] = useState(false);

  function addReminder(minutesBefore: number) {
    if (reminders.some((r) => r.minutesBefore === minutesBefore)) return;
    setReminders((current) => [...current, { id: `${Date.now()}-${minutesBefore}`, minutesBefore, createdAt: new Date().toISOString() }].sort((a, b) => a.minutesBefore - b.minutesBefore));
  }
  function removeReminder(id: string) {
    setReminders((current) => current.filter((r) => r.id !== id));
  }

  function setDurationFields(total:number){const safe=Math.max(1,Math.round(total));setDays(String(Math.floor(safe/1440)));setHours(String(Math.floor((safe%1440)/60)));setMinutes(String(safe%60));}
  function setEndFromDuration(total=Math.max(1,(Number(days)||0)*1440+(Number(hours)||0)*60+(Number(minutes)||0))){if(allDay)return;const start=combine(dateStr,timeStr,false);if(!start)return;const end=new Date(new Date(start).getTime()+Math.max(1,total)*60000);setEndDate(end.toISOString().slice(0,10));setEndTime(end.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}));}
  function updateStartDate(value:string){setDateStr(value);if(durationMode==='end'&&!allDay){const start=combine(value,timeStr,false);if(start){const end=new Date(new Date(start).getTime()+Math.max(1,(Number(days)||0)*1440+(Number(hours)||0)*60+(Number(minutes)||0))*60000);setEndDate(`${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`);setEndTime(`${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`);}}}
  function updateStartTime(value:string){setTimeStr(value);if(durationMode==='end'&&!allDay){const start=combine(dateStr,value,false);if(start){const end=new Date(new Date(start).getTime()+Math.max(1,(Number(days)||0)*1440+(Number(hours)||0)*60+(Number(minutes)||0))*60000);setEndDate(`${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`);setEndTime(`${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`);}}}
  function updateEndDate(value:string){setEndDate(value);const start=combine(dateStr,timeStr,allDay),end=combine(value,endTime,allDay);if(durationMode==='end'&&start&&end)setDurationFields(Math.max(1,Math.round((new Date(end).getTime()-new Date(start).getTime())/60000)));}
  function updateEndTime(value:string){setEndTime(value);const start=combine(dateStr,timeStr,allDay),end=combine(endDate,value,allDay);if(durationMode==='end'&&start&&end)setDurationFields(Math.max(1,Math.round((new Date(end).getTime()-new Date(start).getTime())/60000)));}
  function handleDatePicked(selected:Date){const value=`${selected.getFullYear()}-${String(selected.getMonth()+1).padStart(2,'0')}-${String(selected.getDate()).padStart(2,'0')}`;if(datePickerTarget==='start')updateStartDate(value);else if(datePickerTarget==='end')updateEndDate(value);else if(datePickerTarget==='recurrence')setRepeatUntil(value);setDatePickerTarget(null);}

  async function save() {
    setBusy(true);
    try {
      const when = combine(dateStr, timeStr, allDay);
      const endWhen = combine(endDate, endTime, allDay);
      const durationMinutes = durationMode === 'end' && !allDay && when && endWhen
        ? Math.max(1, Math.round((new Date(endWhen).getTime() - new Date(when).getTime()) / 60000))
        : Math.max(1, (Number(days) || 0) * 1440 + (Number(hours) || 0) * 60 + (Number(minutes) || 0));
      if((repeat!=='none'||item.googleRecurringEventId||item.recurrenceSeriesId)&&(!repeatUntil||!Number.isFinite(new Date(`${repeatUntil}T23:59:59.999`).getTime())||new Date(`${repeatUntil}T23:59:59.999`).getTime()<new Date(when??'').getTime())){showAlert(t('Gestisci'),t('Indica una data di fine della serie uguale o successiva alla data di inizio.'));return;}
      const updated: Commitment = {
        ...item,
        title: title.trim() || item.title,
        kind,
        priority: kind === 'task' && priority.trim() ? Math.max(1, Number(priority)) : undefined,
        allDay,
        durationMinutes,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        link: link.trim() || undefined,
        description: description.trim() || undefined,
        reminders: reminders.length ? reminders : undefined,
        recurrenceRule: repeat !== 'none' ? { frequency: repeat, interval: item.recurrenceRule?.frequency === repeat ? item.recurrenceRule.interval ?? 1 : 1, until: new Date(`${repeatUntil}T23:59:59.999`).toISOString() } : item.recurrenceRule,
        recurrenceSeriesEndAt: (repeat !== 'none' || item.googleRecurringEventId || item.recurrenceSeriesId) ? new Date(`${repeatUntil}T23:59:59.999`).toISOString() : undefined,
        googleCalendarId: kind === 'event' ? calendarId : undefined,
        googleTaskListId: kind === 'task' ? taskListId : undefined,
        scheduledAt: kind === 'event' ? when : undefined,
        dueAt: kind !== 'event' ? when : undefined,
      };
      await updateCommitment(updated);
      if(kind==='task'&&updated.recurrenceRule){
        const occurrences=buildRecurrenceOccurrences(updated,createUuid);
        const seriesId=updated.recurrenceSeriesId??updated.id;
        const existingDates=new Set(commitments.filter(candidate=>(candidate.recurrenceSeriesId??(candidate.recurrenceRule?candidate.id:undefined))===seriesId).map(candidate=>candidate.dueAt??candidate.scheduledAt));
        for(const occurrence of occurrences.slice(1))if(!existingDates.has(occurrence.dueAt??occurrence.scheduledAt))await addCommitment(occurrence);
      }
      onClose();
    } catch (error) {
      showAlert(t('Gestisci'), error instanceof Error ? error.message : t('Salvataggio non riuscito.'));
    } finally {
      setBusy(false);
    }
  }

  async function removeLocal() {
    setBusy(true);
    try { await removeOnlyFromFlowOS(item.id); onClose(); }
    catch (error) { showAlert(t('Gestisci'), error instanceof Error ? error.message : t('Eliminazione non riuscita.')); }
    finally { setBusy(false); }
  }
  async function removeGoogle() {
    const ok = await showConfirm('Eliminare definitivamente da Google?', `"${item.title}" verrà eliminato da Google ${item.kind === 'event' ? 'Calendar' : 'Tasks'} e da FlowOS. Questa occorrenza soltanto. Questa operazione non può essere annullata.`, 'Elimina definitivamente');
    if (!ok) return;
    setBusy(true);
    try { await removeAlsoFromGoogle(item.id); onClose(); }
    catch (error) { showAlert(t('Gestisci'), error instanceof Error ? error.message : t('Eliminazione non riuscita.')); }
    finally { setBusy(false); }
  }
  async function removeSeries() {
    const ok = await showConfirm('Eliminare tutta la serie ricorrente?', `"${item.title}" e TUTTE le altre occorrenze verranno eliminate da Google e da FlowOS. Questa operazione non può essere annullata.`, t('Elimina tutta la serie'));
    if (!ok) return;
    setBusy(true);
    try { await removeSeriesFromGoogle(item.id); onClose(); }
    catch (error) { showAlert(t('Gestisci'), error instanceof Error ? error.message : t('Eliminazione non riuscita.')); }
    finally { setBusy(false); }
  }
  async function syncNow() {
    setBusy(true);
    try { await syncItemToGoogleNow(item.id); showAlert(t('Gestisci'), t('Sincronizzazione con Google avviata.')); }
    catch (error) { showAlert(t('Gestisci'), error instanceof Error ? error.message : t('Sincronizzazione non riuscita.')); }
    finally { setBusy(false); }
  }

  const isFlowOSOnly = !item.externalId;
  const destinationName = useMemo(() => {
    if (kind === 'event') { const calendar = calendars.find((entry) => entry.google_calendar_id === calendarId); return calendar ? friendlyCalendarName(calendar.summary, ownEmail, language) : undefined; }
    return taskLists.find((entry) => entry.google_task_list_id === taskListId)?.title;
  }, [kind, calendars, taskLists, calendarId, taskListId, ownEmail, language]);

  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <ScrollView showsVerticalScrollIndicator persistentScrollbar keyboardShouldPersistTaps="handled" contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>{t('Gestisci')}</Text>
      <SectionTitle title={t('1. Tipo')} subtitle={t('Evento per un appuntamento fisso; task per un’attività.')}/>
      <View style={styles.kindRow}>{(['task','event'] as const).map((value) => <Pressable key={value} onPress={() => setKind(value)} style={[styles.kindCard, kind === value && styles.kindCardActive]}><Text style={[styles.kindTitle, kind === value && styles.kindTitleActive]}>{value === 'event' ? t('Evento') : t('Task')}</Text><Text style={[styles.kindHelp, kind === value && styles.kindTitleActive]}>{value === 'event' ? t('Occupa uno spazio nel calendario') : t('Richiede un’azione')}</Text></Pressable>)}</View>

      <SectionTitle title={t('2. Destinazione Google')} subtitle={kind === 'event' ? t('Scegli il calendario prima di inserire i dettagli.') : t('Scegli la lista Google Tasks prima di inserire i dettagli.')}/>
      <Card><Text style={styles.destination}>{t('Destinazione')}: <Text style={styles.destinationStrong}>{destinationName ?? t('nessuna disponibile')}</Text></Text>
        <View style={styles.rowWrap}>{kind === 'event' ? calendars.map((entry) => <Choice key={entry.id} label={friendlyCalendarName(entry.summary, ownEmail, language)} active={entry.google_calendar_id === calendarId} onPress={() => setCalendarId(entry.google_calendar_id)}/>) : taskLists.map((entry) => <Choice key={entry.id} label={entry.title} active={entry.google_task_list_id === taskListId} onPress={() => setTaskListId(entry.google_task_list_id)}/>)}</View>
        {!destinationName ? <Text style={styles.help}>{t('Configura almeno una destinazione scrivibile nella sezione Io.')}</Text> : null}
      </Card>

      <SectionTitle title={t('3. Informazioni essenziali')}/><Card>
        <Field autoGrow required label={t('Titolo')} value={title} onChangeText={setTitle} placeholder={kind === 'event' ? t('Es. Visita pediatrica') : t('Es. Preparare il budget')}/>
        <View style={styles.rowBetween}><Text style={styles.fieldLabel}>{t('Giornata intera')}</Text><Switch value={allDay} onValueChange={setAllDay}/></View>
        <View style={styles.inline}><View style={[styles.flex, styles.field]}><Text numberOfLines={1} style={styles.fieldLabelFixed}>{t('Data di inizio')}<Text style={styles.required}> *</Text></Text><Pressable onPress={() => setDatePickerTarget('start')} style={styles.dateButton}><Text style={styles.dateButtonText}>{dateStr}</Text></Pressable></View>{!allDay ? <View style={styles.flex}><Field fixedLabel singleLineLabel required label={t('Orario di inizio')} value={timeStr} onChangeText={updateStartTime} placeholder="HH:MM"/></View> : null}</View>
        {kind === 'task' && !allDay ? <><Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>{t('Fine o durata')}</Text><View style={styles.choices}><Choice label={t('Durata')} active={durationMode === 'duration'} onPress={() => setDurationMode('duration')}/><Choice label={t('Data e ora di fine')} active={durationMode === 'end'} onPress={() => { setEndFromDuration(); setDurationMode('end'); }}/></View></> : null}
        {kind === 'task' && durationMode === 'end' && !allDay ? <View style={styles.inline}><View style={[styles.flex, styles.field]}><Text style={styles.fieldLabelFixed}>{t('Data di fine')}</Text><Pressable onPress={() => setDatePickerTarget('end')} style={styles.dateButton}><Text style={styles.dateButtonText}>{endDate}</Text></Pressable></View><View style={styles.flex}><Field fixedLabel singleLineLabel required label={t('Orario di fine')} value={endTime} onChangeText={updateEndTime} placeholder="HH:MM"/></View></View> : null}
        {kind !== 'task' || allDay || durationMode === 'duration' ? <><Text style={styles.fieldLabel}>{t('Durata')}{allDay ? ' (' + t('giorni') + ')' : ''}<Text style={styles.required}> *</Text></Text><View style={styles.inline}><View style={styles.flex}><Field label={t('giorni')} value={days} onChangeText={(value) => setDays(value.replace(/\D/g,''))} keyboardType="number-pad" placeholder="0"/></View>{!allDay ? <><View style={styles.flex}><Field label={t('ore')} value={hours} onChangeText={(value) => setHours(value.replace(/\D/g,''))} keyboardType="number-pad" placeholder="0"/></View><View style={styles.flex}><Field label={t('minuti')} value={minutes} onChangeText={(value) => setMinutes(value.replace(/\D/g,''))} keyboardType="number-pad" placeholder="0"/></View></> : null}</View></> : null}
        {kind === 'task' ? <><Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>{t('Priorità')}</Text><Field label={t('Ordine di esecuzione')} value={priority} onChangeText={(value) => setPriority(value.replace(/\D/g,''))} keyboardType="number-pad" placeholder={t('Facoltativa')}/></> : null}
        <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>{t('Ripeti')}{kind === 'task' ? ' (' + t('Ripetizione task gestita da FlowOS: Google Tasks non supporta la ricorrenza.') + ')' : ''}</Text><View style={styles.choices}>{(['none','daily','weekly','monthly','yearly'] as const).map((option) => <Choice key={option} label={t(REPEAT_KEYS[option])} active={repeat === option} onPress={() => setRepeat(option)}/>)}</View>{repeat!=='none'||item.googleRecurringEventId||item.recurrenceSeriesId?<View style={styles.field}><Text style={styles.fieldLabelFixed}>{t('Fine della serie')} *</Text><Pressable onPress={()=>setDatePickerTarget('recurrence')} style={styles.dateButton}><Text style={styles.dateButtonText}>{repeatUntil||t('Seleziona una data')}</Text></Pressable><Text style={styles.help}>{t('Tutte le occorrenze fino a questa data saranno create e mostrate.')}</Text></View>:null}
        <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>{t('Notifiche di rappel')}</Text>{reminders.length ? <View style={styles.remindersList}>{reminders.map((reminder) => <View key={reminder.id} style={styles.reminderChip}><Text style={styles.reminderChipText}>{formatReminderOffsetLabel(reminder.minutesBefore, language)}</Text><Pressable onPress={() => removeReminder(reminder.id)}><Text style={styles.reminderRemove}>✕</Text></Pressable></View>)}</View> : null}
        <View style={styles.choices}>{REMINDER_PRESETS.map((offset) => <Choice key={offset} label={formatReminderOffsetLabel(offset, language)} active={false} onPress={() => addReminder(offset)}/>)}</View>
        <View style={styles.inline}><View style={styles.flex}><Field fixedLabel label={t('giorni prima').replace(/\s+/, '\n')} value={customDays} onChangeText={(value) => setCustomDays(value.replace(/\D/g,''))} keyboardType="number-pad" placeholder="0"/></View><View style={styles.flex}><Field fixedLabel label={t('ore prima').replace(/\s+/, '\n')} value={customHours} onChangeText={(value) => setCustomHours(value.replace(/\D/g,''))} keyboardType="number-pad" placeholder="0"/></View><View style={styles.flex}><Field fixedLabel label={t('minuti prima').replace(/\s+/, '\n')} value={customMinutes} onChangeText={(value) => setCustomMinutes(value.replace(/\D/g,''))} keyboardType="number-pad" placeholder="0"/></View><Pressable onPress={() => { const offset = (Number(customDays)||0)*1440+(Number(customHours)||0)*60+(Number(customMinutes)||0); if(customDays !== '' || customHours !== '' || customMinutes !== '') { addReminder(offset); setCustomDays(''); setCustomHours(''); setCustomMinutes(''); } }} style={styles.addReminderButton}><Text style={styles.addReminderButtonText}>{t('Aggiungi')}</Text></Pressable></View>
      </Card>
      <Pressable onPress={() => setShowDetails((value) => !value)} style={styles.detailsToggle}><Text style={styles.detailsToggleText}>{showDetails ? t('Nascondi dettagli facoltativi') : t('Aggiungi descrizione, note, luogo o link')}</Text><Text style={styles.chevron}>{showDetails ? '−' : '+'}</Text></Pressable>{showDetails ? <Card><Field label={t('Descrizione')} value={description} onChangeText={setDescription} multiline placeholder={t('Informazioni principali')}/><Field label={t('Note private')} value={notes} onChangeText={setNotes} multiline placeholder={t('Dettagli utili per te')}/><Field label={t('Luogo')} value={location} onChangeText={setLocation} placeholder={t('Indirizzo o luogo')}/><Field label={t('Link')} value={link} onChangeText={setLink} keyboardType="url" autoCapitalize="none" placeholder="https://…"/></Card> : null}

      {item.status!=='done' ? <Button secondary label={t('Completa')} onPress={() => requestComplete(item,(id,scope)=>complete(id,scope).then(()=>onClose()))} disabled={busy}/> : null}
      <View style={styles.actionsRow}><Button secondary label={t('Annulla')} onPress={onClose} disabled={busy}/><Button label={t('Salva modifiche')} onPress={() => void save()} loading={busy}/></View>
      {isFlowOSOnly ? <View style={styles.section}><Text style={styles.sectionTitle}>{t('Solo su FlowOS')}</Text><Text style={styles.help}>{t('Questo elemento non è mai stato sincronizzato con Google.')}</Text><Button secondary label={t('Sincronizza con Google')} onPress={() => void syncNow()} disabled={busy}/></View> : null}

      <View style={styles.section}><Text style={styles.sectionTitle}>{t('Elimina')}</Text>
        <Pressable disabled={busy} onPress={() => void removeLocal()} style={styles.localDelete}><Text style={styles.localDeleteText}>{t('Elimina da FlowOS')}</Text></Pressable>
        {item.externalId ? <Pressable disabled={busy} onPress={() => void removeGoogle()} style={styles.googleDelete}><Text style={styles.googleDeleteText}>{t('Elimina da FlowOS e Google')}</Text></Pressable> : null}
        {item.googleRecurringEventId ? <Pressable disabled={busy} onPress={() => void removeSeries()} style={styles.googleDelete}><Text style={styles.googleDeleteText}>{t('Elimina tutta la serie')}</Text></Pressable> : null}
      </View>
      {datePickerTarget ? <DateTimePicker value={new Date(`${datePickerTarget === 'start' ? dateStr : datePickerTarget === 'end' ? endDate : repeatUntil || dateStr}T12:00:00`)} mode="date" presentation="dialog" locale={localeForLanguage(language)} onValueChange={(_, selectedDate) => handleDatePicked(selectedDate)} onDismiss={() => setDatePickerTarget(null)}/> : null}
    </ScrollView>
  </Modal>}
function Choice({label, active, onPress}:{label:string;active:boolean;onPress:()=>void}) { return <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text></Pressable>; }
type FieldProps = {label:string; value:string; onChangeText:(value:string)=>void; required?:boolean; multiline?:boolean; autoGrow?:boolean; placeholder?:string; keyboardType?:'default'|'number-pad'|'url'; autoCapitalize?:'none'|'sentences'; fixedLabel?:boolean; singleLineLabel?:boolean};
function Field({label,value,onChangeText,required,multiline,autoGrow,placeholder,keyboardType,autoCapitalize,fixedLabel,singleLineLabel}:FieldProps) { const [contentHeight,setContentHeight]=useState(48); return <View style={styles.field}><Text numberOfLines={singleLineLabel ? 1 : undefined} style={fixedLabel ? styles.fieldLabelFixed : styles.fieldLabel}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text><TextInput value={value} onChangeText={onChangeText} multiline={Boolean(multiline||autoGrow)} scrollEnabled={autoGrow?false:undefined} onContentSizeChange={autoGrow?event=>setContentHeight(Math.max(48,event.nativeEvent.contentSize.height)):undefined} placeholder={placeholder} placeholderTextColor="#979DAE" keyboardType={keyboardType} autoCapitalize={autoCapitalize} style={[styles.input,(multiline||autoGrow)&&styles.multiline,autoGrow&&{height:contentHeight,minHeight:48}]}/></View>; }

const styles = StyleSheet.create({
  wrap:{padding:20,paddingTop:50,paddingBottom:60,gap:8,backgroundColor:palette.bg},
  title:{fontSize:26,fontWeight:'900',color:palette.ink,marginBottom:10},
  kindRow:{flexDirection:'row',gap:10,marginTop:4},
  kindCard:{flex:1,minWidth:0,borderWidth:1,borderColor:palette.border,borderRadius:16,padding:14,backgroundColor:'#FFF',gap:5},
  kindCardActive:{borderColor:palette.primary,backgroundColor:palette.soft},
  kindTitle:{fontSize:15,fontWeight:'900',color:palette.ink},
  kindTitleActive:{color:palette.primary},
  kindHelp:{fontSize:12,color:palette.muted},
  destination:{fontSize:13,color:palette.muted,marginBottom:8},
  destinationStrong:{fontWeight:'900',color:palette.ink},
  field:{marginTop:13},
  fieldLabel:{fontSize:12,fontWeight:'800',color:palette.muted,marginBottom:6},
  fieldLabelFixed:{fontSize:12,fontWeight:'800',color:palette.muted,marginBottom:6,minHeight:26,lineHeight:13},
  fieldLabelSpaced:{marginTop:18},
  required:{color:palette.danger},
  input:{backgroundColor:'#FFF',borderWidth:1,borderColor:palette.border,borderRadius:12,padding:12,color:palette.ink,fontSize:15},
  multiline:{minHeight:88,textAlignVertical:'top'},
  dateButton:{backgroundColor:'#FFF',borderWidth:1,borderColor:palette.border,borderRadius:12,padding:12,minHeight:48,justifyContent:'center'},
  dateButtonText:{color:palette.ink,fontSize:15},
  inline:{flexDirection:'row',gap:10},
  flex:{flex:1},
  row:{flexDirection:'row',gap:8,marginTop:6,flexWrap:'nowrap'},
  rowWrap:{flexDirection:'row',gap:8,marginTop:8,flexWrap:'wrap'},
  flexField:{flex:1,minWidth:0},
  durationInput:{flex:1},
  durationLabel:{fontSize:11,fontWeight:'700',color:palette.muted,marginBottom:4,marginTop:8},
  rowBetween:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:13},
  choices:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:12},
  choice:{borderRadius:99,paddingHorizontal:12,paddingVertical:9,backgroundColor:'#F0F1F6',borderWidth:1,borderColor:palette.border},
  choiceActive:{backgroundColor:palette.primary,borderColor:palette.primary},
  choiceText:{fontSize:13,fontWeight:'700',color:palette.ink},
  choiceTextActive:{color:'#FFF'},
  actionsRow:{flexDirection:'row',gap:8,marginTop:20},
  section:{marginTop:24,paddingTop:16,borderTopWidth:1,borderTopColor:palette.border,gap:8},
  sectionTitle:{fontSize:14,fontWeight:'900',color:palette.ink},
  help:{fontSize:12,color:palette.muted},
  localDelete:{alignSelf:'flex-start',backgroundColor:'#FDECEC',borderRadius:12,paddingHorizontal:12,paddingVertical:12,minHeight:44,justifyContent:'center'},
  localDeleteText:{color:'#A12626',fontWeight:'900'},
  googleDelete:{alignSelf:'flex-start',backgroundColor:'#A12626',borderRadius:12,paddingHorizontal:12,paddingVertical:12,minHeight:44,justifyContent:'center'},
  googleDeleteText:{color:'#FFF',fontWeight:'900'},
  remindersList:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:6},
  reminderList:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:8},
  reminderChip:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:palette.soft,borderRadius:99,paddingHorizontal:10,paddingVertical:6},
  reminderChipText:{fontSize:12,fontWeight:'800',color:palette.primary},
  reminderRemove:{fontSize:12,fontWeight:'900',color:palette.muted},
  addReminderButton:{backgroundColor:'#ECEEF4',borderRadius:12,paddingHorizontal:12,justifyContent:'center'},
  addReminderButtonText:{fontSize:12,fontWeight:'800',color:palette.ink},
  detailsToggle:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:13},
  detailsToggleText:{fontSize:15,fontWeight:'800',color:palette.primary},
  chevron:{fontSize:24,color:palette.primary},
});