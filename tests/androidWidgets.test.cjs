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

test('Android Today widget completion stays in the widget handler without opening FlowOS',()=>{
  const widget=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  const handler=fs.readFileSync('widget-task-handler.tsx','utf8');
  assert.match(widget,/clickAction="COMPLETE" clickActionData=\{\{ id:item\.id \}\}/);
  assert.doesNotMatch(widget,/uri\('complete',item\.id\)/);
  assert.match(handler,/props\.clickAction==='COMPLETE'/);
  assert.match(handler,/runWidgetComplete\(id\)/);
});

test('Android Today widget task cards fill the available list width',()=>{
  const source=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  assert.match(source,/width:'match_parent', height:itemHeight\(item\.title,Boolean\(item\.priority\)\)/);
});

test('Android Today widget data is rendered synchronously from local storage',()=>{
  const source=fs.readFileSync('widget-task-handler.tsx','utf8');
  assert.match(source,/function todayData\(raw:string/);
  assert.doesNotMatch(source,/async function todayData/);
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

test('login diagnostics card is bounded and vertically scrollable',()=>{
  const source=fs.readFileSync('app/login.tsx','utf8');
  assert.match(source,/diagnosticsCard/);
  assert.match(source,/logScroll: \{[^}]*height: 230/);
  assert.match(source,/showsVerticalScrollIndicator persistentScrollbar/);
});
test('Add defaults to Task',()=>{
  const source=fs.readFileSync('app/(tabs)/capture.tsx','utf8');
  assert.match(source,/useState<CreatableKind>\('task'\)/);
});
test('Settings diagnostics uses a visible light log surface and severity colors',()=>{
  const source=fs.readFileSync('app/(tabs)/me.tsx','utf8');
  assert.match(source,/logBox:\{[^}]*backgroundColor:'#F8F9FC'/);
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
  assert.match(source,/height:itemHeight\(item\.title/);
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
  assert.match(source,/flowos:\/\/calendar\?week=/);
  assert.match(source,/day\.items\.reduce\(\(total, item\) => total \+ itemHeight\(item\), 0\)/);
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
  assert.match(source,/paddingHorizontal: 8, marginRight: 4, borderRadius: 13, backgroundColor: PRIMARY/);
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

test('List and Today macrosections have no filters and List search stays sticky',()=>{
  const plan=fs.readFileSync('app/(tabs)/plan.tsx','utf8');
  const today=fs.readFileSync('app/(tabs)/today.tsx','utf8');
  assert.match(plan,/stickyHeaderIndices:\[0\]/);
  assert.match(plan,/<TextInput value=\{query\} onChangeText=\{setQuery\}/);
  assert.doesNotMatch(plan,/Solo contatti|Escludi contatti|Passati e completati|Scaduti aperti|FILTERS_KEY|CONTACTS_FILTER_KEY/);
  assert.doesNotMatch(today,/Solo contatti|Escludi contatti|CONTACTS_FILTER_KEY|contactsFilter/);
  assert.match(plan,/commitments\.filter\(item=>!normalized\|\|searchable\(item\)\.includes\(normalized\)\)/);
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
  assert.match(source,/<View style=\{styles\.screenHeader\}>/);
  assert.match(source,/styles\.screenTitle/);
  assert.match(source,/<ScrollView ref=\{scrollRef\} \{\.\.\.scrollProps\} style=\{styles\.screenScroll\}/);
  assert.match(source,/screenHeader:\{[^}]*backgroundColor:palette\.bg/);
  assert.match(fs.readFileSync('app/(tabs)/plan.tsx','utf8'),/stickyHeaderIndices:\[0\]/);
});

test('Today tab badge uses the same visibility policy as the Today screen',()=>{
  const layout=fs.readFileSync('app/(tabs)/_layout.tsx','utf8');
  const today=fs.readFileSync('app/(tabs)/today.tsx','utf8');
  assert.match(layout,/commitments\.filter\(item=>isVisibleInToday\(item\)\)\.length/);
  assert.match(today,/commitments\.filter\(item=>isVisibleInToday\(item\)\)/);
  assert.doesNotMatch(layout,/function isTodayItem/);
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

test('Today widget title uses more of the first line before wrapping',()=>{
  const widget=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  assert.match(widget, /hasPriority\?36:42/);
  assert.match(widget, /item\.priority\?36:42/);
});


test('List and Calendar provide a direct Today navigation shortcut',()=>{
  const plan=fs.readFileSync('app/(tabs)/plan.tsx','utf8');
  const calendar=fs.readFileSync('app/(tabs)/calendar.tsx','utf8');
  assert.match(plan,/todayButton/);
  assert.match(plan,/scrollToToday/);
  assert.match(calendar,/todayButton/);
  assert.match(calendar,/setSelectedDateOverride\(dayKey\(new Date\(\)\)\)/);
});

test('Manage page and Today macrosection use the shared recurring completion prompt',()=>{
  const manage=fs.readFileSync('components/ManageSheet.tsx','utf8');
  const today=fs.readFileSync('app/(tabs)/today.tsx','utf8');
  assert.match(manage,/requestComplete\(item/);
  assert.match(manage,/t\('Completa'\)/);
  assert.match(today,/requestComplete\(item,complete\)/);
});
