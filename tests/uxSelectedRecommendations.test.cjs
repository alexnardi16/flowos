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
  assert.match(source, /Haptics\.notificationAsync/);
  assert.match(source, /expiredDate/);
  assert.match(source, /numberOfLines=\{2\} style=\{s\.description\}/);
  assert.match(source, /minHeight:44/);
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
});

test('Manage keeps Save in a fixed footer and warns before discarding edits', () => {\n  const source = read('components/ManageSheet.tsx');\n  assert.match(source, /stickyFooter/);\n  assert.match(source, /hasUnsavedChanges/);\n  assert.match(source, /requestClose/);\n  assert.match(source, /REMINDER_PRESETS\.map\(\(offset\).*reminders\.some/);\n});\n\ntest('Create focuses the title for immediate entry', () => {\n  const source = read('app/(tabs)/capture.tsx');\n  assert.match(source, /<Field autoFocus autoGrow/);\n});\n\ntest('shared design tokens preserve minimum button touch target', () => {
  const source = read('components/ui.tsx');
  assert.match(source, /layoutTokens/);
  assert.match(source, /minHeight:48/);
  assert.match(source, /typeScale/);
});
