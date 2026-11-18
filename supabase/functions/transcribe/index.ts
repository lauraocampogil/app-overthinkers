// Supabase Edge Function (Deno): voice note (multipart "file") -> text.
// Uses an OpenAI-compatible transcription endpoint (Whisper).
//
// Secrets, either one:
//   - GROQ_API_KEY   (free tier, whisper-large-v3)
//   - OPENAI_API_KEY (paid, whisper-1)
// If both are set, OpenAI is used unless AI_PROVIDER=groq.
// Optional overrides: TRANSCRIBE_MODEL, TRANSCRIBE_URL.

const GROQ = { url: 'https://api.groq.com/openai/v1/audio/transcriptions', model: 'whisper-large-v3' };
const OPENAI = { url: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1' };
const MAX_BYTES = 20 * 1024 * 1024;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const groqKey = Deno.env.get('GROQ_API_KEY');
    const useGroq = groqKey && (!openaiKey || Deno.env.get('AI_PROVIDER') === 'groq');
    const key = useGroq ? groqKey : openaiKey;
    if (!key) return Response.json({ error: 'no key set (GROQ_API_KEY or OPENAI_API_KEY)' }, { status: 500, headers: cors });
    const base = useGroq ? GROQ : OPENAI;
    const MODEL = Deno.env.get('TRANSCRIBE_MODEL') ?? base.model;
    const URL = Deno.env.get('TRANSCRIBE_URL') ?? base.url;

    // Two ways in: JSON { audio: base64, name, lang } (what the app sends) or multipart "file".
    let file: File;
    let lang: unknown = null;
    if ((req.headers.get('content-type') ?? '').includes('application/json')) {
      const body = await req.json();
      if (typeof body.audio !== 'string' || !body.audio) return Response.json({ error: 'audio is required' }, { status: 400, headers: cors });
      const bytes = Uint8Array.from(atob(body.audio), (c) => c.charCodeAt(0));
      const name = typeof body.name === 'string' && /\.[a-z0-9]{2,4}$/i.test(body.name) ? body.name : 'nota.m4a';
      file = new File([bytes], name, { type: 'audio/mp4' });
      lang = body.lang;
    } else {
      const form = await req.formData();
      const f = form.get('file');
      if (!(f instanceof File)) return Response.json({ error: 'file is required' }, { status: 400, headers: cors });
      file = f;
      lang = form.get('lang');
    }
    if (file.size > MAX_BYTES) return Response.json({ error: 'file too large' }, { status: 413, headers: cors });
    if (file.size < 1000) return Response.json({ error: 'audio too short', size: file.size }, { status: 400, headers: cors });

    const out = new FormData();
    out.append('file', file, file.name || 'nota.m4a');
    out.append('model', MODEL);
    out.append('response_format', 'json');
    // Language hint from the phone; the model also auto-detects if it is missing.
    if (typeof lang === 'string' && /^[a-z]{2}$/.test(lang)) out.append('language', lang);
    // Context helps Whisper with names, times and places, and to leave out hesitations.
    out.append('prompt', 'Lista de cosas que hacer: tareas, metas, horas, lugares y tiendas. Sin muletillas.');
    out.append('temperature', '0');

    const res = await fetch(URL, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: out });
    if (!res.ok) {
      const detail = await res.text();
      console.error('transcribe error', res.status, detail);
      return Response.json({ error: 'transcription_failed', status: res.status, detail: detail.slice(0, 300) }, { status: 502, headers: cors });
    }
    const data = await res.json();
    return Response.json({ text: typeof data.text === 'string' ? data.text : '' }, { headers: cors });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'bad_request', detail: String(e).slice(0, 300) }, { status: 400, headers: cors });
  }
});
