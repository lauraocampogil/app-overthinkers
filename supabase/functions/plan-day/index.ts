// Supabase Edge Function (Deno): brain dump text -> structured tasks, using Claude.
// The ORDER of the day is decided in the app (src/lib/planner.ts); the AI only understands the text.
//
// Secrets: ANTHROPIC_API_KEY (required), ANTHROPIC_MODEL (optional).

const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-5-5';
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const SYSTEM = `Eres el motor de una app para personas que piensan demasiado (overthinkers).
Recibes lo que la persona tiene en la cabeza, dicho sin orden. Tu trabajo es SOLO entenderlo y devolver tareas.

Reglas:
- Una tarea por cosa que hay que hacer. Une duplicados. Ignora frases que no son tareas.
- "title": corto, en infinitivo, EN EL MISMO IDIOMA en que escribe la persona, empezando en mayúscula. Máximo 6 palabras.
- "minutes": estimación realista (5-240). Contestar un mensaje ≈ 10, estudiar ≈ 45, gym ≈ 45, cardio ≈ 20.
- "dueInDays": días hasta la fecha límite (0 = hoy). null si no hay fecha.
- "energy": "alta" si exige concentración o esfuerzo físico, si no "baja".
- "kind": "trabajo" | "estudio" | "deporte" | "casa" | "otro".
- "sport": "fuerza" | "cardio" | null. Si dice "gym y cardio", son DOS tareas: una de fuerza y otra de cardio.
- "tired": true si la persona dice que está cansada o sin energía.
Responde SOLO con JSON: {"tasks":[...],"tired":boolean}`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { text, today, weekday, lang } = await req.json();
    if (typeof text !== 'string' || !text.trim()) {
      return Response.json({ error: 'text is required' }, { status: 400, headers: cors });
    }
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500, headers: cors });

    const dayName = typeof weekday === 'number' ? WEEKDAYS[weekday] : '';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: SYSTEM,
        messages: [{ role: 'user', content: `Hoy es ${dayName} ${today ?? ''}. Idioma del móvil: ${lang ?? 'es'}.\n\nLo que tengo en la cabeza:\n${text.slice(0, 4000)}` }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error('anthropic error', res.status, detail);
      return Response.json({ error: 'ai_failed' }, { status: 502, headers: cors });
    }
    const data = await res.json();
    const raw: string = data?.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '{}';
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    return Response.json({ tasks: Array.isArray(json.tasks) ? json.tasks : [], tired: Boolean(json.tired) }, { headers: cors });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'bad_request' }, { status: 400, headers: cors });
  }
});
