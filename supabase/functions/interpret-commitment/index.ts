import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

type Energy = 'low' | 'medium' | 'high';
type Kind = 'task' | 'event' | 'reminder' | 'routine' | 'idea';

function localInterpret(text: string) {
  const normalized = text.trim();
  const lower = normalized.toLocaleLowerCase('it-IT');
  const durationMatch = lower.match(/(?:per|circa)\s+(\d+)\s*(minuti|min|ore|ora)/);
  const rawDuration = durationMatch ? Number(durationMatch[1]) : 30;
  const durationMinutes = durationMatch?.[2]?.startsWith('or') ? rawDuration * 60 : rawDuration;

  let energy: Energy = 'medium';
  if (/telefon|chiam|comprare|ritirare|pagare|email|messaggio/.test(lower)) energy = 'low';
  if (/strateg|budget|presentaz|scrivere|analizz|progett|studiare|preparare/.test(lower)) energy = 'high';

  let kind: Kind = 'task';
  if (/riunione|appuntamento|visita|call|evento/.test(lower)) kind = 'event';
  else if (/ricordami|promemoria|ricorda/.test(lower)) kind = 'reminder';
  else if (/ogni giorno|ogni settimana|routine|abituale/.test(lower)) kind = 'routine';
  else if (/idea|forse|potrei/.test(lower)) kind = 'idea';

  let scheduledAt: string | null = null;
  const now = new Date();
  const timeMatch = lower.match(/(?:alle|ore)\s*(\d{1,2})(?::(\d{2}))?/);
  const target = new Date(now);
  if (/dopodomani/.test(lower)) target.setDate(target.getDate() + 2);
  else if (/domani/.test(lower)) target.setDate(target.getDate() + 1);

  if (/domani|dopodomani/.test(lower) || timeMatch) {
    if (timeMatch) target.setHours(Number(timeMatch[1]), Number(timeMatch[2] ?? 0), 0, 0);
    else if (/pomeriggio/.test(lower)) target.setHours(15, 0, 0, 0);
    else if (/sera/.test(lower)) target.setHours(19, 0, 0, 0);
    else target.setHours(9, 0, 0, 0);
    scheduledAt = target.toISOString();
  }

  const title = normalized
    .replace(/^(ricordami di|promemoria:?|devo|bisogna)\s+/i, '')
    .replace(/\s+(domani|dopodomani)(\s+(mattina|pomeriggio|sera))?.*$/i, '')
    .replace(/\s+(alle|ore)\s*\d{1,2}(:\d{2})?.*$/i, '')
    .trim();

  return {
    title: title || normalized,
    kind,
    status: scheduledAt ? 'scheduled' : 'active',
    durationMinutes: Math.min(Math.max(durationMinutes, 1), 1440),
    energy,
    context: /telefon|chiam/.test(lower) ? 'Telefono' : /comprare|ritirare/.test(lower) ? 'Commissioni' : 'Generale',
    dueAt: null,
    scheduledAt,
    fixed: kind === 'event' ? true : null,
    outcome: null,
    confidence: scheduledAt || durationMatch ? 0.72 : 0.58,
  };
}

async function openAIInterpret(text: string, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-5-mini',
      store: false,
      input: [
        { role: 'system', content: 'Convert the user intention into one FlowOS commitment. Use ISO-8601 timestamps when a date can be inferred. Be conservative and lower confidence when information is missing.' },
        { role: 'user', content: text },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'flowos_commitment',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['title', 'kind', 'status', 'durationMinutes', 'energy', 'context', 'confidence'],
            properties: {
              title: { type: 'string' },
              kind: { type: 'string', enum: ['task', 'event', 'reminder', 'routine', 'idea'] },
              status: { type: 'string', enum: ['active', 'waiting', 'scheduled', 'blocked', 'someday', 'done'] },
              durationMinutes: { type: 'integer', minimum: 1, maximum: 1440 },
              energy: { type: 'string', enum: ['low', 'medium', 'high'] },
              context: { type: 'string' },
              dueAt: { type: ['string', 'null'] },
              scheduledAt: { type: ['string', 'null'] },
              fixed: { type: ['boolean', 'null'] },
              outcome: { type: ['string', 'null'] },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) throw new Error(`OpenAI error ${response.status}: ${await response.text()}`);
  const result = await response.json();
  const output = result.output_text ?? result.output?.flatMap((item: any) => item.content ?? []).find((item: any) => item.type === 'output_text')?.text;
  if (!output) throw new Error('Empty AI output');
  return JSON.parse(output);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    const { text } = await request.json();
    if (!text || typeof text !== 'string') throw new Error('Missing text');

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify(localInterpret(text)), { headers });
    }

    try {
      const commitment = await openAIInterpret(text, apiKey);
      return new Response(JSON.stringify(commitment), { headers });
    } catch {
      return new Response(JSON.stringify(localInterpret(text)), { headers });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 400, headers });
  }
});
