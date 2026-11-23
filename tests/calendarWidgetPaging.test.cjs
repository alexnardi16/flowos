const test=require('node:test');const assert=require('node:assert/strict');
const {getCalendarWidgetPage,buildCalendarWidgetPageCache}=require('../.test-dist-widget/lib/calendarWidgetPaging.js');
const weeks=Array.from({length:21},(_,i)=>({title:'Week',days:[{dateKey:`2026-01-${String(i+1).padStart(2,'0')}`,isToday:i===10,items:[]}]}));
test('calendar widget paging uses stable bounded page boundaries and includes the current week',()=>{
  const page=getCalendarWidgetPage(weeks,undefined,new Date('2026-01-11T12:00:00'));
  assert.equal(page.startIndex,8);assert.equal(page.weeks.length,8);
  assert.equal(page.weeks.some(week=>week.days.some(day=>day.isToday)),true);
  assert.equal(page.hasOlderWeeks,true);assert.equal(page.hasNewerWeeks,true);
  assert.equal(getCalendarWidgetPage(weeks,16).weeks.length,5);
});
test('calendar widget cache prebuilds one separately retrievable entry per page',()=>{
  const cache=buildCalendarWidgetPageCache(weeks,'it',new Date('2026-01-11T12:00:00'));
  assert.deepEqual(cache.entries.map(([key])=>key),['flowos-calendar-widget-page-cache-v1:0','flowos-calendar-widget-page-cache-v1:8','flowos-calendar-widget-page-cache-v1:16']);
  const metadata=JSON.parse(cache.metadata);assert.equal(metadata.defaultStartIndex,8);assert.equal(metadata.totalWeeks,21);
  const last=JSON.parse(cache.entries[2][1]);assert.equal(last.weeks.length,5);assert.equal(last.hasOlderWeeks,true);assert.equal(last.hasNewerWeeks,false);
});
