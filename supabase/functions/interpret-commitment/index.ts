import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const { text } = await request.json();
    if (!text || typeof text !== 'string') throw new Error('Missing text');

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

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
    const commitment = JSON.parse(output);
    return new Response(JSON.stringify(commitment), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 400, headers });
  }
});
