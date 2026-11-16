const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('settings diagnostics do not create a navigation badge', () => {
  const source = read('app/(tabs)/_layout.tsx');
  assert.doesNotMatch(source, /tabBarBadge:errorCount/);
  assert.doesNotMatch(source, /subscribeDiagnostics/);
});

test('Today keeps completion primary, overdue state semantic, and descriptions compact', () => {
  const source = read('app/(tabs)/today.tsx');
  assert.match(source, /Haptics\.notificationAsync/);
  assert.match(source, /expiredDate/);
  assert.match(source, /numberOfLines=\{2\} style=\{s\.description\}/);
  assert.match(source, /minHeight:44/);
});

test('List exposes compact filters and a clear-search action without changing filter semantics', () => {
  const source = read('app/(tabs)/plan.tsx');
  assert.match(source, /filtersExpanded/);
  assert.match(source, /setQuery\(''\)/);
  assert.match(source, /filters\.kind!=='all'/);
  assert.match(source, /group\.key===todayKey/);
});

test('Calendar differentiates today and selection and provides adjacent-day navigation', () => {
  const source = read('app/(tabs)/calendar.tsx');
  assert.match(source, /moveSelectedDay/);
  assert.match(source, /todayBox/);
  assert.match(source, /selectedBox/);
});

test('Calendar widget gives day and activity distinct click targets', () => {
  const source = read('widgets/android/CalendarWidget.tsx');
  assert.match(source, /flowos:\/\/calendar\?date=\$\{day\.dateKey\}/);
  assert.match(source, /flowos:\/\/calendar\?widgetAction=manage/);
  assert.doesNotMatch(source, /key=\{day\.dateKey\}[\s\S]{0,100}accessibilityLabel=\{`Giorno \$\{day\.label\}`\}[\s\S]{0,120}clickAction="OPEN_URI"/);
});

