const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');

test('Android Today widget reserves space for the list and cannot collapse to zero height',()=>{
  const source=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  assert.match(source,/height:'match_parent'/);
  assert.match(source,/<ListWidget[^>]*height:listHeight\(heightDp\)/);
  assert.match(source,/height:34, flexDirection:'row'/); assert.match(source,/width:'match_parent', height:'match_parent', padding:10/);
  assert.doesNotMatch(source,/style=\{\{ flex:1, height:itemHeight/);
});

test('Android Today widget data is rendered synchronously from local storage',()=>{
  const source=fs.readFileSync('widget-task-handler.tsx','utf8');
  assert.match(source,/function todayData\(raw:string/);
  assert.doesNotMatch(source,/async function todayData/);
});

test('Android Calendar widget keeps a bottom safety area for the last row',()=>{
  const source=fs.readFileSync('widgets/android/CalendarWidget.tsx','utf8');
  assert.match(source,/WEEK_BOTTOM_PADDING = 10/);
  assert.match(source,/weekContainerHeight = height \+ \(week.title \? 14 : 0\) \+ 4 \+ WEEK_BOTTOM_PADDING/);
  assert.match(source,/height: 96/);
  assert.match(source,/<ListWidget[^>]*height:listHeight\(heightDp\)/);
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
