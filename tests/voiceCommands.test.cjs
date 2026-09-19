const test = require('node:test');
const assert = require('node:assert/strict');
const { parseVoiceCommand, findBestVoiceMatch } = require('../.test-dist-voice/lib/voiceCommands.js');

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
