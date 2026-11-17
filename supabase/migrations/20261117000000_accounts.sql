-- Accounts are now required (Google / Apple). Keep the streak calendar on the server too.
alter table public.profiles add column if not exists history jsonb not null default '{}'::jsonb;
