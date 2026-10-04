const assert=require('node:assert/strict');
const fs=require('node:fs');
const i18n=fs.readFileSync('lib/i18n.ts','utf8');
const me=fs.readFileSync('app/(tabs)/me.tsx','utf8');
const today=fs.readFileSync('app/(tabs)/today.tsx','utf8');
const plan=fs.readFileSync('app/(tabs)/plan.tsx','utf8');
const calendar=fs.readFileSync('app/(tabs)/calendar.tsx','utf8');
const widget=fs.readFileSync('widgets/android/TodayWidget.tsx','utf8');
const calWidget=fs.readFileSync('widgets/android/CalendarWidget.tsx','utf8');
const handler=fs.readFileSync('widget-task-handler.tsx','utf8');

assert.match(i18n,/type Language = 'it' \| 'en' \| 'fr' \| 'es'/);
assert.match(i18n,/let currentLanguage:Language='it'/);
assert.match(i18n,/LANGUAGES/);
assert.match(i18n,/flowos-language-v1/);
assert.doesNotMatch(i18n,/flowos-translate-activities-v1/);
assert.doesNotMatch(me,/Traduci anche le attività/);
assert.doesNotMatch(me,/translateActivities|setTranslateActivities/);
assert.doesNotMatch(today,/useActivityTitleMap/);
assert.doesNotMatch(plan,/useActivityTitleMap/);
assert.doesNotMatch(calendar,/useActivityTitleMap/);
assert.match(calendar,/widgetStrings\(language\)/);
assert.match(widget,/widgetStrings/);
assert.match(calWidget,/height: 'match_parent'/);
assert.doesNotMatch(handler,/getDisplayTitleMap|getTranslateActivities|translateActivities/);

console.log('language regression tests passed');