test('Manage keeps Save in a fixed footer and warns before discarding edits', () => {
  const source = read('components/ManageSheet.tsx');
  assert.match(source, /stickyFooter/);
  assert.match(source, /hasUnsavedChanges/);
  assert.match(source, /requestClose/);
  assert.match(source, /REMINDER_PRESETS\.map\(\(offset\).*reminders\.some/);
});

test('Widget themes, densities, live preview, WCAG contrast and category reset are wired', () => {
  const appearance = read('lib/widgetAppearance.ts');
  const settings = read('app/(tabs)/me.tsx');
  const sync = read('lib/widgetSync.ts');
  assert.match(appearance, /applyWidgetTheme/);
  assert.match(appearance, /contrastRatio/);
  assert.match(appearance, /resetWidgetAppearanceCategory/);
  assert.match(settings, /Anteprima in tempo reale/);
  assert.match(settings, /contrastRatio\(/);
  assert.match(sync, /density:appearance\.density/);
});

test('Settings are searchable and grouped by category, with readable sync and diagnostics status', () => {
  const source = read('app/(tabs)/me.tsx');
  assert.match(source, /settingsQuery/);
  assert.match(source, /settingsCategory/);
  assert.match(source, /syncStatusDot/);
  assert.match(source, /diagnosticErrors/);
});

test('Create focuses the title for immediate entry', () => {
  const source = read('app/(tabs)/capture.tsx');
  assert.match(source, /<Field autoFocus autoGrow/);
});

test('List search includes Google calendar and task-list source names', () => {
  const source = read('app/(tabs)/plan.tsx');
  assert.match(source, /google\\?\.calendars\.find/);
  assert.match(source, /google\\?\.taskLists\.find/);
  assert.match(source, /searchable\(item,sourceName/);
});

test('List and Calendar preserve their selected state when regaining focus', () => {
  const plan = read('app/(tabs)/plan.tsx');
  const calendar = read('app/(tabs)/calendar.tsx');
  assert.match(plan, /hasPlanFocused\.current/);
  assert.match(calendar, /if\(!hasCalendarFocused\.current\)/);
});

test('Calendar marks the start, middle and end of multi-day events as continuous segments', () => {
  const source = read('app/(tabs)/calendar.tsx');
  assert.match(source, /multiDaySegment/);
  assert.match(source, /multiDayStart/);
  assert.match(source, /multiDayMiddle/);
  assert.match(source, /multiDayEnd/);
});

test('Quick create is available from Today, List and Calendar with the relevant date', () => {
  const today = read('app/(tabs)/today.tsx');
  const plan = read('app/(tabs)/plan.tsx');
  const calendar = read('app/(tabs)/calendar.tsx');
  assert.match(today, /QuickAddMenu date=\{quickAddDate\}/);
  assert.match(plan, /QuickAddMenu date=\{todayKey\}/);
  assert.match(calendar, /QuickAddMenu date=\{selectedDateKey\}/);
});

test('Quick create menu supports task, event, voice and contextual date routing', () => {
  const menu = read('components/QuickAddMenu.tsx');
  const capture = read('app/(tabs)/capture.tsx');
  assert.match(menu, /router\.push\(\{pathname:'\/capture',params/);
  assert.match(menu, /open\('task'\)/);
  assert.match(menu, /open\('event'\)/);
  assert.match(menu, /open\(undefined,true\)/);
  assert.match(capture, /params\.kind==='event'/);
  assert.match(capture, /params\.date/);
});

test('Quick create keeps advanced fields collapsed and provides a progressive hint', () => {
  const capture = read('app/(tabs)/capture.tsx');
  assert.match(capture, /showAdvancedOptions/);
  assert.match(capture, /Opzioni avanzate/);
  assert.match(capture, /ProgressiveHint id="quick-create"/);
});

test('Progressive onboarding hints are persisted and dismissible', () => {
  const source = read('components/ProgressiveHint.tsx');
  assert.match(source, /flowos-onboarding-/);
  assert.match(source, /AsyncStorage\.setItem/);
  assert.match(source, /setVisible\(false\)/);
});

test('Task and event types use consistent vector icons across Today, List, Calendar and Create preview', () => {
  const ui = read('components/ui.tsx');
  const today = read('app/(tabs)/today.tsx');
  const plan = read('app/(tabs)/plan.tsx');
  const calendar = read('app/(tabs)/calendar.tsx');
  const capture = read('app/(tabs)/capture.tsx');
  assert.match(ui, /calendar-outline/);
  assert.match(ui, /checkbox-outline/);
  assert.match(today, /ActivityKindTag/);
  assert.match(plan, /ActivityKindTag/);
  assert.match(calendar, /Ionicons name=\{item\.kind/);
  assert.match(capture, /ActivityKindTag/);
});

test('Source tags remain compact while preserving their full accessible source label', () => {
  const source = read('components/CommitmentSourceTag.tsx');
  assert.match(source, /accessibilityLabel=\{label\}/);
  assert.match(source, /Google Calendar/);
  assert.match(source, /Google Tasks/);
  assert.match(source, /Ionicons/);
});

test('Android widgets use localized text controls instead of emoji or symbol glyphs for primary actions', () => {
  const today = read('widgets/android/TodayWidget.tsx');
  const calendar = read('widgets/android/CalendarWidget.tsx');
  assert.match(today, /text=\{labels\.sync\}/);
  assert.match(today, /text=\{labels\.voice\}/);
  assert.match(calendar, /text=\{labels\.sync\}/);
  assert.match(calendar, /text=\{labels\.voice\}/);
  assert.doesNotMatch(today+calendar, /🎙|↻/);
});

test('Reminder presets in Create reflect which offsets are already selected', () => {
  const source = read('app/(tabs)/capture.tsx');
  assert.match(source, /reminders\.some\(reminder=>reminder\.minutesBefore===m\)/);
});

test('Global density updates shared app components and is loaded at startup', () => {
  const ui = read('components/ui.tsx');
  const root = read('app/_layout.tsx');
  const settings = read('app/(tabs)/me.tsx');
  assert.match(ui, /export function DensityProvider/);
  assert.match(ui, /padding:density==='compact'/);
  assert.match(root, /<DensityProvider>/);
  assert.match(settings, /setDensity\(sanitized\.density\)/);
});

test('Today completion combines a subtle layout transition and haptic feedback', () => {
  const source = read('app/(tabs)/today.tsx');
  assert.match(source, /LayoutAnimation\.configureNext\(LayoutAnimation\.Presets\.easeInEaseOut\)/);
  assert.match(source, /Haptics\.notificationAsync/);
});

test('List day separators emphasize weekday and identify Today distinctly', () => {
  const source = read('app/(tabs)/plan.tsx');
  assert.match(source, /groupWeekday/);
  assert.match(source, /todayGroupBadge/);
});

test('Undo is available for completion, postponement and local deletion', () => {
  const store = read('lib/store.ts');
  assert.match(store, /showSnackbar\(t\('Attività completata'\),t\('Annulla'/);
  assert.match(store, /showSnackbar\(t\('Attività rimandata di 1 giorno'\),t\('Annulla'/);
  assert.match(store, /showSnackbar\(t\('Attività eliminata da FlowOS'\),t\('Annulla'/);
});

test('Recurring completion asks for scope while ordinary completion stays immediate', () => {
  const source = read('lib/completePrompt.ts');
  assert.match(source, /if\(!recurring\)/);
  assert.match(source, /complete\(item\.id, 'occurrence'\)/);
  assert.match(source, /Solo questa occorrenza/);
  assert.match(source, /Tutta la serie/);
});

test('Google sync progress remains local and does not block the app', () => {
  const source = read('components/AppChrome.tsx');
  assert.match(source, /subscribeToSyncProgress/);
  assert.match(source, /pointerEvents="none"/);
  assert.match(source, /progress\.percent/);
});

test('Manage and quick-create use lightweight native transitions', () => {
  const manage = read('components/ManageSheet.tsx');
  const quickAdd = read('components/QuickAddMenu.tsx');
  assert.match(manage, /animationType="slide"/);
  assert.match(quickAdd, /animationType="fade"/);
});

test('Manage unsaved-change guard includes duration and recurrence edits', () => {
  const source = read('components/ManageSheet.tsx');
  assert.match(source, /hasUnsavedChanges/);
  assert.match(source, /Number\(days\)!==Math\.floor\(item\.durationMinutes\/1440\)/);
  assert.match(source, /currentReminderMinutes!==initialReminderMinutes/);
  assert.match(source, /requestClose\(\)/);
});

test('Widget settings summarize the active theme and density', () => {
  const source = read('app/(tabs)/me.tsx');
  assert.match(source, /widgetAppearance\.theme/);
  assert.match(source, /widgetAppearance\.density/);
});

test('Multi-day events render as continuous segments in both the app and Android calendar widget', () => {
  const data = read('lib/calendarWidgetData.ts');
  const widget = read('widgets/android/CalendarWidget.tsx');
  const calendar = read('app/(tabs)/calendar.tsx');
  assert.match(data, /multiDaySegment:multiDaySegment\(item,day\)/);
  assert.match(widget, /multiDaySegment==='middle'/);
  assert.match(widget, /showDetails=item\.multiDaySegment/);
  assert.match(calendar, /segment==='middle'&&styles\.multiDayMiddle/);
});

test('The Add tab is visually distinct from navigation destinations', () => {
  const source = read('app/(tabs)/_layout.tsx');
  assert.match(source, /addTabIcon/);
  assert.match(source, /tabBarItemStyle:\{marginTop:-9\}/);
});

test('shared design tokens preserve minimum button touch target', () => {
  const source = read('components/ui.tsx');
  assert.match(source, /layoutTokens/);
  assert.match(source, /minHeight:48/);
  assert.match(source, /typeScale/);
});
