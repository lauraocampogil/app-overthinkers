-- Strava connection: tokens stay on the server, only the edge function (service role) reads them.
create table if not exists public.strava_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  athlete_id bigint,
  access_token text not null,
  refresh_token text not null,
  expires_at bigint not null,
  updated_at timestamptz not null default now()
);

alter table public.strava_tokens enable row level security;
-- No policies on purpose: the app never reads tokens directly.
