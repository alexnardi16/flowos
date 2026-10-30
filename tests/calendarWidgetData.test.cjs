const test=require('node:test');const assert=require('node:assert/strict');const {buildCalendarWidgetData}=require('../.test-dist-widget/lib/calendarWidgetData.js');const {buildActivitySourceColors,activitySourceColor}=require('../.test-dist-widget/lib/activityColors.js');
test('calendar widget data keeps active items on the correct day',()=>{const now=new Date('2026-09-19T10:00:00');const data=buildCalendarWidgetData([{id:'1',title:'Test',kind:'task',status:'active',durationMinutes:30,energy:'medium',context:'test',confidence:1,dueAt:'2026-09-21T15:00:00'}],new Date('2026-09-30T23:59:59'),now);const day=data.weeks.flatMap(w=>w.days).find(d=>d.dateKey==='2026-09-21');assert.equal(day.items.length,1);assert.equal(day.items[0].title,'Test');});
test('calendar widget data excludes completed and deleted items',()=>{const now=new Date('2026-09-19T10:00:00');const data=buildCalendarWidgetData([{id:'1',title:'Done',kind:'task',status:'done',durationMinutes:30,energy:'medium',context:'test',confidence:1,dueAt:'2026-09-21T15:00:00'},{id:'2',title:'Deleted',kind:'task',status:'active',durationMinutes:30,energy:'medium',context:'test',confidence:1,dueAt:'2026-09-21T16:00:00',deletedAt:'2026-09-19T00:00:00'}],new Date('2026-09-30T23:59:59'),now);assert.equal(data.weeks.flatMap(w=>w.days).reduce((n,d)=>n+d.items.length,0),0);});
test('the week that starts in September and contains October 1 is titled October',()=>{
  const now=new Date('2026-09-28T10:00:00');
  const data=buildCalendarWidgetData([],new Date('2026-10-31T23:59:59'),now);
  const octoberWeek=data.weeks.find(week=>week.days.some(day=>day.dateKey==='2026-10-01'));
  assert.equal(octoberWeek.title,'Ottobre 2026');
  assert.equal(octoberWeek.days.length,7);
});
test('every rendered calendar week has seven complete day slots',()=>{
  const data=buildCalendarWidgetData([],new Date('2026-12-31T23:59:59'),new Date('2026-09-28T10:00:00'));
  for(const week of data.weeks){assert.equal(week.days.length,7);}
});
test('calendar widget uses the same activity colors as the Today widget',()=>{const now=new Date('2026-09-19T10:00:00');const data=buildCalendarWidgetData([{id:'event',title:'Event',kind:'event',status:'active',scheduledAt:'2026-09-21T15:00:00',durationMinutes:30,energy:'medium',context:'test',confidence:1,googleCalendarId:'calendar-a'},{id:'task',title:'Task',kind:'task',status:'active',dueAt:'2026-09-21T16:00:00',durationMinutes:30,energy:'medium',context:'test',confidence:1,googleTaskListId:'tasks-a'}],new Date('2026-09-30T23:59:59'),now);const items=data.weeks.flatMap(w=>w.days).find(d=>d.dateKey==='2026-09-21').items;const colors=buildActivitySourceColors([{id:'event',title:'Event',kind:'event',status:'active',scheduledAt:'2026-09-21T15:00:00',durationMinutes:30,energy:'medium',context:'test',confidence:1,googleCalendarId:'calendar-a'},{id:'task',title:'Task',kind:'task',status:'active',dueAt:'2026-09-21T16:00:00',durationMinutes:30,energy:'medium',context:'test',confidence:1,googleTaskListId:'tasks-a'}]);assert.equal(items.find(item=>item.id==='event').sourceColor,colors.get('calendar:calendar-a'));assert.equal(items.find(item=>item.id==='task').sourceColor,colors.get('task:tasks-a'));});

test('Calendar and Today use the same source color for the same activity source',()=>{const commitments=[{id:'event',title:'Event',kind:'event',status:'active',scheduledAt:'2026-09-21T15:00:00',durationMinutes:30,googleCalendarId:'calendar-a'},{id:'task',title:'Task',kind:'task',status:'active',dueAt:'2026-09-21T16:00:00',durationMinutes:30,googleTaskListId:'tasks-a'}];const data=buildCalendarWidgetData(commitments,new Date('2026-09-30T23:59:59'),new Date('2026-09-19T10:00:00'));const day=data.weeks.flatMap(w=>w.days).find(d=>d.dateKey==='2026-09-21');const colors=buildActivitySourceColors(commitments);assert.equal(day.items.find(item=>item.id==='event').sourceColor,activitySourceColor(commitments[0],colors));assert.equal(day.items.find(item=>item.id==='task').sourceColor,activitySourceColor(commitments[1],colors));});

