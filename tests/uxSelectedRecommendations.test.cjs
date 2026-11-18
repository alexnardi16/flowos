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
  assert.doesNotMatch(source, /Haptics|Vibration|vibrate/);
  assert.match(source, /expiredDate/);
  assert.match(source, /numberOfLines=\{2\} style=\{s\.description\}/);
  assert.match(source, /minHeight:30/);
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
  assert.doesNotMatch(source, /key=\{`\$\{week\.title\}-\$\{week\.days\[0\]\?\.dateKey\}`\} clickAction=/);
});

test('Manage keeps Save in a fixed footer and warns before discarding edits', () => {
  const source = read('components/ManageSheet.tsx');
  assert.match(source, /stickyFooter/);
  assert.match(source, /hasUnsavedChanges/);
  assert.match(source, /requestClose/);
  assert.match(source, /REMINDER_PRESETS\.map\(\(offset\).*reminders\.some/);
});

test('Dark widget appearance adapts source cards, day surfaces and borders without changing source identity', () => {
  const appearance = read('lib/widgetAppearance.ts');
  const sync = read('lib/widgetSync.ts');
  const today = read('widgets/android/TodayWidget.tsx');
  const calendar = read('widgets/android/CalendarWidget.tsx');
  const data = read('lib/calendarWidgetData.ts');
  assert.match(appearance, /appearance\.theme==='flowos-dark'/);
  assert.match(appearance, /DARK_SOURCE_COLORS/);
  assert.match(sync, /widgetTodaySurfaceColor/);
  assert.match(today, /borderColor=BORDER/);
  assert.match(today, /borderColor:borderColor as any/);
  assert.match(calendar, /borderColor=BORDER/);
  assert.match(today, /item\.kind\.toUpperCase\(\)/);
  assert.match(calendar, /todaySurfaceColor/);
  assert.match(calendar, /item\.kind\.toUpperCase\(\)/);
  assert.match(data, /kind:item\.kind==='event'\?strings\.event:strings\.task/);
});

test('Location and primary widget actions use consistent non-emoji labels or vector icons', () => {
  const today = read('app/(tabs)/today.tsx');
  const androidToday = read('widgets/android/TodayWidget.tsx');
  const androidCalendar = read('widgets/android/CalendarWidget.tsx');
  assert.match(today, /Ionicons name="location-outline"/);
  assert.doesNotMatch(today, /📍/);
  assert.match(androidToday, /accessibilityLabel=\{labels\.today\}/);
  assert.match(androidToday, /text="✓"/);
  assert.match(androidCalendar, /text="\+"/);
  assert.match(androidToday+androidCalendar, /accessibilityLabel=\{labels\.sync\}/);
});

test('Widget editor previews both Today and Calendar with live theme, color and opacity values', () => {
  const source = read('app/(tabs)/me.tsx');
  assert.match(source, /widgetAppearance\.today\.backgroundColor/);
  assert.match(source, /widgetAppearance\.calendar\.backgroundColor/);
  assert.match(source, /widgetAppearance\.calendar\.buttonBackgroundOpacity/);
  assert.match(source, /calendarPreviewDays/);
  assert.match(source, /calendarPreviewEvent/);
});

test('Widget themes, densities, live preview, WCAG contrast and category reset are wired', () => {
  const appearance = read('lib/widgetAppearance.ts');
  const settings = read('app/(tabs)/me.tsx');
  const sync = read('lib/widgetSync.ts');
  assert.match(appearance, /applyWidgetTheme/);
  assert.match(appearance, /contrastRatio/);
  assert.match(appearance, /resetWidgetAppearanceCategory/);
  assert.match(settings, /#7669E8.*#9278C8.*#302B3A.*#F6F7FB.*#FFF8F0/);
  assert.match(settings, /Anteprima in tempo reale/);
  assert.match(settings, /contrastRatio\(/);
  assert.match(sync, /density:appearance\.density/);
});

test('Notification settings are grouped into Android permissions, activity reminders, system notifications and automatic summaries', () => {
  const source = read('app/(tabs)/me.tsx');
  const translations = read('lib/i18n.ts');
  assert.match(source, /Notifications\.getPermissionsAsync/);
  assert.match(source, /Notifications\.requestPermissionsAsync/);
  assert.match(source, /Linking\.openSettings/);
  assert.match(source, /t\('Permessi Android'\)/);
  assert.doesNotMatch(source, /t\('Reminder delle attività'\)/);
  assert.match(source, /t\('Notifiche di sistema'\)/);
  assert.match(source, /t\('Riepiloghi automatici'\)/);
  assert.match(translations, /Object\.assign\(translations\.en/);
  assert.match(translations, /Object\.assign\(translations\.fr/);
  assert.match(translations, /Object\.assign\(translations\.es/);
});

test('Diagnostics distinguish errors, warnings and informational entries', () => {
  const source = read('app/(tabs)/me.tsx');
  assert.match(source, /diagnosticInfo=logs\.filter\(entry=>entry\.level==='info'\)/);
  assert.match(source, /diagnosticErrors\} \{t\('errori'\)\} · \{diagnosticWarnings\} \{t\('avvisi'\)\} · \{diagnosticInfo\} \{t\('info'\)\}/);
  assert.match(source, /entry\.level==='info'&&styles\.logInfo/);
  assert.match(source, /logInfo:\{color:palette\.muted\}/);
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
  assert.match(source, /google\?\.calendars\.find/);
  assert.match(source, /google\?\.taskLists\.find/);
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
  assert.match(today, /text="↻"/);
  assert.match(today, /text="🎙"/);
  assert.match(calendar, /text="↻"/);
  assert.match(calendar, /text="🎙"/);
  assert.match(today+calendar, /accessibilityLabel=\{labels\.sync\}/);
});

test('Create and Manage show a localized recurrence summary including the weekly weekday and series end', () => {
  const helper = read('lib/recurrenceSummary.ts');
  const capture = read('app/(tabs)/capture.tsx');
  const manage = read('components/ManageSheet.tsx');
  assert.match(helper, /frequency==='weekly'/);
  assert.match(helper, /weekday:'long'/);
  assert.match(helper, /untilDate\.toLocaleDateString/);
  assert.match(capture, /formatRecurrenceSummary\(repeat,date,repeatUntil,language\)/);
  assert.match(manage, /formatRecurrenceSummary\(repeat,dateStr,repeatUntil,language\)/);
});

test('Create keeps the calculated end time visible when start date, start time, duration or all-day state changes', () => {
  const source = read('app/(tabs)/capture.tsx');
  assert.match(source, /setDurationInput[\s\S]*?setEndFromDuration/);
  assert.match(source, /function toggleAllDay[\s\S]*?setEndFromDuration/);
  assert.match(source, /function setStartDateValue[\s\S]*?setEndFromDuration/);
  assert.match(source, /function setStartTimeValue[\s\S]*?setEndFromDuration/);
  assert.match(source, /label=\{t\('Orario di fine'\)\}/);
});

test('Reminder presets in Create reflect which offsets are already selected', () => {
  const source = read('app/(tabs)/capture.tsx');
  assert.match(source, /reminders\.some\(reminder=>reminder\.minutesBefore===m\)/);
});

test('Settings search can find app theme options and shows the active theme summary', () => {
  const source = read('app/(tabs)/me.tsx');
  assert.match(source, /app appearance theme dark light system/);
  assert.match(source, /Tema attivo/);
  assert.match(source, /widgetAppearance\.appTheme/);
});

test('App light, dark and system appearance modes are persisted and applied through adaptive colors', () => {
  const appearance = read('lib/widgetAppearance.ts');
  const ui = read('components/ui.tsx');
  const settings = read('app/(tabs)/me.tsx');
  const root = read('app/_layout.tsx');
  assert.match(appearance, /appTheme: 'system'/);
  assert.match(ui, /Appearance\.setColorScheme/);
  assert.match(ui, /DynamicColorIOS/);
  assert.match(ui, /const adaptiveColor=.*DynamicColorIOS.*:light/);
  assert.doesNotMatch(ui, /PlatformColor/);
  assert.match(settings, /widgetAppearance\.appTheme===option\.id/);
  assert.match(root, /StatusBar style="auto"/);
});

test('Android app text palette never relies on OEM theme attributes that can render invisible text', () => {
  const ui = read('components/ui.tsx');
  assert.match(ui, /Use explicit app colors on Android/);
  assert.match(ui, /const adaptiveColor=.*Platform\.OS==='ios'\?DynamicColorIOS\(\{light,dark\}\):light/);
  assert.doesNotMatch(ui, /PlatformColor/);
});

test('Calendar tab resolves to the actual calendar route and uses a supported outline icon', () => {
  const source = read('app/(tabs)/_layout.tsx');
  assert.match(source, /Tabs\.Screen name="calendar"/);
  assert.match(source, /Ionicons name="calendar-outline"/);
  assert.doesNotMatch(source, /Tabs\.Screen name="calendar-outline"/);
});

test('Calendar multi-day segments reserve the same vertical space on every day', () => {
  const source = read('widgets/android/CalendarWidget.tsx');
  assert.match(source, /return vertical\*2\+timeHeight\+durationHeight\+lines\*titleLine\+6/);
  assert.doesNotMatch(source, /multiDaySegment==='middle'\|\|item\.multiDaySegment==='end'\?0:6/);
});

test('Multi-day completion is stored per date without globally completing the activity', () => {
  const visibility = read('lib/commitmentVisibility.ts');
  const store = read('lib/store.ts');
  const repository = read('lib/commitmentsRepository.ts');
  const widgetData = read('lib/widgetData.ts');
  assert.match(visibility, /isCompletedOnDate/);
  assert.match(visibility, /return !isCompletedOnDate\(item, now\)/);
  assert.match(store, /dailyCompletedDates:\[\.\.\.\(item\.dailyCompletedDates\?\?\[\]\),dayKey\]/);
  assert.match(store, /isMultiDayActivity\(item\)/);
  assert.match(visibility, /item\.durationMinutes > 24 \* 60 && activityEnd\(item\) !== null/);
  assert.match(repository, /dailyCompletedDates: item\.dailyCompletedDates/);
  assert.match(repository, /row\.ai_metadata\?\.dailyCompletedDates/);
  assert.match(widgetData, /isCompletedOnDate\(item,now\)/);
});

test('Per-day completion metadata is persisted without marking Google items pending', () => {
  const repository = read('lib/commitmentsRepository.ts');
  assert.match(repository, /onlyDailyCompletionChanged/);
  assert.match(repository, /commitment-daily-completion-saved/);
  assert.match(repository, /ai_metadata: row\.ai_metadata/);
  assert.match(repository, /if \(onlyDailyCompletionChanged\)/);
});

test('Calendar app and widget show multi-day details on every intersected date', () => {
  const calendar = read('app/(tabs)/calendar.tsx');
  const widget = read('widgets/android/CalendarWidget.tsx');
  assert.match(calendar, /formatItemTime\(item,language\)/);
  assert.match(calendar, /<Text style=\{styles\.itemTitle\}>\{item\.title\}/);
  assert.match(widget, /const showDetails=true/);
});

test('Widget header actions use icons and Today widget completion uses a checkmark', () => {
  const today = read('widgets/android/TodayWidget.tsx');
  const calendar = read('widgets/android/CalendarWidget.tsx');
  assert.match(today, /text="↻"/);
  assert.match(today, /text="🎙"/);
  assert.match(today, /text="✓"/);
  assert.match(calendar, /text="↻"/);
  assert.match(calendar, /text="🎙"/);
  assert.match(calendar, /text="\+"/);
  assert.match(calendar, /text=\{labels\.today\}/);
});

test('List search placeholder is concise and settings category chips wrap', () => {
  const plan = read('app/(tabs)/plan.tsx');
  const settings = read('app/(tabs)/me.tsx');
  assert.match(plan, /placeholder=\{t\('Cerca'\)\}/);
  assert.match(settings, /settingsCategoryRow:\{[^}]*flexWrap:'wrap'/);
  assert.doesNotMatch(settings, /settingsCategoryRow\}>.*ScrollView/);
});

test('Manage exposes Add-style advanced options and renamed postpone action', () => {
  const manage = read('components/ManageSheet.tsx');
  assert.match(manage, /t\('Opzioni avanzate'\)/);
  assert.match(manage, /showAdvancedOptions\s*\?\s*<>/);
  assert.match(manage, /t\('Rimanda di 1 giorno'\)/);
  assert.match(manage, /t\('Elimina da FlowOS e Google'\)/);
});

test('Add tab is lowered and Calendar is placed before Settings', () => {
  const tabs = read('app/(tabs)/_layout.tsx');
  assert.ok(tabs.indexOf('name="calendar"') < tabs.indexOf('name="me"'));
  assert.match(tabs, /marginTop:-3/);
});

test('Android widget action labels use larger touch targets and compact text sizing', () => {
  const today = read('widgets/android/TodayWidget.tsx');
  const calendar = read('widgets/android/CalendarWidget.tsx');
  assert.match(today, /width:30, height:26/);
  assert.match(today, /width:30, height:26/);
  assert.match(calendar, /width: 30, height: 26/);
  assert.match(calendar, /width: 30, height: 26/);
});

test('Settings search and appearance summary include the selected app text size', () => {
  const source = read('app/(tabs)/me.tsx');
  const translations = read('lib/i18n.ts');
  assert.match(source, /dimensione caratteri font size testo/);
  assert.match(source, /t\('Dimensione caratteri attiva'\)/);
  assert.match(source, /appFontSize==='small'/);
  assert.match(translations, /'Dimensione caratteri attiva':'Active text size'/);
});

test('App appearance includes a persisted small, standard and large text-size preference', () => {
  const appearance = read('lib/widgetAppearance.ts');
  const ui = read('components/ui.tsx');
  const settings = read('app/(tabs)/me.tsx');
  assert.match(appearance, /appFontSize: 'standard'/);
  assert.match(appearance, /parsed\.appFontSize/);
  assert.match(ui, /getTypeScale/);
  assert.match(ui, /setAppFontSize/);
  assert.match(settings, /Dimensione caratteri/);
  assert.match(settings, /appFontSize===option\.id/);
});

test('Widget personalization opens in a dedicated full-screen editor', () => {
  const settings = read('app/(tabs)/me.tsx');
  assert.match(settings, /Modal visible=\{widgetPersonalizationOpen\}/);
  assert.match(settings, /ScreenShell title=\{t\('Personalizzazione widget'\)\}/);
  assert.match(settings, /Apri personalizzazione widget/);
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

test('Today completion combines a subtle layout transition without vibration', () => {
  const source = read('app/(tabs)/today.tsx');
  assert.match(source, /LayoutAnimation\.configureNext\(LayoutAnimation\.Presets\.easeInEaseOut\)/);
  assert.doesNotMatch(source, /Haptics|Vibration|vibrate/);
});

test('List day separators emphasize weekday and identify Today distinctly', () => {
  const source = read('app/(tabs)/plan.tsx');
  assert.match(source, /groupWeekday/);
  assert.match(source, /todayGroupBadge:[^}]*marginRight:13/);
  assert.match(source, /todayGroupBadge/);
});

test('Primary activity cards and quick actions expose accessible labels', () => {
  const today = read('app/(tabs)/today.tsx');
  const plan = read('app/(tabs)/plan.tsx');
  const calendar = read('app/(tabs)/calendar.tsx');
  assert.match(today, /accessibilityLabel=\{`\$\{t\('Gestisci'\)\}: \$\{item\.title\}`\}/);
  assert.match(today, /accessibilityLabel=\{`\$\{t\('Completa'\)\}: \$\{item\.title\}`\}/);
  assert.match(plan, /accessibilityLabel=\{`\$\{t\('Gestisci'\)\}: \$\{item\.title\}`\}/);
  assert.match(calendar, /accessibilityLabel=\{`\$\{t\('Gestisci'\)\}: \$\{item\.title\}`\}/);
  assert.doesNotMatch(today+plan+calendar, /allowFontScaling=\{false\}/);
});

test('Undo is available for completion, postponement and local deletion', () => {
  const store = read('lib/store.ts');
  assert.match(store, /showSnackbar\(t\('Attività completata'\),t\('Annulla'/);
  assert.match(store, /showSnackbar\(t\('Attività rimandata di 1 giorno'\),t\('Annulla'/);
  assert.match(store, /showSnackbar\(t\('Attività eliminata da FlowOS'\),t\('Annulla'/);
});

test('Recurring completion asks for scope while ordinary completion stays immediate', () => {
  const source = read('lib/completePrompt.ts');
  assert.match(source, /if\s*\(!recurring\)/);
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

test('Calendar provides week jumps and a native in-app month/date selector', () => {
  const source = read('app/(tabs)/calendar.tsx');
  assert.match(source, /moveSelectedDay\(-7\)/);
  assert.match(source, /moveSelectedDay\(7\)/);
  assert.match(source, /setShowDatePicker\(true\)/);
  assert.match(source, /<Modal visible=\{showDatePicker\}/);
  assert.match(source, /datePickerDaySelected/);
  assert.match(source, /setSelectedDateOverride\(key\)/);
  assert.match(source, /onTouchStart:handleCalendarTouchStart/);
  assert.match(source, /onTouchEnd:handleCalendarTouchEnd/);
  assert.match(source, /Math\.abs\(deltaX\)>65/);
  assert.match(source, /moveSelectedDay\(deltaX<0\?7:-7\)/);
});

test('Calendar month picker uses the same Monday-first week convention as the app', () => {
  const source = read('app/(tabs)/calendar.tsx');
  assert.match(source, /\['L','M','M','G','V','S','D'\]/);
  assert.match(source, /\(new Date\(pickerMonth\.getFullYear\(\),pickerMonth\.getMonth\(\),1\)\.getDay\(\)\+6\)%7/);
});

test('Multi-day events render as continuous segments in both the app and Android calendar widget', () => {
  const data = read('lib/calendarWidgetData.ts');
  const widget = read('widgets/android/CalendarWidget.tsx');
  const calendar = read('app/(tabs)/calendar.tsx');
  assert.match(data, /multiDaySegment:multiDaySegment\(item,day\)/);
  assert.match(widget, /multiDaySegment==='middle'/);
  assert.match(widget, /const showDetails=true/);
  assert.match(calendar, /segment==='middle'&&styles\.multiDayMiddle/);
});

test('Primary navigation uses a consistent outline icon family', () => {
  const source = read('app/(tabs)/_layout.tsx');
  assert.match(source, /name="sparkles-outline"/);
  assert.match(source, /name="document-text-outline"/);
  assert.match(source, /name="calendar-outline"/);
  assert.match(source, /name="person-outline"/);
});

test('The Add tab is visually distinct from navigation destinations', () => {
  const source = read('app/(tabs)/_layout.tsx');
  assert.match(source, /addTabIcon/);
  assert.match(source, /tabBarItemStyle:\{marginTop:0\}/);
});

test('Semantic colors and spacing tokens stay consistent across light and dark themes', () => {
  const ui = read('components/ui.tsx');
  const settings = read('app/(tabs)/me.tsx');
  assert.match(ui, /info:Platform\.OS==='ios'\?DynamicColorIOS/);
  assert.match(ui, /success:Platform\.OS==='ios'\?DynamicColorIOS/);
  assert.match(ui, /warning:Platform\.OS==='ios'\?DynamicColorIOS/);
  assert.match(ui, /danger:Platform\.OS==='ios'\?DynamicColorIOS/);
  assert.match(ui, /cardRadius:16, buttonRadius:12, sectionGap:18, cardPadding:14/);
  assert.match(settings, /palette\.info/);
  assert.doesNotMatch(settings, /#4254C5/);
  assert.doesNotMatch(settings, /#4254C5/);
});

test('List filters open in a compact bottom sheet and expose active count, reset and apply actions', () => {
  const source = read('app/(tabs)/plan.tsx');
  assert.match(source, /<Modal visible=\{filtersExpanded\} transparent animationType="slide"/);
  assert.match(source, /filterModalRoot/);
  assert.match(source, /filterBackdrop/);
  assert.match(source, /Azzera filtri/);
  assert.match(source, /Mostra risultati/);
  assert.match(source, /Object\.values\(filters\)\.filter/);
});

test('Secondary settings screens follow the user-selected shared typography scale', () => {
  const notifications = read('app/notifications-settings.tsx');
  const account = read('app/delete-account.tsx');
  for (const source of [notifications, account]) {
    assert.match(source, /useAppDensity\(\)/);
    assert.match(source, /getTypeScale\(appFontSize\)/);
  }
  assert.match(notifications, /fontSize:textScale\.screenTitle/);
  assert.match(account, /fontSize:textScale\.screenTitle/);
  assert.match(account, /fontSize:textScale\.body/);
});

test('Typography follows the shared hierarchy without oversized extra-bold account screens', () => {
  const ui = read('components/ui.tsx');
  const notifications = read('app/notifications-settings.tsx');
  const account = read('app/delete-account.tsx');
  assert.match(ui, /export const typeScale = \{ screenTitle:26, sectionTitle:18, cardTitle:16, body:14, metadata:12, label:12 \}/);
  assert.match(ui, /export function getTypeScale\(size:AppFontSize='standard'\)/);
  assert.match(ui, /screenTitle:Math\.round\(typeScale\.screenTitle\*factor\)/);
  assert.match(notifications, /fontSize:textScale\.screenTitle/);
  assert.match(account, /fontSize:textScale\.screenTitle/);
});

test('Quick Create puts the title first and keeps optional characteristics inside advanced details', () => {
  const source = read('app/(tabs)/capture.tsx');
  const title = source.indexOf("title={t('1. Titolo')}");
  const type = source.indexOf("title={t('2. Tipo')}");
  const destination = source.indexOf("title={t('3. Destinazione Google')}");
  const dateTime = source.indexOf("title={t('4. Data e ora')}");
  assert.ok(title >= 0 && title < type && type < destination && destination < dateTime);
  const advanced = source.indexOf('{showAdvancedOptions ? <>');
  const characteristics = source.indexOf("t('Caratteristiche')");
  assert.ok(characteristics > advanced);
  assert.match(source, /<Field autoFocus/);
});

test('Widget density labels clearly communicate compact, standard and detailed layouts', () => {
  const settings = read('app/(tabs)/me.tsx');
  const translations = read('lib/i18n.ts');
  assert.match(settings, /id:'compact',label:'Compatta'/);
  assert.match(settings, /id:'balanced',label:'Standard'/);
  assert.match(settings, /id:'comfortable',label:'Dettagliata'/);
  for (const language of ['it','en','fr','es']) assert.match(translations, new RegExp('translations\\.'+language));
});

test('Manage form typography follows the global text-size preference', () => {
  const source = read('components/ManageSheet.tsx');
  assert.match(source, /useAppDensity\(\)/);
  assert.match(source, /getTypeScale\(appFontSize\)/);
  assert.match(source, /fontSize:textScale\.screenTitle/);
  assert.match(source, /fontSize:textScale\.body/);
});

test('Create and Manage keep date, time, duration and all-day controls coherent', () => {
  const capture = read('app/(tabs)/capture.tsx');
  const manage = read('components/ManageSheet.tsx');
  for (const label of ["Giornata intera","Data di inizio","Orario di inizio","Data di fine","Orario di fine","Durata"]) {
    assert.ok(capture.includes(label) || manage.includes(label), label);
  }
  assert.match(capture, /setEndFromDuration/);
  assert.match(manage, /setEndFromDuration/);
});

test('Manage separates Save from completion and reserves confirmations for destructive or series-wide actions', () => {
  const manage = read('components/ManageSheet.tsx');
  const completion = read('lib/completePrompt.ts');
  assert.match(manage, /stickyFooter/);
  assert.match(manage, /Salva modifiche/);
  assert.match(manage, /Eliminare definitivamente/);
  assert.match(completion, /if\s*\(!recurring\)/);
  assert.match(completion, /Alert\.alert/);
});

test('List and Calendar restore their selected scroll position after managing an item', () => {
  const plan = read('app/(tabs)/plan.tsx');
  const calendar = read('app/(tabs)/calendar.tsx');
  assert.match(plan, /scrollRef/);
  assert.match(plan, /scrollToToday/);
  assert.match(calendar, /scrollRef/);
  assert.match(calendar, /scrollToSelectedWeek/);
});

test('Notification permission status refreshes when the app returns from device settings', () => {
  const source = read('app/(tabs)/me.tsx');
  assert.match(source, /AppState\.addEventListener\('change'/);
  assert.match(source, /state==='active'/);
  assert.match(source, /Notifications\.getPermissionsAsync/);
  assert.match(source, /notificationPermissionStatus==='granted'/);
});

test('shared design tokens preserve minimum button touch target', () => {
  const source = read('components/ui.tsx');
  assert.match(source, /layoutTokens/);
  assert.match(source, /minHeight:48/);
  assert.match(source, /typeScale/);
});


test('Multi-day completion handles both scheduled events and due-date tasks without global completion', () => {
  const store = read('lib/store.ts');
  assert.match(store, /isMultiDayActivity\(item\)/);
  assert.match(store, /activityOccursOnDate\(item,now\)/);
  assert.match(store, /dailyCompletedDates:\[\.\.\.\(item\.dailyCompletedDates\?\?\[\]\),dayKey\]/);
});

test('Android notification channels explicitly disable vibration and use fresh silent channel IDs',()=>{
  const reminders=read('lib/reminderEngine.ts');
  const summaries=read('lib/notificationService.ts');
  assert.match(reminders,/flowos-event-reminders-silent-v2/);
  assert.match(reminders,/flowos-due-soon-silent-v2/);
  assert.match(reminders,/flowos-overdue-silent-v2/);
  assert.equal((reminders.match(/enableVibrate: false/g)||[]).length,3);
  assert.match(summaries,/flowos-daily-summary-silent-v2/);
  assert.match(summaries,/enableVibrate: false/);
});
