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
