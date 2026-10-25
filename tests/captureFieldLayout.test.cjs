const assert=require('node:assert/strict');
const fs=require('node:fs');

const capture=fs.readFileSync('app/(tabs)/capture.tsx','utf8');
const i18n=fs.readFileSync('lib/i18n.ts','utf8');

const languages={
  it:{startDate:'Data di inizio',startTime:'Orario di inizio',days:'giorni prima',hours:'ore prima',minutes:'minuti prima'},
  en:{startDate:'Start date',startTime:'Start time',days:'days before',hours:'hours before',minutes:'minutes before'},
  fr:{startDate:'Date de début',startTime:'Heure de début',days:'jours avant',hours:'heures avant',minutes:'minutes avant'},
  es:{startDate:'Fecha de inicio',startTime:'Hora de inicio',days:'días antes',hours:'horas antes',minutes:'minutos antes'}
};

test('start date and start time labels are constrained to one line in the Add form',()=>{
  assert.match(capture,/<Text numberOfLines=\{1\} style=\{styles\.fieldLabelFixed\}>\{t\('Data di inizio'\)/);
  assert.match(capture,/<Field fixedLabel singleLineLabel required label=\{t\('Orario di inizio'\)\}/);
  assert.match(capture,/singleLineLabel\?1:undefined/);
});

test('all three custom reminder labels are explicitly split into two lines',()=>{
  for(const key of ['giorni prima','ore prima','minuti prima']){
    assert.ok(capture.includes("t('"+key+"').replace(/\\s+/, '\\n')"),'Missing explicit two-line label for '+key);
  }
  assert.match(capture,/minHeight:26,lineHeight:13/);
});

test('start and reminder field labels have translations for all four FlowOS languages',()=>{
  for(const lang of ['en','fr','es']){
    const expected=languages[lang];
    for(const value of [expected.startDate,expected.startTime,expected.days,expected.hours,expected.minutes]){
      assert.ok(i18n.includes(value),'Missing '+lang+' translation: '+value);
    }
  }
  for(const key of ['giorni prima','ore prima','minuti prima']){
    assert.ok(i18n.includes("'"+key+"'"),'Missing Italian fallback label: '+key);
  }
  assert.match(i18n,/type Language = 'it' \| 'en' \| 'fr' \| 'es'/);
});

test('reminder label translations are single phrase pairs suitable for the same two-line layout',()=>{
  for(const key of ['giorni prima','ore prima','minuti prima']){
    assert.match(i18n,new RegExp('"'+key+'"\\s*:\\s*"(?:days|hours|minutes) before"'));
    assert.match(i18n,new RegExp('"'+key+'"\\s*:\\s*"(?:jours|heures|minutes) avant"'));
    assert.match(i18n,new RegExp('"'+key+'"\\s*:\\s*"(?:días|horas|minutos) antes"'));
  }
});

test('start-time field does not add a second outer margin',()=>{
  assert.match(capture,/<View style=\{styles\.flex\}><Field fixedLabel singleLineLabel required label=\{t\('Orario di inizio'\)\}/);
  assert.doesNotMatch(capture,/<View style=\{\[styles\.flex,styles\.field\]\}><Field fixedLabel singleLineLabel required label=\{t\('Orario di inizio'\)\}/);
});
