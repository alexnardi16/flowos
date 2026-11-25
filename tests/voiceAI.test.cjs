const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {buildVoiceInterpretationPrompt,parseInterpretedVoiceCommands}=require('../.test-dist-voice/lib/voiceAI.js');

test('prompt includes only active titles and excludes private notes and descriptions',()=>{
 const prompt=buildVoiceInterpretationPrompt('Sposta la visita a domani',[{title:'Visita pediatrica',status:'active',notes:'segreto',description:'privato'},{title:'Completata',status:'done'},{title:'Eliminata',status:'active',deletedAt:'2026-01-01'}]);
 assert.match(prompt,/Visita pediatrica/);
 assert.doesNotMatch(prompt,/segreto|privato|Completata|Eliminata/);
});

test('parses multiple commands and requires confirmation for low confidence',()=>{
 const commands=parseInterpretedVoiceCommands(JSON.stringify({commands:[
  {type:'complete',query:'Comprare il latte',confidence:.97,needsConfirmation:false},
  {type:'move',query:'Visita pediatrica',when:'2026-12-01T10:00:00.000Z',confidence:.6,needsConfirmation:false}
 ]}));
 assert.equal(commands.length,2);
 assert.equal(commands[0].needsConfirmation,false);
 assert.equal(commands[1].needsConfirmation,true);
});

test('validates command types, dates, reminders and response size',()=>{
 assert.equal(parseInterpretedVoiceCommands('not json').length,0);
 assert.equal(parseInterpretedVoiceCommands(JSON.stringify({commands:[{type:'delete',query:'x',confidence:1}]}))[0].type,'delete');
 assert.equal(parseInterpretedVoiceCommands(JSON.stringify({commands:[{type:'move',query:'x',when:'not-a-date',confidence:1}]})).length,0);
 assert.equal(parseInterpretedVoiceCommands(JSON.stringify({commands:[{type:'remind',query:'x',minutesBefore:20000,confidence:1}]})).length,0);
 assert.equal(parseInterpretedVoiceCommands(JSON.stringify({commands:Array(9).fill({type:'delete',query:'x',confidence:1})})).length,0);
});

test('voice integration asks consent and falls back to local parser when AI is unavailable',()=>{
 const source=fs.readFileSync('app/(tabs)/capture.tsx','utf8');
 assert.match(source,/hasFlowOSAIAPIKey/);
 assert.match(source,/showConfirm\('FlowOS AI'/);
 assert.match(source,/parseVoiceCommands\(transcript\)/);
 assert.match(source,/interpretVoiceCommandsWithAI/);
});
