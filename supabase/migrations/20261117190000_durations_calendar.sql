-- Personal durations GetGo learns, and calendar preferences.
alter table public.profiles add column if not exists learned jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists prefs jsonb not null default '{}'::jsonb;
