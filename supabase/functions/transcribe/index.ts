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
const MAX_BYTES = 10 * 1024 * 1024;

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

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return Response.json({ error: 'file is required' }, { status: 400, headers: cors });
    if (file.size > MAX_BYTES) return Response.json({ error: 'file too large' }, { status: 413, headers: cors });

    const out = new FormData();
    out.append('file', file, file.name || 'nota.m4a');
    out.append('model', MODEL);
    // Language hint from the phone; the model also auto-detects if it is missing.
    const lang = form.get('lang');
    if (typeof lang === 'string' && /^[a-z]{2}$/.test(lang)) out.append('language', lang);

    const res = await fetch(URL, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: out });
    if (!res.ok) {
      console.error('transcribe error', res.status, await res.text());
      return Response.json({ error: 'transcription_failed' }, { status: 502, headers: cors });
    }
    const data = await res.json();
    return Response.json({ text: typeof data.text === 'string' ? data.text : '' }, { headers: cors });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'bad_request' }, { status: 400, headers: cors });
  }
});
