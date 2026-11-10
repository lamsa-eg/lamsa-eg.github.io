-- v40: server-only key/value settings (e.g. SHA-256 of the one-time owner setup code).
-- No client policies: only Edge Functions (service role) can read or write it.
create table if not exists public.app_config (
  key text primary key check (key ~ '^[a-z0-9_]{2,60}$'),
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;