test('completed multi-day events stay visible on the final day only when completed earlier',()=>{const start='2026-09-20T10:00:00';const early={id:'early',title:'Early done',kind:'event',status:'done',scheduledAt:start,durationMinutes:72*60,completedAt:'2026-09-21T12:00:00',energy:'medium',context:'test',confidence:1};const late={...early,id:'late',title:'Late done',completedAt:'2026-09-23T09:00:00'};const finalDay=new Date('2026-09-23T10:00:00');const beforeFinal=new Date('2026-09-22T10:00:00');const finalData=buildCalendarWidgetData([early,late],new Date('2026-09-30T23:59:59'),finalDay);const finalItems=finalData.weeks.flatMap(w=>w.days).find(d=>d.dateKey==='2026-09-23').items;assert.equal(finalItems.some(item=>item.id==='early'),true);assert.equal(finalItems.some(item=>item.id==='late'),false);const beforeData=buildCalendarWidgetData([early],new Date('2026-09-30T23:59:59'),beforeFinal);const beforeFinalDay=beforeData.weeks.flatMap(w=>w.days).find(d=>d.dateKey==='2026-09-23');assert.equal(beforeFinalDay.items.some(item=>item.id==='early'),true);assert.equal(beforeData.weeks.flatMap(w=>w.days).filter(d=>d.dateKey!=='2026-09-23').some(d=>d.items.some(item=>item.id==='early')),false);});

test('calendar widget timeline includes dated activities before the current year and beyond the sync horizon',()=>{
  const now=new Date('2026-10-20T10:00:00');
  const data=buildCalendarWidgetData([
    {id:'past',title:'Old activity',kind:'task',status:'active',durationMinutes:30,energy:'medium',context:'test',confidence:1,dueAt:'2023-02-10T10:00:00'},
    {id:'future',title:'Far future',kind:'event',status:'scheduled',durationMinutes:60,energy:'medium',context:'test',confidence:1,scheduledAt:'2032-07-14T10:00:00'}
  ],new Date('2027-12-31T23:59:59'),now);
  const days=data.weeks.flatMap(week=>week.days);
  assert.equal(days.find(day=>day.dateKey==='2023-02-10').items.some(item=>item.id==='past'),true);
  assert.equal(days.find(day=>day.dateKey==='2032-07-14').items.some(item=>item.id==='future'),true);
});

test('calendar widget weeks remain chronological around the current week',()=>{
  const now=new Date('2026-10-20T10:00:00');
  const data=buildCalendarWidgetData([],new Date('2027-12-31T23:59:59'),now);
  const current=data.weeks.findIndex(week=>week.days.some(day=>day.isToday));
  assert.ok(current>0);
  assert.ok(current<data.weeks.length-1);
  assert.equal(data.weeks[current-1].days[0].dateKey,'2026-10-12');
  assert.equal(data.weeks[current].days[0].dateKey,'2026-10-19');
  assert.equal(data.weeks[current+1].days[0].dateKey,'2026-10-26');
});

const { buildCalendarTimeline } = require('../.test-dist-widget/lib/calendarTimeline.js');
test('shared calendar timeline includes local activities before current year and beyond Google sync range',()=>{
  const now=new Date('2026-10-20T10:00:00');
  const items=[
    {id:'past',title:'Past',kind:'task',status:'active',durationMinutes:30,energy:'medium',context:'test',confidence:1,dueAt:'2023-02-10T10:00:00'},
    {id:'future',title:'Future',kind:'event',status:'scheduled',durationMinutes:60,energy:'medium',context:'test',confidence:1,scheduledAt:'2032-07-14T10:00:00'},
    {id:'deleted',title:'Deleted',kind:'task',status:'active',durationMinutes:30,energy:'medium',context:'test',confidence:1,dueAt:'2020-01-01T10:00:00',deletedAt:'2025-01-01T00:00:00'}
  ];
  const timeline=buildCalendarTimeline(items,new Date('2027-12-31T23:59:59'),now);
  const keys=timeline.weeks.flatMap(week=>week.map(day=>day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0')));
  assert.ok(keys.includes('2023-02-10'));
  assert.ok(keys.includes('2032-07-14'));
  assert.ok(keys.includes('2026-10-20'));
  assert.ok(!keys.includes('2019-12-30'));
});
test('shared calendar timeline always includes the current week if sync range ends in the past',()=>{
  const now=new Date('2026-10-20T10:00:00');
  const timeline=buildCalendarTimeline([],new Date('2025-01-01T00:00:00'),now);
  assert.ok(timeline.weeks.some(week=>week.some(day=>day.getFullYear()===2026&&day.getMonth()===9&&day.getDate()===20)));
});

test('calendar widget renders every active occurrence in a recurring series on its own date',()=>{
  const now=new Date('2026-10-30T08:00:00');
  const series=[
    {id:'root',title:'Recurring task',kind:'task',status:'active',durationMinutes:30,energy:'medium',context:'test',confidence:1,dueAt:'2026-10-30T09:00:00',recurrenceRule:{frequency:'daily',interval:1,until:'2026-11-01T23:59:59.999Z'}},
    {id:'next-1',title:'Recurring task',kind:'task',status:'active',durationMinutes:30,energy:'medium',context:'test',confidence:1,dueAt:'2026-10-31T09:00:00',recurrenceSeriesId:'root'},
    {id:'next-2',title:'Recurring task',kind:'task',status:'active',durationMinutes:30,energy:'medium',context:'test',confidence:1,dueAt:'2026-11-01T09:00:00',recurrenceSeriesId:'root'}
  ];
  const data=buildCalendarWidgetData(series,new Date('2026-11-05T23:59:59'),now);
  const days=data.weeks.flatMap(week=>week.days);
  for(const date of ['2026-10-30','2026-10-31','2026-11-01'])assert.equal(days.find(day=>day.dateKey===date).items.filter(item=>item.title==='Recurring task').length,1);
});
