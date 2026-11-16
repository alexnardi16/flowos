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

test('Manage keeps Save in a fixed footer and warns before discarding edits', () => {
  const source = read('components/ManageSheet.tsx');
  assert.match(source, /stickyFooter/);
  assert.match(source, /hasUnsavedChanges/);
  assert.match(source, /requestClose/);
  assert.match(source, /REMINDER_PRESETS\.map\(\(offset\).*reminders\.some/);
});

test('Widget themes, densities, live preview, WCAG contrast and category reset are wired', () => {
  const appearance = read('lib/widgetAppearance.ts');
  const settings = read('app/(tabs)/me.tsx');
  const sync = read('lib/widgetSync.ts');
  assert.match(appearance, /applyWidgetTheme/);
  assert.match(appearance, /contrastRatio/);
  assert.match(appearance, /resetWidgetAppearanceCategory/);
  assert.match(settings, /Anteprima in tempo reale/);
  assert.match(settings, /contrastRatio\(/);
  assert.match(sync, /density:appearance\.density/);
});

test('Settings are searchable and grouped by category, with readable sync and diagnostics status', () => {
  const source = read('app/(tabs)/me.tsx');
  assert.match(source, /settingsQuery/);
  assert.match(source, /settingsCategory/);
  assert.match(source, /syncStatusDot/);
  assert.match(source, /diagnosticErrors/);
});

test('Create focuses the title for immediate entry', () => {
  const source = read('app/(tabs)/capture.tsx');
  assert.match(source, /<Field autoFocus autoGrow/);
});

test('Task and event types use consistent vector icons across Today, List, Calendar and Create preview', () => {
  const ui = read('components/ui.tsx');
  const today = read('app/(tabs)/today.tsx');
  const plan = read('app/(tabs)/plan.tsx');
  const calendar = read('app/(tabs)/calendar.tsx');
  const capture = read('app/(tabs)/capture.tsx');
  assert.match(ui, /calendar-outline/);
  assert.match(ui, /checkbox-outline/);
  assert.match(today, /ActivityKindTag/);
  assert.match(plan, /ActivityKindTag/);
  assert.match(calendar, /Ionicons name=\{item\.kind/);
  assert.match(capture, /ActivityKindTag/);
});

test('shared design tokens preserve minimum button touch target', () => {
  const source = read('components/ui.tsx');
  assert.match(source, /layoutTokens/);
  assert.match(source, /minHeight:48/);
  assert.match(source, /typeScale/);
});
