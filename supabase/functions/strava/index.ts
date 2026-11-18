// Supabase Edge Function (Deno): Strava connection.
//   action "exchange"   { code }  → swaps the OAuth code for tokens and stores them (strava_tokens).
//   action "activities" { after } → the athlete's activities since `after` (unix seconds), refreshing the token if needed.
//   action "disconnect"           → revokes access on Strava and deletes the tokens.
// Secrets: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET (from strava.com/settings/api). The secret never reaches the app.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Tokens = { access_token: string; refresh_token: string; expires_at: number; athlete?: { id: number } };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const clientId = Deno.env.get('STRAVA_CLIENT_ID');
    const secret = Deno.env.get('STRAVA_CLIENT_SECRET');
    if (!clientId || !secret) return Response.json({ error: 'strava_not_configured' }, { status: 500, headers: cors });

    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: who, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !who.user) return Response.json({ error: 'unauthorized' }, { status: 401, headers: cors });
    const userId = who.user.id;

    const { action, code, after } = await req.json();

    const save = async (t: Tokens) => {
      const { error } = await admin.from('strava_tokens').upsert({
        user_id: userId,
        ...(t.athlete?.id ? { athlete_id: t.athlete.id } : {}),
        access_token: t.access_token,
        refresh_token: t.refresh_token,
        expires_at: t.expires_at,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    };
    const oauth = async (params: Record<string, string>) => {
      const res = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: secret, ...params }),
      });
      if (!res.ok) throw new Error(`strava_oauth_${res.status}: ${(await res.text()).slice(0, 200)}`);
      return (await res.json()) as Tokens;
    };

    if (action === 'exchange') {
      if (typeof code !== 'string' || !code) return Response.json({ error: 'code required' }, { status: 400, headers: cors });
      const t = await oauth({ code, grant_type: 'authorization_code' });
      await save(t);
      return Response.json({ ok: true }, { headers: cors });
    }

    const { data: row } = await admin.from('strava_tokens').select('*').eq('user_id', userId).maybeSingle();
    if (!row) return Response.json({ error: 'not_connected' }, { status: 404, headers: cors });

    let access = row.access_token as string;
    if (Number(row.expires_at) - 60 < Date.now() / 1000) {
      const t = await oauth({ grant_type: 'refresh_token', refresh_token: row.refresh_token });
      await save(t);
      access = t.access_token;
    }

    if (action === 'disconnect') {
      await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { Authorization: `Bearer ${access}` } }).catch(() => {});
      await admin.from('strava_tokens').delete().eq('user_id', userId);
      return Response.json({ ok: true }, { headers: cors });
    }

    if (action === 'activities') {
      const since = Number.isFinite(Number(after)) ? Math.floor(Number(after)) : Math.floor(Date.now() / 1000) - 86_400;
      const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${since}&per_page=30`, {
        headers: { Authorization: `Bearer ${access}` },
      });
      if (!res.ok) return Response.json({ error: 'strava_api', status: res.status }, { status: 502, headers: cors });
      const list = (await res.json()) as {
        sport_type?: string; type?: string; moving_time?: number; distance?: number; start_date_local?: string; name?: string;
      }[];
      // Only what the app needs: type, minutes, km and the local day.
      const activities = list.map((a) => ({
        sport: a.sport_type ?? a.type ?? 'Workout',
        minutes: Math.round((a.moving_time ?? 0) / 60),
        km: Math.round((a.distance ?? 0) / 100) / 10,
        day: (a.start_date_local ?? '').slice(0, 10),
        name: a.name ?? '',
      }));
      return Response.json({ activities }, { headers: cors });
    }

    return Response.json({ error: 'unknown action' }, { status: 400, headers: cors });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'bad_request', detail: String(e).slice(0, 300) }, { status: 400, headers: cors });
  }
});
