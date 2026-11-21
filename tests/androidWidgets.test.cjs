const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');

test('Android Today widget always sizes root and list to the real launcher bounds',()=>{
  const source=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  const handler=fs.readFileSync('widget-task-handler.tsx','utf8');
  assert.match(source,/width:'match_parent', height:'match_parent', padding:10/);
  assert.match(source,/<ListWidget style=\{\{ width:'match_parent', height:'match_parent'/);
  assert.match(source,/height:34, flexDirection:'row'/);
  assert.doesNotMatch(source,/listHeight\(/);
  assert.doesNotMatch(source,/heightDp/);
  assert.doesNotMatch(handler,/TodayWidget[^>]*heightDp=/);
});

test('Android Today widget completes an activity directly without opening the app',()=>{
  const widget=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  const handler=fs.readFileSync('widget-task-handler.tsx','utf8');
  assert.match(widget,/clickAction="COMPLETE" clickActionData=\{\{ id:item\.id \}\}/);
  assert.doesNotMatch(widget,/uri\('complete',item\.id\)/);
  assert.match(handler,/props\.clickAction==='COMPLETE'/);
  assert.match(handler,/runWidgetComplete\(id\)/);
});

test('Android Today widget task cards fill the available list width',()=>{
  const source=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  assert.match(source,/width:'match_parent', height:itemHeight\(item,density\)/);
});

test('Android Today widget data is rendered synchronously from local storage',()=>{
  const source=fs.readFileSync('widget-task-handler.tsx','utf8');
  assert.match(source,/function todayData\(raw:string/);
  assert.doesNotMatch(source,/async function todayData/);
});

test('Android Calendar widget reserves title width for task priority when measuring and rendering rows',()=>{
  const source=fs.readFileSync('widgets/android/CalendarWidget.tsx','utf8');
  assert.match(source,/function itemTitleLines\(item: AndroidCalendarItem\)/);
  assert.ok(source.includes('titleLines(item.title, item.priority ? 10 : 12)'));
  assert.match(source,/const lines=itemTitleLines\(item\)\.length/);
  assert.match(source,/const lines = itemTitleLines\(item\)/);
  assert.match(source,/height: itemHeight\(item,density\)/);
});

test('Android Calendar widget always sizes root and list to the real launcher bounds',()=>{
  const source=fs.readFileSync('widgets/android/CalendarWidget.tsx','utf8');
  const handler=fs.readFileSync('widget-task-handler.tsx','utf8');
  assert.match(source,/WEEK_BOTTOM_PADDING = 10/);
  assert.match(source,/weekContainerHeight = height \+ \(week.title \? 14 : 0\) \+ 4 \+ WEEK_BOTTOM_PADDING/);
  assert.match(source,/width: 'match_parent', height: 'match_parent', padding: 8/);
  assert.match(source,/<ListWidget style=\{\{ width: 'match_parent', height: 'match_parent'/);
  assert.match(source,/height: 96/);
  assert.doesNotMatch(source,/listHeight\(/);
  assert.doesNotMatch(source,/heightDp/);
  assert.doesNotMatch(handler,/CalendarWidget[^>]*heightDp=/);
});

test('vertical app scrolling keeps its indicator persistent',()=>{
  const source=fs.readFileSync('components/ui.tsx','utf8');
  assert.match(source,/showsVerticalScrollIndicator persistentScrollbar/);
});

test('login page no longer renders a diagnostics card',()=>{
  const source=fs.readFileSync('app/login.tsx','utf8');
  assert.doesNotMatch(source,/diagnosticsCard|DIAGNOSTICA ACCESSO|subscribeDiagnostics|BuildInfo/);
  assert.match(source,/recordDiagnostic\(/);
});
test('Add defaults to Task',()=>{
  const source=fs.readFileSync('app/(tabs)/capture.tsx','utf8');
  assert.match(source,/useState<CreatableKind>\(params\.kind==='event'\?'event':'task'\)/);
});
test('Settings diagnostics uses a visible light log surface and severity colors',()=>{
  const source=fs.readFileSync('app/(tabs)/me.tsx','utf8');
  assert.match(source,/logBox:\{[^}]*backgroundColor:palette\.card/);
  assert.match(source,/logWarn:\{color:palette.warning\}/);
  assert.match(source,/logError:\{color:palette.danger\}/);
});
test('Today widget reduces the trailing blank space while keeping list rows content-sized',()=>{
  const source=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  assert.match(source,/width:'match_parent',height:20/);
  assert.doesNotMatch(source,/width:'match_parent',height:72/);
});

test('Today widget list rows never use flex for their outer height',()=>{
  const source=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  assert.doesNotMatch(source,/style=\{\{ flex:1, height:itemHeight/);
  assert.match(source,/height:itemHeight\(item,density\)/);
});

test('Android widget controls open the real Add and Voice flows in FlowOS',()=>{
  const today=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  const calendar=fs.readFileSync('widgets/android/CalendarWidget.tsx','utf8');
  const handler=fs.readFileSync('widget-task-handler.tsx','utf8');
  assert.match(today,/clickAction="OPEN_URI" clickActionData=\{\{ uri:'flowos:\/\/capture' \}\}/);
  assert.match(today,/clickAction="OPEN_URI" clickActionData=\{\{ uri:'flowos:\/\/capture\?voice=1' \}\}/);
  assert.match(calendar,/clickAction="OPEN_URI" clickActionData=\{\{ uri:'flowos:\/\/capture' \}\}/);
  assert.match(calendar,/clickAction="OPEN_URI" clickActionData=\{\{ uri:'flowos:\/\/capture\?voice=1' \}\}/);
  assert.doesNotMatch(handler,/QUICK_ADD|VOICE_COMMAND/);
});

test('Widget refresh performs Google sync and refreshes both widgets immediately',()=>{
  const source=fs.readFileSync('widget-task-handler.tsx','utf8');
  assert.match(source,/props\.clickAction==='SYNC_GOOGLE'/);
  assert.match(source,/const refreshed=await refreshFromGoogle\(\)/);
  assert.match(source,/syncTodayWidget\(refreshed,new Date\(\)\)/);
  assert.match(source,/return;/);
});

test('Core macrosection labels and activity-card labels are localized',()=>{
  const i18n=fs.readFileSync('lib/i18n.ts','utf8');
  const capture=fs.readFileSync('app/(tabs)/capture.tsx','utf8');
  const plan=fs.readFileSync('app/(tabs)/plan.tsx','utf8');
  assert.match(i18n,/Language = 'it' \| 'en' \| 'fr' \| 'es'/);
  assert.match(i18n,/extraEn/);
  assert.match(i18n,/extraFr/);
  assert.match(i18n,/extraEs/);
  assert.match(capture,/t\('Ripeti'\)/);
  assert.match(capture,/t\('Tutto il giorno'\)/);
  assert.match(plan,/t\('Tutto il giorno'/);
  assert.match(plan,/t\('Data e ora non definite'/);
  assert.doesNotMatch(plan,/return 'Tutto il giorno'/);
  assert.doesNotMatch(plan,/return 'Data e ora non definite'/);
});

test('Android Calendar widget renders bounded pages without truncating the full cached timeline',()=>{
  const source=fs.readFileSync('widgets/android/CalendarWidget.tsx','utf8');
  const nativePatch=fs.readFileSync('plugins/withCalendarWidgetInitialPosition.js','utf8');
  const handler=fs.readFileSync('widget-task-handler.tsx','utf8');
  assert.match(source,/weeks\.map\(week =>/);
  assert.doesNotMatch(source,/weeks\.slice\(0, 8\)/);
  assert.doesNotMatch(source,/key=\{`\$\{week\.title\}-\$\{week\.days\[0\]\?\.dateKey\}`\} clickAction=/);
  assert.match(source,/day\.items\.reduce\(\(total,item\)=>total\+itemHeight\(item,density\),0\)/);
  assert.match(source,/\{day\.items\.map\(item =>/);
  assert.doesNotMatch(source,/MAX_VISIBLE_ITEMS_PER_DAY|day\.items\.slice\(0,/);
  assert.match(nativePatch,/setScrollPosition/);
  assert.match(nativePatch,/flowosInitialScrollPosition/);
  assert.match(handler,/flowos-calendar-widget-v2/);
  assert.match(handler,/CALENDAR_PAGE_OLDER/);
  assert.match(handler,/CALENDAR_PAGE_NEWER/);
  assert.match(handler,/getCalendarWidgetPage/);
  assert.match(source,/labels\.olderWeeks/);
  assert.match(source,/labels\.newerWeeks/);
  assert.match(source,/CALENDAR_PAGE_TODAY/);
  assert.match(source,/isLoading\?/);
  assert.match(source,/isLoading=false, loadingProgress=0/);
  assert.match(source,/Math\.round\(loadingProgress\)/);
  assert.match(source,/labels\.today/);
  assert.match(source,/width: 30, height: 26, paddingHorizontal: 0, marginRight: 4, borderRadius: 13, backgroundColor: buttonBackgroundColor/);
  assert.match(source,/flex: Math\.max\(1, loadingProgress\)/);
  assert.match(fs.readFileSync('lib/calendarWidgetPaging.ts','utf8'),/CALENDAR_WIDGET_PAGE_SIZE = 8/);
  assert.match(fs.readFileSync('lib/calendarWidgetPaging.ts','utf8'),/CALENDAR_WIDGET_PAGE_OVERLAP = 0/);
  assert.match(handler,/loadingProgress=\{15\}/);
  assert.match(handler,/loadingProgress=\{55\}/);
  assert.match(handler,/loadingProgress=\{90\}/);
  assert.match(handler,/CALENDAR_PAGE_TODAY/);
  assert.match(handler,/isLoading loadingProgress=\{15\} language=\{language\}/);
  assert.match(fs.readFileSync('lib/calendarWidgetPaging.ts','utf8'),/const defaultStart = Math\.max\(0, currentIndex < 0 \? 0 : currentIndex\)/);
});

test('List has persistent chronological, type, period and completion filters while Today stays unfiltered',()=>{
  const plan=fs.readFileSync('app/(tabs)/plan.tsx','utf8');
  const today=fs.readFileSync('app/(tabs)/today.tsx','utf8');
  assert.match(plan,/headerActions=\{<View style=\{styles\.searchRow\}/);
  assert.match(plan,/<TextInput value=\{query\} onChangeText=\{setQuery\}/);
  assert.match(plan,/LIST_FILTERS_KEY/);
  assert.match(plan,/filters\.kind/);
  assert.match(plan,/filters\.period/);
  assert.match(plan,/filters\.status/);
  assert.match(plan,/filters\.order/);
  assert.match(plan,/FilterOption label=\{t\('Cronologico'\)\}/);
  assert.match(plan,/FilterOption label=\{t\('Inverso'\)\}/);
  assert.doesNotMatch(today,/contactsFilter/);
  assert.match(plan,/searchIndex\.filter\(\(\{item,text\}\)/);
  assert.match(today,/commitments\.filter\(item=>isVisibleInToday\(item\)\)/);
});

test('Macrosection headers do not render descriptive subtitles',()=>{
  for(const path of ['app/(tabs)/today.tsx','app/(tabs)/plan.tsx','app/(tabs)/calendar.tsx','app/(tabs)/capture.tsx','app/(tabs)/me.tsx']){
    const source=fs.readFileSync(path,'utf8');
    assert.doesNotMatch(source,/<ScreenShell[^>]*subtitle=/,path);
  }
});


test('All macrosection headers remain outside the scrollable content',()=>{
  const source=fs.readFileSync('components/ui.tsx','utf8');
  assert.match(source,/<View style=\{\[styles\.screenHeader,\{backgroundColor:screenBackground\}\]\}>/);
  assert.match(source,/styles\.screenTitle/);
  assert.match(source,/<ScrollView ref=\{scrollRef\} \{\.\.\.scrollProps\} style=\{\[styles\.screenScroll,\{backgroundColor:screenBackground\}\]\}/);
  assert.match(source,/screenHeader:\{[^}]*backgroundColor:palette\.bg/);
  assert.match(fs.readFileSync('app/(tabs)/plan.tsx','utf8'),/headerActions=\{<View style=\{styles\.searchRow\}/);
});

test('Today tab does not display an activity-count badge',()=>{
  const layout=fs.readFileSync('app/(tabs)/_layout.tsx','utf8');
  assert.doesNotMatch(layout,/tabBarBadge/);
  assert.match(layout,/<Tabs\.Screen name="today"/);
});
test('Calendar app and widget use the same shared timeline range',()=>{
  const app=fs.readFileSync('app/(tabs)/calendar.tsx','utf8');
  const widget=fs.readFileSync('lib/calendarWidgetData.ts','utf8');
  assert.match(app,/buildCalendarTimeline\(commitments,syncEnd,now\)/);
  assert.match(widget,/buildCalendarTimeline\(commitments,syncEndDate,now\)/);
  assert.doesNotMatch(app,/const monday=new Date\(now\.getFullYear\(\),0,1\)/);
});
test('List memoizes calendar labels and empty state refers to search, not removed filters',()=>{
  const plan=fs.readFileSync('app/(tabs)/plan.tsx','utf8');
  assert.match(plan,/const calendarNames=useMemo\(\(\)=>new Map/);
  assert.doesNotMatch(plan,/Modifica i filtri/);
});

test('Today widget shows only start/end times and titles, never type or overdue tags',()=>{
  const widget=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  const handler=fs.readFileSync('widget-task-handler.tsx','utf8');
  const ios=fs.readFileSync('widgets/TodayWidget.tsx','utf8');
  assert.match(widget, /item\.time \? <TextWidget text=\{item\.time\}/);
  assert.doesNotMatch(widget, /\$\{item\.time\} · \$\{item\.kind\}/);
  assert.match(handler, /time:item\.allDay\?'':/);
  assert.match(ios, /item\.time\?\x60\$\{item\.time\} · \x60:''/);
  assert.doesNotMatch(ios, /labels\.event|labels\.task/);
});

test('Today widget title uses full width and wraps naturally without forced line breaks',()=>{
  const widget=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  assert.match(widget,/const maxTitleChars=compact\?/);
  assert.match(widget,/wrapTodayWidgetTitle\(item\.title,maxTitleChars\)\.length/);
  assert.match(widget,/const titleLines=wrapTodayWidgetTitle\(item\.title,maxTitleChars\)/);
  assert.match(widget,/titleLines\.map\(\(line,index\)/);
  assert.doesNotMatch(widget,/<TextWidget text=\{item\.title\}/);

});


test('List and Calendar provide a direct Today navigation shortcut',()=>{
  const plan=fs.readFileSync('app/(tabs)/plan.tsx','utf8');
  const calendar=fs.readFileSync('app/(tabs)/calendar.tsx','utf8');
  assert.ok(plan.includes('todayButton'));
  assert.ok(plan.includes('scrollToToday'));
  assert.ok(calendar.includes('todayButton'));
  assert.ok(calendar.includes('headerActions={<View style={styles.todayRow}'));
  assert.ok(calendar.includes('const goToToday=useCallback(()=>{setSelectedDateOverride(dayKey(new Date()));scrollToSelectedWeek();}'));
  assert.ok(calendar.includes('onPress={goToToday}'));
  assert.ok(plan.includes('headerActions={<View style={styles.searchRow}'));
  assert.ok(plan.includes('pendingTodayScroll.current=true'));
  assert.ok(plan.includes("if(query.trim())setQuery('')"));
  assert.ok(plan.includes('pendingTodayScroll.current&&group.key===todayGroupKey'));
});
test('Manage page and Today macrosection use the shared recurring completion prompt',()=>{
  const manage=fs.readFileSync('components/ManageSheet.tsx','utf8');
  const today=fs.readFileSync('app/(tabs)/today.tsx','utf8');
  assert.match(manage,/requestComplete\(item/);
  assert.match(manage,/t\('Completa'\)/);
  assert.match(today,/requestComplete\(item,complete\)/);
});


test('Google resource names are never replaced with developer-specific aliases',()=>{
  const workspace=fs.readFileSync('lib/googleWorkspace.ts','utf8');
  const ordering=fs.readFileSync('lib/activityOrdering.ts','utf8');
  assert.match(workspace,/friendlyTaskListName\(name:string\)\{return name;\}/);
  assert.doesNotMatch(workspace,/Elenco di Alex Nardi|return 'Alex'/);
  assert.doesNotMatch(ordering,/alex-chiara|\balex\b/i);
});

test('Widget appearance preferences are per FlowOS user and support color opacity',()=>{
  const appearance=fs.readFileSync('lib/widgetAppearance.ts','utf8');
  const settings=fs.readFileSync('app/(tabs)/me.tsx','utf8');
  assert.match(appearance,/supabase\.auth\.getSession\(\)/);
  assert.match(appearance,/STORAGE_PREFIX.*data\.session\?\.user\.id/);
  assert.match(appearance,/colorWithOpacity/);
  assert.match(appearance,/Math\.max\(0, Math\.min\(100/);
  assert.match(settings,/google\?\.calendars\.map/);
  assert.match(settings,/google\?\.taskLists\.map/);
  assert.match(settings,/Ripristina default/);
  assert.match(settings,/resetWidgetAppearance/);
});

test('Both Android widgets apply saved background, text and per-source card colors',()=>{
  const sync=fs.readFileSync('lib/widgetSync.ts','utf8');
  const handler=fs.readFileSync('widget-task-handler.tsx','utf8');
  const today=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  const calendar=fs.readFileSync('widgets/android/CalendarWidget.tsx','utf8');
  assert.match(sync,/getWidgetAppearance/);
  assert.match(sync,/sourceAppearanceColor/);
  assert.match(handler,/sourceAppearanceColor/);
  assert.match(handler,/activitySourceColor\(source,sourceColors\)/);
  assert.match(handler,/activitySourceColor\(source,refreshedSourceColors\)/);
  assert.match(today,/backgroundColor=BG, textColor=INK/);
  assert.match(today,/color:textColor/);
  assert.match(calendar,/backgroundColor=BG, textColor=INK/);
  assert.match(calendar,/color: textColor/);
});

test('Macrosection navigation preloads screens to avoid first-open delays',()=>{
  const layout=fs.readFileSync('app/(tabs)/_layout.tsx','utf8');
  assert.match(layout,/lazy:false/);
  assert.match(layout,/freezeOnBlur:true/);
});

test('Widget customization uses selectable color swatches and includes button colors for both widgets',()=>{
  const settings=fs.readFileSync('app/(tabs)/me.tsx','utf8');
  const appearance=fs.readFileSync('lib/widgetAppearance.ts','utf8');
  const today=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  const calendar=fs.readFileSync('widgets/android/CalendarWidget.tsx','utf8');
  const sync=fs.readFileSync('lib/widgetSync.ts','utf8');
  assert.match(settings,/WIDGET_COLOR_SWATCHES/);
  assert.match(settings,/<ColorSwatches\b(?=[^>]*\bvalue=\{widgetAppearance\[section\]\.backgroundColor\})[^>]*>/);
  assert.doesNotMatch(settings,/TextInput value=\{widgetAppearance\[section\]\.(backgroundColor|textColor)/);
  assert.match(appearance,/buttonBackgroundColor/);
  assert.match(appearance,/buttonTextColor/);
  assert.match(today,/buttonBackgroundColor=PRIMARY, buttonTextColor='#FFFFFF'/);
  assert.match(calendar,/buttonBackgroundColor=PRIMARY, buttonTextColor='#FFFFFF'/);
  assert.match(settings,/Opacità del colore dello sfondo \(%\)/);
  assert.match(settings,/Opacità del colore del testo \(%\)/);
  assert.match(settings,/Opacità dello sfondo dei pulsanti \(%\)/);
  assert.match(settings,/Opacità del testo e dei simboli dei pulsanti \(%\)/);
  assert.match(settings,/Testo e simboli dei pulsanti/);
  assert.match(settings,/const WIDGET_COLOR_SWATCHES=Object\.freeze\(\[\.\.\.new Set\(\[/);
  assert.match(settings,/\.\.\.ACTIVITY_SOURCE_COLORS/);
  assert.match(settings,/ACTIVITY_SOURCE_COLORS, defaultActivitySourceColor/);
  assert.match(settings,/normalizedSwatchColor\(value\)/);
  assert.match(settings,/accessibilityState=\{\{selected:selected===color\}\}/);
  const sourceColors=fs.readFileSync('lib/activityColors.ts','utf8');
  assert.match(sourceColors,/ACTIVITY_SOURCE_COLORS = \['#E8F0FF','#E9F8EF','#FFF0D9','#F3E9FF','#FFE8EE','#E7F6F5','#F1F1E8','#EDEAFF'\]/);
  for(const field of ['textOpacity','buttonBackgroundOpacity','buttonTextOpacity']) assert.match(appearance,new RegExp(field));
  assert.match(sync,/appearance\.today\.textOpacity/);
  assert.match(sync,/appearance\.today\.buttonBackgroundOpacity/);
  assert.match(sync,/appearance\.today\.buttonTextOpacity/);
});
test('Settings languages are alphabetically ordered by visible label',()=>{
  const source=fs.readFileSync('lib/i18n.ts','utf8');
  const order=[...source.match(/export const LANGUAGES:[\s\S]*?\];/)[0].matchAll(/label: '([^']+)'/g)].map(match=>match[1]);
  assert.deepEqual(order,['English','Español','Français','Italiano']);
});

test('multi-day activities are expanded into every intersected day across all app surfaces and widgets',()=>{
  const visibility=fs.readFileSync('lib/commitmentVisibility.ts','utf8');
  const today=fs.readFileSync('app/(tabs)/today.tsx','utf8');
  const list=fs.readFileSync('app/(tabs)/plan.tsx','utf8');
  const calendar=fs.readFileSync('app/(tabs)/calendar.tsx','utf8');
  const calendarWidget=fs.readFileSync('lib/calendarWidgetData.ts','utf8');
  const todayWidgetData=fs.readFileSync('lib/widgetData.ts','utf8');
  const handler=fs.readFileSync('widget-task-handler.tsx','utf8');
  assert.match(visibility,/export function activityDayDates/);
  assert.match(visibility,/if \(isMultiDayActivity\(item\)\) return activityOccursOnDate\(item, now\) && !isCompletedOnDate\(item, now\)/);
  assert.match(todayWidgetData,/isVisibleInToday\(item,now\)/);
  assert.match(visibility,/start\.getTime\(\) < dayEnd\.getTime\(\) && end\.getTime\(\) > dayStart\.getTime\(\)/);
  assert.match(today,/isVisibleInToday\(item\)/);
  assert.match(list,/activityDayDates\(item\)/);
  assert.match(calendar,/activityDayDates\(item\)/);
  assert.match(calendarWidget,/activityDayDates\(item\)/);
  assert.match(todayWidgetData,/isMultiDayActivity\(item\)/);
  assert.match(handler,/isVisibleInToday\(item as Commitment,now\)/);
});


test('widget sync parallelizes independent reads and skips unchanged native widget renders',()=>{
  const source=fs.readFileSync('lib/widgetSync.ts','utf8');
  assert.match(source,/Promise\.all\(\[getLanguage\(\),getWidgetAppearance\(\)\]\)/);
  assert.match(source,/void getGoogleWorkspaceStatus\(\)\.then\(refreshed=>/);
  assert.match(source,/lastTodayWidgetSignature/);
  assert.match(source,/lastCalendarInputSignature/);
  assert.match(source,/cachedCalendarWeeks/);
  assert.match(source,/AsyncStorage\.getItem\('flowos-calendar-widget-v2'\)/);
  assert.match(source,/lastCalendarRenderedSignature/);
  assert.match(source,/}, 50\);/);
});


test('widget visual refresh never waits for a network Google status lookup',()=>{
  const source=fs.readFileSync('lib/widgetSync.ts','utf8');
  const workspace=fs.readFileSync('lib/googleWorkspace.ts','utf8');
  assert.match(workspace,/export function getCachedGoogleWorkspaceStatus\(\)/);
  assert.match(source,/getCachedGoogleWorkspaceStatus\(\)/);
  assert.match(source,/void getGoogleWorkspaceStatus\(\)\.then\(refreshed=>/);
  assert.doesNotMatch(source,/await getGoogleWorkspaceStatus\(/);
});


test('Calendar memoizes sorted day buckets instead of sorting every day during render',()=>{
  const source=fs.readFileSync('app/(tabs)/calendar.tsx','utf8');
  assert.match(source,/const sortedByDay=useMemo\(\(\)=>/);
  assert.match(source,/for\(const \[key,items\] of byDay\)\{const ordered=sortCommitments\(items,calendarNames\);ordered\.sort\(/);
  assert.match(source,/result\.set\(key,ordered\)/);
  assert.match(source,/const items=sortedByDay\.get\(dayKey\(date\)\)\?\?\[\]/);
  assert.doesNotMatch(source,/sortCommitments\(byDay\.get/);
});


test('widget payload caching verifies storage and restores the current calendar page after refresh',()=>{
  const source=fs.readFileSync('lib/widgetSync.ts','utf8');
  assert.match(source,/AsyncStorage\.getItem\('flowos-calendar-widget-v2'\)/);
  assert.match(source,/if\(storedCalendarPayload!==payload\)/);
  assert.match(source,/await AsyncStorage\.setItem\('flowos-calendar-widget-page-v1',String\(page\.startIndex\)\)/);
  assert.doesNotMatch(source,/lastCalendarPageIndex/);
});


test('Android Today widget gives the complete title its own full-width wrapping row',()=>{
  const source=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  assert.match(source,/const titleLines=wrapTodayWidgetTitle\(item\.title,maxTitleChars\)/);
  assert.match(source,/titleLines\.map\(\(line,index\)/);
  assert.doesNotMatch(source,/<TextWidget text=\{item\.title\}/);
  assert.match(source,/flexDirection:'row', alignItems:'center'/);
  assert.match(source,/const maxTitleChars=compact\?/);
  assert.match(source,/wrapTodayWidgetTitle\(item\.title,maxTitleChars\)\.length/);
  assert.doesNotMatch(source,/text=\{item\.title\} style=\{\{ flex:/);
});
test('multi-day completion offers today-only and full-duration choices and persists every completed date',()=>{
  const prompt=fs.readFileSync('lib/completePrompt.ts','utf8');
  const store=fs.readFileSync('lib/store.ts','utf8');
  const today=fs.readFileSync('app/(tabs)/today.tsx','utf8');
  const widget=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  assert.match(prompt,/Solo oggi/);
  assert.match(prompt,/Tutti i giorni/);
  assert.match(prompt,/complete\(item\.id, 'duration'\)/);
  assert.match(store,/activityDayDates\(item\)/);
  assert.match(store,/dailyCompletedDates:Array\.from\(new Set/);
  assert.match(today,/requestComplete\(item,complete\)/);
  const handler=fs.readFileSync('widget-task-handler.tsx','utf8');
  assert.match(widget,/clickAction="COMPLETE" clickActionData=\{\{ id:item\.id \}\}/);
  assert.match(handler,/props\.clickAction==='COMPLETE'/);
  assert.match(handler,/runWidgetComplete\(id\)/);
  assert.match(handler,/dailyCompletedDates:\[\.\.\.\(item\.dailyCompletedDates\?\?\[\]\),dayKey\]/);
});
test('Android Today widget accounts for multiline titles, time and explicit duration while reducing vertical padding',()=>{
  const source=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  assert.match(source,/function itemHeight\(item:AndroidWidgetItem,density:/);
  assert.match(source,/const durationHeight=item\.duration\?10:0/);
  assert.match(source,/paddingVertical:4/);
  assert.match(source,/marginVertical:0/);
  assert.match(source,/text=\{item\.duration\}/);
});
test('Android Calendar widget accounts for the extra task-duration line',()=>{
  const source=fs.readFileSync('widgets/android/CalendarWidget.tsx','utf8');
  assert.match(source,/duration\?: string/);
  assert.match(source,/durationHeight=item\.duration\?\(compact\?6:comfortable\?9:ITEM_DURATION_HEIGHT\):0/);
  assert.match(source,/text=\{item\.duration\}/);
});


test('Android Today widget handler supplies localized explicit task duration',()=>{
  const handler=fs.readFileSync('widget-task-handler.tsx','utf8');
  assert.match(handler,/duration:item\.kind==='task'&&!item\.allDay/);
  assert.match(handler,/formatDurationLabel\(item as Commitment\)/);
  assert.match(handler,/Durée/);
});

test('Android widgets retain default grid size and allow compact resizing',()=>{
  const config=fs.readFileSync('app.config.js','utf8');
  const today=config.split(String.fromCharCode(10)).find(line=>line.includes("name: 'TodayAndroidWidget'"));
  const calendar=config.split(String.fromCharCode(10)).find(line=>line.includes("name: 'CalendarAndroidWidget'"));
  assert.ok(today);
  assert.ok(calendar);
  assert.ok(today.includes("minWidth: '180dp'") && today.includes("minHeight: '110dp'"));
  assert.ok(calendar.includes("minWidth: '180dp'") && calendar.includes("minHeight: '160dp'"));
  assert.ok(today.includes('targetCellWidth: 4') && today.includes('targetCellHeight: 3'));
  assert.ok(calendar.includes('targetCellWidth: 4') && calendar.includes('targetCellHeight: 5'));
  assert.ok(today.includes("resizeMode: 'horizontal|vertical'"));
  assert.ok(calendar.includes("resizeMode: 'horizontal|vertical'"));
});

test('Android Today widget leaves unused space transparent and preserves vertical list scrolling',()=>{
  const source=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  assert.match(source,/backgroundColor:transparentUnusedSpace\?'rgba\(0, 0, 0, 0\)':backgroundColor as any, borderRadius:20/);
  assert.match(source,/backgroundColor:backgroundColor as any, borderRadius:12/);
  assert.match(source,/<ListWidget style=\{\{ width:'match_parent', height:'match_parent', backgroundColor:transparentUnusedSpace\?'rgba\(0, 0, 0, 0\)':backgroundColor as any \}\}>/);
  assert.match(source,/<ListWidget[\s\S]*items\.map/);
  assert.match(source,/height:'match_parent'/);
});


test('Today widget unused-space transparency is configurable and enabled by default',()=>{
  const appearance=fs.readFileSync('lib/widgetAppearance.ts','utf8');
  const widget=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  const sync=fs.readFileSync('lib/widgetSync.ts','utf8');
  const handler=fs.readFileSync('widget-task-handler.tsx','utf8');
  const settings=fs.readFileSync('app/(tabs)/me.tsx','utf8');
  assert.match(appearance,/todayTransparentUnusedSpace: true/);
  assert.match(appearance,/parsed\.todayTransparentUnusedSpace !== false/);
  assert.match(widget,/transparentUnusedSpace=true/);
  assert.match(widget,/backgroundColor:transparentUnusedSpace\?'rgba\(0, 0, 0, 0\)':backgroundColor as any/);
  assert.match(sync,/transparentUnusedSpace:appearance\.todayTransparentUnusedSpace/);
  assert.match(handler,/transparentUnusedSpace=\{appearance\.todayTransparentUnusedSpace\}/);
  assert.match(settings,/Spazio inutilizzato trasparente nel widget Oggi/);
  assert.match(settings,/Switch value=\{widgetAppearance\.todayTransparentUnusedSpace\}/);
});


test('Android Today widget uses an explicit zero-alpha background for unused space',()=>{
  const source=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  assert.match(source,/backgroundColor:transparentUnusedSpace\?'rgba\(0, 0, 0, 0\)':backgroundColor as any/);
  assert.match(source,/<ListWidget style=\{\{ width:'match_parent', height:'match_parent', backgroundColor:transparentUnusedSpace\?'rgba\(0, 0, 0, 0\)':backgroundColor as any \}\}>/);
});

test('Manage exposes the same one-day postpone action as the Today widget in all four languages',()=>{
  const manage=fs.readFileSync('components/ManageSheet.tsx','utf8');
  const i18n=fs.readFileSync('lib/i18n.ts','utf8');
  assert.match(manage,/const postpone = useFlowStore\(\(state\) => state\.postpone\)/);
  assert.match(manage,/await postpone\(item\.id\)/);
  assert.match(manage,/t\('Rimanda di 1 giorno'\)/);
  assert.match(i18n,/'Rimanda di 1 giorno':'Postpone 1 day'/);
  assert.match(i18n,/'Rimanda di 1 giorno':'Reporter d’un jour'/);
  assert.match(i18n,/'Rimanda di 1 giorno':'Posponer 1 día'/);
});

test('Widget color swatches use one consistent light-to-dark palette including all defaults',()=>{
  const settings=fs.readFileSync('app/(tabs)/me.tsx','utf8');
  assert.match(settings,/const WIDGET_COLOR_SWATCHES=Object\.freeze\(\[\.\.\.new Set\(/);
  assert.match(settings,/const WIDGET_COLOR_GRID=Object\.freeze\(Array\.from\(\{length:8\}/);
  assert.match(settings,/Math\.floor\(hueA\/45\)/);
  assert.match(settings,/\.slice\(0,64\)/);
  assert.match(settings,/colorSwatchRows:\{aspectRatio:1/);
  assert.doesNotMatch(settings,/\[\.\.\.WIDGET_COLOR_SWATCHES,normalizedSwatchColor\(value\)\]/);
  for(const color of ['#F1F4FF','#172033','#6658D3','#FFFFFF','#F3F4F7','#F3F4F7']) assert.ok(settings.includes(color));
});

test('Google Play metadata does not advertise an unavailable Focus mode and includes four locales',()=>{
  const metadata=fs.readFileSync('docs/google-play/STORE_METADATA.md','utf8');
  assert.doesNotMatch(metadata,/Focus mode|mode Focus|Modalità Focus|modo Focus/i);
  assert.match(metadata,/### Italian/);
  assert.match(metadata,/### French/);
  assert.match(metadata,/### Spanish/);
  assert.match(metadata,/## Full description/);
});


test('duration preview uses localized hours and minutes rather than total minutes',()=>{
  const source=fs.readFileSync('lib/durationPreview.ts','utf8');
  const {formatDurationPreview}=require('../.test-dist-widget/lib/durationPreview.js');
  assert.match(source,/formatDurationPreview/);
  assert.match(source,/it: \{ day:\['giorno','giorni'\], hour:\['ora','ore'\], minute:\['minuto','minuti'\]/);
  assert.match(source,/fr: \{ day:\['jour','jours'\], hour:\['heure','heures'\], minute:\['minute','minutes'\]/);
  assert.match(source,/es: \{ day:\['día','días'\], hour:\['hora','horas'\], minute:\['minuto','minutos'\]/);
  assert.match(source,/const days=Math\.floor\(total\/1440\), hours=Math\.floor\(\(total%1440\)\/60\), minutes=total%60/);
  assert.equal(formatDurationPreview(150,'it'),'2 ore e 30 minuti');
  assert.equal(formatDurationPreview(150,'en'),'2 hours 30 minutes');
  assert.equal(formatDurationPreview(150,'fr'),'2 heures et 30 minutes');
  assert.equal(formatDurationPreview(150,'es'),'2 horas y 30 minutos');
  assert.equal(formatDurationPreview(60,'it'),'1 ora');
  assert.equal(formatDurationPreview(1440,'fr'),'1 jour');
  const capture=fs.readFileSync('app/(tabs)/capture.tsx','utf8');
  const manage=fs.readFileSync('components/ManageSheet.tsx','utf8');
  assert.match(capture,/allDay\?' · '\+t\('Tutto il giorno'\)/);
  assert.match(manage,/allDay\?' · '\+t\('Tutto il giorno'\)/);
  assert.match(capture,/formatDurationPreview\(durationMinutes,language\)/);
  assert.match(manage,/formatDurationPreview\(previewDurationMinutes,language\)/);
});

test('Focus feature is completely removed from app routing, store and public copy',()=>{
  assert.equal(fs.existsSync('app/focus.tsx'),false);
  const store=fs.readFileSync('lib/store.ts','utf8');
  assert.doesNotMatch(store,/focusId|startFocus|stopFocus/);
  const readme=fs.readFileSync('README.md','utf8');
  const roadmap=fs.readFileSync('docs/ROADMAP.md','utf8');
  const site=fs.readFileSync('public/about/index.html','utf8');
  assert.doesNotMatch(readme,/Focus mode|\*\*Focus\*\*/i);
  assert.doesNotMatch(roadmap,/Focus/i);
  assert.doesNotMatch(site,/Focus mode|Focus on the next step/i);
});


test('List initializes on Today once and preserves filters and scroll context on later focus',()=>{
  const source=fs.readFileSync('app/(tabs)/plan.tsx','utf8');
  assert.match(source,/if\(!hasPlanFocused\.current\)\{hasPlanFocused\.current=true;didInitialScroll\.current=false;scrollToToday\(\);\}/);
  assert.match(source,/pendingTodayScroll\.current=true/);
  assert.match(source,/if\(filters\.period!=='all'\)setFilter\('period','all'\)/);
});

test('Calendar initializes on Today once and preserves the selected day on later focus',()=>{
  const source=fs.readFileSync('app/(tabs)/calendar.tsx','utf8');
  assert.match(source,/if\(!hasCalendarFocused\.current\)\{if\(!requestedDate\)setSelectedDateOverride\(dayKey\(new Date\(\)\)\);hasCalendarFocused\.current=true;\}/);
  assert.match(source,/requestAnimationFrame\(\(\)=>scrollToSelectedWeek\(\)\)/);
  assert.match(source,/const selectedDateKey=selectedDateOverride\?\?requestedDate\?\?dayKey\(new Date\(\)\)/);
});

test('Android Calendar widget highlights today with the same color as its action buttons',()=>{
  const source=fs.readFileSync('widgets/android/CalendarWidget.tsx','utf8');
  assert.match(source,/borderWidth: day\.isToday \? 2 : 1/);
  assert.match(source,/borderColor: day\.isToday \? buttonBackgroundColor as any : borderColor as any/);
  assert.match(source,/backgroundColor: day\.isToday \? todaySurfaceColor as any : surfaceColor as any/);
});


test('Android Today widget renders no empty-state message when there are no activities in every language',()=>{
  const source=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  assert.equal(source.includes('labels.noActivities'),false);
  assert.doesNotMatch(source,/Nessuna attività prevista per oggi|No activities planned for today|Aucune activité prévue pour aujourd'hui|No hay actividades previstas para hoy/i);
  assert.equal(source.includes('items.map((item)=>{'),true);
});

test('multi-day completion from the Android widget is occurrence-scoped and does not globally complete or push the series',()=>{
  const handler=fs.readFileSync('widget-task-handler.tsx','utf8');
  const start=handler.indexOf('async function runWidgetComplete');
  const end=handler.indexOf('async function runWidgetPostpone',start);
  const complete=handler.slice(start,end);
  assert.match(complete,/if\(isMultiDayActivity\(item\)\)/);
  assert.match(complete,/activityOccursOnDate\(item,now\)/);
  assert.match(complete,/dailyCompletedDates:\[\.\.\.\(item\.dailyCompletedDates\?\?\[\]\),dayKey\]/);
  assert.match(complete,/await saveCommitment\(updated\)/);
  assert.doesNotMatch(complete.slice(0,complete.indexOf("const updated={...item,status:'done'")),/status:'done'/);
  assert.match(complete,/await pushPendingToGoogle\(\)/);
});


test('Today widget uses fixed vertical card padding and only title wrapping changes card height',()=>{
  const source=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  assert.match(source,/paddingVertical:4/);
  assert.match(source,/const maxTitleChars=compact\? \(item\.priority\?30:33\) : comfortable\? \(item\.priority\?23:26\) : \(item\.priority\?25:28\)/);
  assert.match(source,/wrapTodayWidgetTitle\(item\.title,maxTitleChars\)\.length/);
  assert.match(source,/const timeHeight=item\.time\?10:0/);
  assert.match(source,/const durationHeight=item\.duration\?10:0/);
  assert.doesNotMatch(source,/paddingVertical:density===/);
  assert.doesNotMatch(source,/item\.duration\?\(compact\?/);
});

test('Widget color palette is a fixed 8 by 8 grid ordered by hue family and shade',()=>{
  const settings=fs.readFileSync('app/(tabs)/me.tsx','utf8');
  assert.match(settings,/const WIDGET_COLOR_SORTED=Object\.freeze\(\[\.\.\.WIDGET_COLOR_SWATCHES,[\s\S]*?Math\.floor\(hueA\/45\)/);
  assert.match(settings,/\.slice\(0,64\)/);
  assert.match(settings,/Array\.from\(\{length:8\},\(_,row\)=>WIDGET_COLOR_SORTED\.slice\(row\*8,row\*8\+8\)\)/);
  assert.match(settings,/colorSwatchRows:\{aspectRatio:1/);
});


test('A daily completion hides that multi-day occurrence from both Today surfaces',()=>{
  const visibility=fs.readFileSync('lib/commitmentVisibility.ts','utf8');
  const widgetData=fs.readFileSync('lib/widgetData.ts','utf8');
  const today=fs.readFileSync('app/(tabs)/today.tsx','utf8');
  assert.match(visibility,/if \(isMultiDayActivity\(item\) && isCompletedOnDate\(item, now\)\) return false/);
  assert.match(visibility,/if \(isCompletedOnDate\(item, date\)\) return false/);
  assert.match(widgetData,/isVisibleInToday\(item,now\)/);
  assert.match(today,/commitments\.filter\(item=>isVisibleInToday\(item\)\)/);
});


test('Today tab does not display a red activity-count badge',()=>{
  const layout=fs.readFileSync('app/(tabs)/_layout.tsx','utf8');
  assert.doesNotMatch(layout,/tabBarBadge/);
  assert.match(layout,/<Tabs\.Screen name="today"/);
});

test('Widget opacity inputs stay within the settings card beside wrapping labels',()=>{
  const settings=fs.readFileSync('app/(tabs)/me.tsx','utf8');
  assert.match(settings,/style=\{\[styles\.meta,styles\.opacityLabel\]\}/);
  assert.match(settings,/opacityField:\{width:'100%',minWidth:0,flexDirection:'row',alignItems:'center',gap:8\}/);
  assert.match(settings,/opacityLabel:\{flex:1,minWidth:0,flexShrink:1\}/);
  assert.match(settings,/opacityInput:\{width:64,minWidth:64,maxWidth:64,flexShrink:0,textAlign:'center'\}/);
  assert.match(settings,/Opacità del testo e dei simboli dei pulsanti/);
});


test('Today macrosection has no Add action in the header or empty state',()=>{
  const source=fs.readFileSync('app/(tabs)/today.tsx','utf8');
  assert.doesNotMatch(source,/QuickAddMenu|headerActions=/);
  assert.match(source,/<EmptyState[^>]*\/>/);
  assert.doesNotMatch(source,/actionLabel=|onAction=/);
});


test('Android Today widget does not overestimate the line count of a medium-length task title',()=>{
  const source=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  assert.match(source,/const maxTitleChars=compact\? \(item\.priority\?30:33\) : comfortable\? \(item\.priority\?23:26\) : \(item\.priority\?25:28\)/);
  assert.match(source,/wrapTodayWidgetTitle\(item\.title,maxTitleChars\)\.length/);
  assert.match(source,/paddingVertical:4/);
});

test('Android Today widget renders exactly the title lines used by its height calculation',()=>{
  const widget=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  const helper=fs.readFileSync('lib/todayWidgetLayout.ts','utf8');
  assert.match(widget,/const titleLineCount=wrapTodayWidgetTitle\(item\.title,maxTitleChars\)\.length/);
  assert.match(widget,/const titleLines=wrapTodayWidgetTitle\(item\.title,maxTitleChars\)/);
  assert.match(widget,/titleLines\.map\(\(line,index\)/);
  assert.match(widget,/paddingVertical:4/);
  assert.match(helper,/index \+= maxChars/);
});

test('Android Today widget title wrapping handles Jules Labège and very long titles without phantom blank height',()=>{
  const { wrapTodayWidgetTitle }=require('../.test-dist-widget/lib/todayWidgetLayout.js');
  const title='Jules Labège - Préparation du dossier technique et suivi des prochaines étapes avec les équipes';
  const lines=wrapTodayWidgetTitle(title,28);
  assert.ok(lines.length>1);
  assert.equal(lines.join(' '),title);
  assert.ok(lines.every(line=>line.length<=28));
  const veryLong='Jules Labège '+('Développement'.repeat(12));
  const longLines=wrapTodayWidgetTitle(veryLong,25);
  assert.equal(longLines.join('').replace(/\s+/g,''),veryLong.replace(/\s+/g,''));
  assert.ok(longLines.every(line=>line.length<=25));
  assert.equal(wrapTodayWidgetTitle('   ',28).length,1);
});
