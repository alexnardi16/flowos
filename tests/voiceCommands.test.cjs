const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parseVoiceCommands } = require('../.test-dist-voice/lib/voiceParser.js');
const { parseVoiceCommand, findBestVoiceMatch } = require('../.test-dist-voice/lib/voiceParser.js');

test('parses natural add command with date and time', () => {
  const command = parseVoiceCommand('Aggiungi visita pediatra domani alle 15');
  assert.equal(command.type, 'add');
  assert.equal(command.title, 'visita pediatra');
  assert.equal(command.kind, 'task');
  assert.ok(command.when);
});

test('parses complete command and resolves an unambiguous title', () => {
  const command = parseVoiceCommand('Completa comprare il latte');
  assert.deepEqual(command, { type: 'complete', query: 'comprare il latte' });
  const item = findBestVoiceMatch([
    { id: '1', title: 'Comprare il latte', status: 'active' },
    { id: '2', title: 'Comprare il pane', status: 'active' },
  ], command.query);
  assert.equal(item.id, '1');
});

test('parses move command with a relative date and time', () => {
  const command = parseVoiceCommand('Sposta visita pediatra a domani alle 15');
  assert.equal(command.type, 'move');
  assert.equal(command.query, 'visita pediatra');
  assert.ok(command.when);
});

test('does not guess when two activities are equally plausible', () => {
  const item = findBestVoiceMatch([
    { id: '1', title: 'Chiamare Marco', status: 'active' },
    { id: '2', title: 'Chiamare Marta', status: 'active' },
  ], 'chiamare mar');
  assert.equal(item, null);
});

test('never leaves a completed activity eligible for voice commands', () => {
  const item = findBestVoiceMatch([
    { id: '1', title: 'Comprare il latte', status: 'done' },
  ], 'comprare il latte');
  assert.equal(item, null);
});


test('rejects invalid calendar dates and clock times instead of silently rolling them over', () => {
  const invalidDate = parseVoiceCommand('Aggiungi visita il 32 gennaio');
  const invalidTime = parseVoiceCommand('Aggiungi visita domani alle 25:90');
  assert.equal(invalidDate.when, undefined);
  assert.equal(invalidTime.when, undefined);
  assert.equal(invalidDate.title, 'visita');
  assert.equal(invalidTime.title, 'visita');
});

test('does not match deleted activities', () => {
  const item = findBestVoiceMatch([
    { id: '1', title: 'Comprare il latte', status: 'active', deletedAt: '2026-01-01T00:00:00.000Z' },
  ], 'comprare il latte');
  assert.equal(item, null);
});


test('parses multiple spoken commands separated by poi and e poi', () => {
  const commands = parseVoiceCommands('Aggiungi comprare il latte domani e poi completa chiamare Marco');
  assert.equal(commands.length, 2);
  assert.equal(commands[0].type, 'add');
  assert.equal(commands[0].title, 'comprare il latte');
  assert.equal(commands[1].type, 'complete');
  assert.equal(commands[1].query, 'chiamare marco');
});

test('rejects impossible dates and times without silently normalizing them', () => {
  for (const phrase of [
    'Aggiungi visita il 32 gennaio 2027',
    'Aggiungi visita il 29 febbraio 2027',
    'Aggiungi visita domani alle 24:00',
    'Aggiungi visita domani alle 12:60',
  ]) {
    const command = parseVoiceCommand(phrase);
    assert.equal(command.type, 'add', phrase);
    assert.equal(command.when, undefined, phrase);
  }
  const leapDay = parseVoiceCommand('Aggiungi visita il 29 febbraio 2028 alle 23:59');
  assert.ok(leapDay.when);
});

test('does not select the first activity when duplicate titles are exact matches', () => {
  const item = findBestVoiceMatch([
    { id: '1', title: 'Chiamare Marco', status: 'active' },
    { id: '2', title: 'Chiamare Marco', status: 'active' },
  ], 'chiamare marco');
  assert.equal(item, null);
});

test('Android speech recognition requests offline preference and adds no AI speech SDK', () => {
  const source = fs.readFileSync('lib/voiceCommands.ts', 'utf8');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.match(source, /android\.speech\.extra\.PREFER_OFFLINE':true/);
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.equal(Object.keys(dependencies).some(name => /openai|anthropic|gemini|speech-to-text|whisper/i.test(name)), false);
});
