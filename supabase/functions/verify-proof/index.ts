// Supabase Edge Function (Deno): does this photo show that the task was really done?
// Same providers as plan-day (GROQ_API_KEY or ANTHROPIC_API_KEY). Groq needs a vision model:
// GROQ_VISION_MODEL (default meta-llama/llama-4-scout-17b-16e-instruct).
// The photo is only used for this check: it is not stored.

const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-5-5';
const GROQ_VISION_MODEL = Deno.env.get('GROQ_VISION_MODEL') ?? 'meta-llama/llama-4-scout-17b-16e-instruct';

const SYSTEM = `Eres el verificador de GetGo. La persona dice que ha hecho una tarea y manda una foto como prueba.
Decide si la foto muestra de forma razonable que la tarea está hecha. Sé justo pero no ingenuo:
- Vale: la compra sobre la mesa o en bolsas para "hacer la compra"; la persona corriendo, ropa de deporte sudada o el reloj/app con la carrera para "correr"; la cocina limpia para "limpiar la cocina"; una captura del mail enviado para "mandar el mail".
- No vale: una foto que no tiene nada que ver, una pantalla en negro, una foto de internet evidente, algo que solo muestra que la tarea está SIN hacer.
Si dudas pero la foto es coherente con la tarea, acéptala.
"reason": una frase corta, amable, en el idioma indicado, dirigida a la persona (si no vale, di qué foto sí valdría).
Responde SOLO con JSON: {"ok": boolean, "reason": string}`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { image, mediaType, task, hint, lang } = await req.json();
    if (typeof image !== 'string' || !image || typeof task !== 'string') {
      return Response.json({ error: 'image and task are required' }, { status: 400, headers: cors });
    }
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    const groqKey = Deno.env.get('GROQ_API_KEY');
    const choice = Deno.env.get('AI_PROVIDER');
    const provider = choice === 'groq' && groqKey ? 'groq'
      : choice === 'anthropic' && anthropicKey ? 'anthropic'
      : anthropicKey ? 'anthropic' : groqKey ? 'groq' : null;
    if (!provider) return Response.json({ error: 'no AI key set' }, { status: 500, headers: cors });

    const type = typeof mediaType === 'string' ? mediaType : 'image/jpeg';
    const prompt = `Tarea: "${task.slice(0, 200)}". ${hint ? `Prueba esperada: ${String(hint).slice(0, 120)}.` : ''} Idioma: ${lang ?? 'es'}. ¿La foto demuestra que está hecha?`;

    let raw = '{}';
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': anthropicKey!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 200,
          system: SYSTEM,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: type, data: image } },
            { type: 'text', text: prompt },
          ] }],
        }),
      });
      if (!res.ok) return Response.json({ error: 'ai_failed', status: res.status }, { status: 502, headers: cors });
      const data = await res.json();
      raw = data?.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '{}';
    } else {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: GROQ_VISION_MODEL,
          temperature: 0.1,
          max_completion_tokens: 200,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${type};base64,${image}` } },
            ] },
          ],
        }),
      });
      if (!res.ok) {
        console.error('groq error', res.status, await res.text());
        return Response.json({ error: 'ai_failed', status: res.status }, { status: 502, headers: cors });
      }
      const data = await res.json();
      raw = data?.choices?.[0]?.message?.content ?? '{}';
    }
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    return Response.json({ ok: Boolean(json.ok), reason: typeof json.reason === 'string' ? json.reason.slice(0, 200) : '' }, { headers: cors });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'bad_request', detail: String(e).slice(0, 300) }, { status: 400, headers: cors });
  }
});
