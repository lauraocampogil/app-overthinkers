// Supabase Edge Function (Deno): deletes the calling user's account.
// profiles and day_plans rows go with it (on delete cascade).
// Uses SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY, which Supabase provides automatically.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return Response.json({ error: 'unauthorized' }, { status: 401, headers: cors });

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data, error } = await admin.auth.getUser(jwt);
    if (error || !data.user) return Response.json({ error: 'unauthorized' }, { status: 401, headers: cors });

    const { error: delError } = await admin.auth.admin.deleteUser(data.user.id);
    if (delError) {
      console.error(delError);
      return Response.json({ error: 'delete_failed' }, { status: 500, headers: cors });
    }
    return Response.json({ ok: true }, { headers: cors });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'bad_request' }, { status: 400, headers: cors });
  }
});
