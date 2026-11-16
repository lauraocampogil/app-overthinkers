// Supabase Edge Function (Deno): voice note (multipart "file") -> text.
// Uses an OpenAI-compatible transcription endpoint.
//
// Secrets: OPENAI_API_KEY (required), TRANSCRIBE_MODEL (optional), TRANSCRIBE_URL (optional).

const MODEL = Deno.env.get('TRANSCRIBE_MODEL') ?? 'whisper-1';
const URL = Deno.env.get('TRANSCRIBE_URL') ?? 'https://api.openai.com/v1/audio/transcriptions';
const MAX_BYTES = 10 * 1024 * 1024;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const key = Deno.env.get('OPENAI_API_KEY');
    if (!key) return Response.json({ error: 'OPENAI_API_KEY not set' }, { status: 500, headers: cors });

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
