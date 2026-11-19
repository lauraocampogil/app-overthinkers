-- Product events to measure what the business plan needs: day-7 retention, plan acceptance,
-- top-3 completion, closed days and the paywall. No content (no task titles, no text), only names and counts.
create table if not exists public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) <= 40),
  props jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists events_user_at on public.events (user_id, at);
create index if not exists events_name_at on public.events (name, at);

alter table public.events enable row level security;
-- People can only add their own events; nobody reads them from the app.
create policy "events: insert own" on public.events for insert to authenticated with check (auth.uid() = user_id);

-- Cohort retention: of the people who first opened Okio on a day, how many came back on day 1, 7 and 30.
create or replace view public.retention as
with first_open as (
  select user_id, min(at)::date as d0 from public.events where name = 'open' group by user_id
), opens as (
  select distinct user_id, at::date as d from public.events where name = 'open'
)
select f.d0 as cohort,
  count(*) as users,
  round(100.0 * count(*) filter (where exists (select 1 from opens o where o.user_id = f.user_id and o.d = f.d0 + 1)) / count(*), 1) as d1_pct,
  round(100.0 * count(*) filter (where exists (select 1 from opens o where o.user_id = f.user_id and o.d = f.d0 + 7)) / count(*), 1) as d7_pct,
  round(100.0 * count(*) filter (where exists (select 1 from opens o where o.user_id = f.user_id and o.d = f.d0 + 30)) / count(*), 1) as d30_pct
from first_open f group by f.d0 order by f.d0 desc;

-- The week at a glance: the numbers the launch plan watches.
create or replace view public.funnel_week as
select date_trunc('week', at)::date as week,
  count(distinct user_id) filter (where name = 'open') as active,
  count(*) filter (where name = 'dump') as dumps,
  round(avg((props->>'kept')::numeric) filter (where name = 'plan'), 2) as plan_kept_avg,
  count(*) filter (where name = 'top_done') as top3_done,
  count(*) filter (where name = 'close_day') as days_closed,
  count(*) filter (where name = 'proof') as proofs,
  count(*) filter (where name = 'draft') as drafts,
  count(*) filter (where name = 'paywall') as paywall_views,
  count(*) filter (where name = 'purchase') as purchases
from public.events group by 1 order by 1 desc;

revoke all on public.retention from anon, authenticated;
revoke all on public.funnel_week from anon, authenticated;
