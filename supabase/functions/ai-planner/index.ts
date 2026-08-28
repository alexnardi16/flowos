import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

type Commitment = {
  id: string;
  title: string;
  kind: string;
  status: string;
  durationMinutes: number;
  energy?: string;
  context?: string;
  scheduledAt?: string;
  dueAt?: string;
  fixed?: boolean | null;
  description?: string;
  location?: string;
};

function fallback(commitments: Commitment[]) {
  const open = commitments.filter((item) => item.status !== 'done');
  const overdue = open.filter((item) => item.dueAt && new Date(item.dueAt).getTime() < Date.now());
  const suggestions = [] as Record<string, unknown>[];
  if (overdue.length) suggestions.push({ id: 'ai-overdue', text: `Hai ${overdue.length} attività in ritardo. Conviene recuperare prima quelle brevi o ad alta priorità.`, priority: 'high', action: 'schedule', commitmentIds: overdue.slice(0, 5).map((item) => item.id) });
  const unscheduled = open.filter((item) => !item.scheduledAt && !item.fixed).sort((a, b) => a.durationMinutes - b.durationMinutes);
  if (unscheduled.length) suggestions.push({ id: 'ai-unscheduled', text: `Hai ${unscheduled.length} attività non pianificate. Inserisci prima quelle con scadenza più vicina e durata breve.`, priority: 'medium', action: 'schedule', commitmentIds: unscheduled.slice(0, 5).map((item) => item.id) });
  return suggestions.slice(0, 4);
}

async function askOpenAI(commitments: Commitment[], now: string, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-5-mini',
      store: false,
      input: [
        { role: 'system', content: 'You are FlowOS planning intelligence. Analyze the user\'s open commitments and return concise actionable planning suggestions. Respect fixed events, deadlines, durations, energy, context, and avoid inventing unavailable time slots. Do not change data. Suggestions must be safe recommendations for a human to review.' },
        { role: 'user', content: JSON.stringify({ now, commitments }) },
      ],
      text: { format: { type: 'json_schema', name: 'flowos_planning', strict: true, schema: {
        type: 'object', additionalProperties: false, required: ['suggestions'], properties: {
          suggestions: { type: 'array', maxItems: 5, items: { type: 'object', additionalProperties: false, required: ['id', 'text', 'priority', 'action', 'commitmentIds'], properties: {
            id: { type: 'string' }, text: { type: 'string' }, priority: { type: 'string', enum: ['high', 'medium', 'low'] }, action: { type: 'string', enum: ['schedule', 'reschedule', 'split', 'defer', 'protect'] }, commitmentIds: { type: 'array', items: { type: 'string' } },
          } } },
        },
      } } },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI error ${response.status}`);
  const result = await response.json();
  const output = result.output_text ?? result.output?.flatMap((item: any) => item.content ?? []).find((item: any) => item.type === 'output_text')?.text;
  if (!output) throw new Error('Empty AI output');
  return JSON.parse(output);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const body = await request.json();
    const commitments = Array.isArray(body.commitments) ? body.commitments as Commitment[] : [];
    const now = typeof body.now === 'string' ? body.now : new Date().toISOString();
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return new Response(JSON.stringify({ suggestions: fallback(commitments), generatedBy: 'fallback' }), { headers });
    try {
      const result = await askOpenAI(commitments, now, apiKey);
      return new Response(JSON.stringify({ ...result, generatedBy: 'ai' }), { headers });
    } catch {
      return new Response(JSON.stringify({ suggestions: fallback(commitments), generatedBy: 'fallback' }), { headers });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 400, headers });
  }
});
