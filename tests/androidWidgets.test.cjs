const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');

test('Android Today widget reserves space for the list and cannot collapse to zero height',()=>{
  const source=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
  assert.match(source,/height:'match_parent'/);
  assert.match(source,/<ListWidget[^>]*height:'match_parent'/);
  assert.match(source,/height:34, flexDirection:'row'/);
  assert.doesNotMatch(source,/style=\{\{ flex:1, flexDirection:'row', justifyContent:'space-between'/);
});

test('Android Calendar widget keeps a bottom safety area for the last row',()=>{
  const source=fs.readFileSync('widgets/android/CalendarWidget.tsx','utf8');
  assert.match(source,/WEEK_BOTTOM_PADDING = 10/);
  assert.match(source,/paddingBottom: WEEK_BOTTOM_PADDING/);
  assert.match(source,/height: 64/);
  assert.match(source,/<ListWidget[^>]*height: 'match_parent'/);
});

test('vertical app scrolling keeps its indicator persistent',()=>{
  const source=fs.readFileSync('components/ui.tsx','utf8');
  assert.match(source,/showsVerticalScrollIndicator persistentScrollbar/);
});
