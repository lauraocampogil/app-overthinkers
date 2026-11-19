-- Waitlist for okio.app: who wants Okio, what is in their head, and what they want it to do.
-- The landing page can only add a row (anon insert); nobody can read the list from the web.
create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  email text not null unique check (char_length(email) between 5 and 200 and email like '%@%'),
  lang text check (char_length(lang) <= 8),
  who text check (who in ('etudiant', 'travail', 'freelance', 'autre')),
  head text check (char_length(head) <= 1500),
  wish text check (char_length(wish) <= 1500),
  phone text check (phone in ('iphone', 'android')),
  source text check (char_length(source) <= 60),
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;
create policy "waitlist: anyone can join" on public.waitlist for insert to anon, authenticated with check (true);

-- Counts for the founder (read in the Supabase dashboard).
create or replace view public.waitlist_summary as
select count(*) as people,
  count(*) filter (where who = 'etudiant') as students,
  count(*) filter (where who = 'travail') as workers,
  count(*) filter (where who = 'freelance') as freelancers,
  count(*) filter (where phone = 'iphone') as iphone,
  count(*) filter (where phone = 'android') as android,
  count(*) filter (where created_at > now() - interval '7 days') as last_7_days
from public.waitlist;
revoke all on public.waitlist_summary from anon, authenticated;
