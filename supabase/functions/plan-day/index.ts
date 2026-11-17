// Supabase Edge Function (Deno): brain dump text or screenshot -> structured tasks.
// The ORDER of the day is decided in the app (src/lib/planner.ts); the AI only understands the text.
//
// Two providers, chosen by the secrets you set:
//   - Groq (free tier):  GROQ_API_KEY            [GROQ_MODEL, default qwen/qwen3.8-27b]
//   - Anthropic (paid):  ANTHROPIC_API_KEY       [ANTHROPIC_MODEL, default claude-haiku-5-5]
// If both are set, AI_PROVIDER=groq|anthropic decides (default: anthropic).

const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-5-5';
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') ?? 'qwen/qwen3.8-27b';
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const SYSTEM = `Eres el motor de una app para personas que piensan demasiado (overthinkers).
Recibes lo que la persona tiene en la cabeza, dicho sin orden. Tu trabajo es SOLO entenderlo y devolver tareas.

Reglas:
- Una tarea por cosa que hay que hacer. Une duplicados. Ignora frases que no son tareas.
- "title": corto, en infinitivo, EN EL MISMO IDIOMA en que escribe la persona, empezando en mayúscula. Máximo 6 palabras.
- "minutes": SOLO si la persona dice cuánto dura ("1 hora de gym", "20 min de cardio"), en minutos. Si no lo dice, null. NUNCA estimes ni inventes una duración.
- "dueInDays": días hasta la fecha límite (0 = hoy). null si no hay fecha.
- "energy": "alta" si exige concentración o esfuerzo físico, si no "baja".
- "kind": "trabajo" | "estudio" | "deporte" | "casa" | "otro".
- "importance": 3 si es importante (fecha cercana, trabajo/estudios con consecuencias, algo que otra persona espera), 2 si es normal, 1 si puede esperar.
- "sport": "fuerza" | "cardio" | null. Si dice "gym y cardio", son DOS tareas: una de fuerza y otra de cardio.
- "tired": true si la persona dice que está cansada o sin energía.
Si recibes una CAPTURA de mensajes o mails, extrae solo lo que la persona TIENE QUE HACER (peticiones, citas, fechas); ignora el resto. No inventes nada que no aparezca.
Responde SOLO con JSON: {"tasks":[...],"tired":boolean}`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { text, today, weekday, lang, image, mediaType } = await req.json();
    const hasImage = typeof image === 'string' && image.length > 0;
    if (!hasImage && (typeof text !== 'string' || !text.trim())) {
        return Response.json({ error: 'text or image is required' }, { status: 400, headers: cors });
    }
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    const groqKey = Deno.env.get('GROQ_API_KEY');
    const choice = Deno.env.get('AI_PROVIDER');
    const provider = choice === 'groq' && groqKey ? 'groq'
      : choice === 'anthropic' && anthropicKey ? 'anthropic'
      : anthropicKey ? 'anthropic' : groqKey ? 'groq' : null;
    if (!provider) return Response.json({ error: 'no AI key set (GROQ_API_KEY or ANTHROPIC_API_KEY)' }, { status: 500, headers: cors });

    const dayName = typeof weekday === 'number' ? WEEKDAYS[weekday] : '';
    const intro = `Hoy es ${dayName} ${today ?? ''}. Idioma del móvil: ${lang ?? 'es'}.`;
    const prompt = hasImage
      ? `${intro} Esta es una captura de mis mensajes o mails: ¿qué tengo que hacer? Responde en JSON.`
      : `${intro}\n\nLo que tengo en la cabeza:\n${String(text).slice(0, 4000)}`;
    const type = typeof mediaType === 'string' ? mediaType : 'image/jpeg';

    let raw = '{}';
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': anthropicKey!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 1200,
          system: SYSTEM,
          messages: [{ role: 'user', content: hasImage
            ? [
                { type: 'image', source: { type: 'base64', media_type: type, data: image } },
                { type: 'text', text: prompt },
              ]
            : prompt }],
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        console.error('anthropic error', res.status, detail);
        return Response.json({ error: 'ai_failed', status: res.status, detail: detail.slice(0, 300) }, { status: 502, headers: cors });
      }
      const data = await res.json();
      raw = data?.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '{}';
    } else {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 0.2,
          max_completion_tokens: 1200,
          response_format: { type: 'json_object' },
          // Qwen on Groq: answer directly, no thinking tokens (faster and cheaper on the free quota).
          ...(GROQ_MODEL.startsWith('qwen/') ? { reasoning_effort: 'none', reasoning_format: 'hidden' } : {}),
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: hasImage
              ? [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: `data:${type};base64,${image}` } },
                ]
              : prompt },
          ],
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        console.error('groq error', res.status, detail);
        return Response.json({ error: 'ai_failed', status: res.status, detail: detail.slice(0, 300) }, { status: 502, headers: cors });
      }
      const data = await res.json();
      raw = data?.choices?.[0]?.message?.content ?? '{}';
    }
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    return Response.json({ tasks: Array.isArray(json.tasks) ? json.tasks : [], tired: Boolean(json.tired) }, { headers: cors });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'bad_request', detail: String(e).slice(0, 300) }, { status: 400, headers: cors });
  }
});
