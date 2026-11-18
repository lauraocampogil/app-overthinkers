// Supabase Edge Function (Deno): Okio, the mascot, as a calm mentor.
//   mode "read": one short "Today's Read" for the morning, from the day's plan.
//   mode "chat": a short answer to the person, knowing their plan, goals and profile.
// Same providers as plan-day: GROQ_API_KEY (free) or ANTHROPIC_API_KEY; AI_PROVIDER decides when both are set.

const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-5-5';
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') ?? 'qwen/qwen3.8-27b';

const BASE = `Eres Okio, la mascota de una app que ayuda a personas que piensan demasiado (overthinkers) a ordenar su semana y llegar a sus metas.
Hablas como un amigo tranquilo: frases cortas, cálidas y concretas. Nunca sermoneas, nunca usas listas largas ni emojis en exceso (como mucho uno).
Responde SIEMPRE en el idioma indicado. No inventes tareas ni datos que no estén en el CONTEXTO.
Si la persona está agobiada: primero valida en una frase, luego propone UN solo paso pequeño de su plan.
Si pregunta "¿qué hago ahora?": elige una tarea de su plan de hoy (la más importante que siga pendiente) y dile cómo empezar en 2 minutos.
Si habla de algo grave (salud, hacerse daño, crisis), responde con cariño y anímale a hablar con alguien de confianza o un profesional.`;

const READ = `
MODO LECTURA DE HOY: escribe la "Lectura de hoy": 2 frases como máximo (menos de 40 palabras).
Dile cómo pinta su día según el CONTEXTO (cuántas cosas, lo más importante, si hay algo a una hora) y una idea para empezar bien.
Si no tiene nada planeado, invítale a soltar lo que tiene en la cabeza. Sin saludo largo, sin comillas.`;

const CHAT = `
MODO CHAT: responde en 1 a 4 frases. Puedes acabar con una pregunta corta si ayuda a avanzar.`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Msg = { role: 'user' | 'assistant'; content: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { mode, context, lang, messages } = await req.json();
    const read = mode === 'read';
    const history: Msg[] = Array.isArray(messages)
      ? messages
          .filter((m: Msg) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
          .slice(-12)
          .map((m: Msg) => ({ role: m.role, content: m.content.slice(0, 1500) }))
      : [];
    if (!read && !history.length) return Response.json({ error: 'messages required' }, { status: 400, headers: cors });

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    const groqKey = Deno.env.get('GROQ_API_KEY');
    const choice = Deno.env.get('AI_PROVIDER');
    const provider = choice === 'groq' && groqKey ? 'groq'
      : choice === 'anthropic' && anthropicKey ? 'anthropic'
      : anthropicKey ? 'anthropic' : groqKey ? 'groq' : null;
    if (!provider) return Response.json({ error: 'no AI key set' }, { status: 500, headers: cors });

    const system = `${BASE}${read ? READ : CHAT}\nIdioma: ${lang ?? 'es'}.\nCONTEXTO:\n${String(context ?? '').slice(0, 3000)}`;
    const convo: Msg[] = read ? [{ role: 'user', content: 'Mi lectura de hoy, por favor.' }] : history;

    let text = '';
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': anthropicKey!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 400, system, messages: convo }),
      });
      if (!res.ok) {
        const detail = await res.text();
        console.error('anthropic error', res.status, detail);
        return Response.json({ error: 'ai_failed', status: res.status }, { status: 502, headers: cors });
      }
      const data = await res.json();
      text = data?.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '';
    } else {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 0.6,
          max_completion_tokens: 400,
          ...(GROQ_MODEL.startsWith('qwen/') ? { reasoning_effort: 'none', reasoning_format: 'hidden' } : {}),
          messages: [{ role: 'system', content: system }, ...convo],
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        console.error('groq error', res.status, detail);
        return Response.json({ error: 'ai_failed', status: res.status }, { status: 502, headers: cors });
      }
      const data = await res.json();
      text = data?.choices?.[0]?.message?.content ?? '';
    }
    // Some models still leak a <think> block: drop it.
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    return Response.json({ text }, { headers: cors });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'bad_request', detail: String(e).slice(0, 300) }, { status: 400, headers: cors });
  }
});
