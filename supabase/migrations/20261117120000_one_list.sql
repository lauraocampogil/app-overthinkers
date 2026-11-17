-- One list with days: every task (today, tomorrow, later, done) lives in profiles.tasks.
alter table public.profiles add column if not exists tasks jsonb not null default '[]'::jsonb;
