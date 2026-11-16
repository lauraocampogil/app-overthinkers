-- Profiles: one row per user (anonymous users included).
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  level text not null default 'equilibrado' check (level in ('suave', 'equilibrado', 'duro')),
  free_minutes integer not null default 120 check (free_minutes between 0 and 1440),
  notify_at text not null default '08:00',
  streak jsonb not null default '{"current":0,"freezes":2,"lastCountedDate":null}'::jsonb,
  waiting jsonb not null default '[]'::jsonb,
  dream text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One plan per user and day; tasks are stored as the app's PlannedTask[] JSON.
create table if not exists public.day_plans (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  tasks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.profiles enable row level security;
alter table public.day_plans enable row level security;

create policy "profiles: own row" on public.profiles
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "day_plans: own rows" on public.day_plans
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
