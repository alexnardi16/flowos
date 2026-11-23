const test=require('node:test');const assert=require('node:assert/strict');
const {getCalendarWidgetPage,buildCalendarWidgetPageCache}=require('../.test-dist-widget/lib/calendarWidgetPaging.js');
const weeks=Array.from({length:21},(_,i)=>({title:'Week',days:[{dateKey:`2026-01-${String(i+1).padStart(2,'0')}`,isToday:i===10,items:[]}]}));
test('calendar widget defaults to the current week followed by the next seven weeks',()=>{
  const page=getCalendarWidgetPage(weeks,undefined,new Date('2026-01-11T12:00:00'));
  assert.equal(page.startIndex,10);assert.equal(page.weeks.length,8);
  assert.equal(page.weeks[0].days[0].isToday,true);
  assert.equal(page.weeks.slice(1).some(week=>week.days.some(day=>day.isToday)),false);
  assert.equal(page.hasOlderWeeks,true);assert.equal(page.hasNewerWeeks,true);
  assert.equal(getCalendarWidgetPage(weeks,18).startIndex,13);assert.equal(getCalendarWidgetPage(weeks,18).weeks.length,8);
});
test('calendar widget page cache stores the current page and navigable older/newer pages',()=>{
  const cache=buildCalendarWidgetPageCache(weeks,'it',new Date('2026-01-11T12:00:00'));
  assert.deepEqual(cache.entries.map(([key])=>key),[
    'flowos-calendar-widget-page-cache-v2:0',
    'flowos-calendar-widget-page-cache-v2:2',
    'flowos-calendar-widget-page-cache-v2:10',
    'flowos-calendar-widget-page-cache-v2:13'
  ]);
  const metadata=JSON.parse(cache.metadata);assert.equal(metadata.pageVersion,2);assert.equal(metadata.defaultStartIndex,10);assert.equal(metadata.totalWeeks,21);assert.deepEqual(metadata.pageStarts,[0,2,10,13]);
  const current=JSON.parse(cache.entries.find(([key])=>key.endsWith(':10'))[1]);
  assert.equal(current.weeks[0].days[0].isToday,true);assert.equal(current.weeks.length,8);
  const last=JSON.parse(cache.entries.find(([key])=>key.endsWith(':13'))[1]);
  assert.equal(last.weeks.length,8);assert.equal(last.hasOlderWeeks,true);assert.equal(last.hasNewerWeeks,false);
});
