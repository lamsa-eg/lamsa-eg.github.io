-- LAMSA WOW Phase 2 — synchronized gender reveal.
-- Additive only: Phase 1 and non-WOW memories keep their existing behavior.

create table if not exists public.wow_gender_reveals (
  memory_id uuid primary key references public.memories(id) on delete cascade,
  result text not null check (result in ('boy','girl')),
  reveal_at timestamptz null,
  started_at timestamptz null,
  revealed_at timestamptz null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.wow_gender_presence (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  session_hash text not null check (char_length(session_hash) = 64),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(memory_id, session_hash)
);

create index if not exists wow_gender_presence_memory_seen_idx
  on public.wow_gender_presence(memory_id, last_seen_at desc);

alter table public.wow_gender_reveals enable row level security;
alter table public.wow_gender_presence enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='wow_gender_reveals'
      and policyname='deny client gender reveal'
  ) then
    create policy "deny client gender reveal" on public.wow_gender_reveals
      for all to anon, authenticated using(false) with check(false);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='wow_gender_presence'
      and policyname='deny client gender presence'
  ) then
    create policy "deny client gender presence" on public.wow_gender_presence
      for all to anon, authenticated using(false) with check(false);
  end if;
end $$;

-- New Supabase projects may not auto-expose newly created public tables.
-- Edge Functions use only the service role; browsers receive no table grants.
revoke all on table public.wow_gender_reveals from public, anon, authenticated;
revoke all on table public.wow_gender_presence from public, anon, authenticated;
grant select, insert, update, delete on table public.wow_gender_reveals to service_role;
grant select, insert, update, delete on table public.wow_gender_presence to service_role;

create or replace function public.wow_schedule_gender_reveal(
  p_memory_id uuid,
  p_delay_seconds integer default 12
) returns table(reveal_at timestamptz, already_started boolean)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_row public.wow_gender_reveals%rowtype;
  v_started boolean := false;
begin
  perform pg_advisory_xact_lock(hashtextextended('wow-gender|' || p_memory_id::text, 2026));
  select * into v_row
    from public.wow_gender_reveals
    where memory_id = p_memory_id
    for update;
  if not found then
    raise exception 'gender reveal not configured';
  end if;
  if v_row.reveal_at is null then
    update public.wow_gender_reveals
      set reveal_at = now() + make_interval(secs => greatest(8, least(30, coalesce(p_delay_seconds,12)))),
          started_at = now(),
          revealed_at = null,
          updated_at = now()
      where memory_id = p_memory_id
      returning * into v_row;
    v_started := true;
  end if;
  return query select v_row.reveal_at, not v_started;
end $$;

revoke all on function public.wow_schedule_gender_reveal(uuid,integer) from public, anon, authenticated;
grant execute on function public.wow_schedule_gender_reveal(uuid,integer) to service_role;

insert into public.wow_addons(id,label,price,active,sort_order)
values ('gender_reveal','كشف نوع المولود المتزامن',null,false,110)
on conflict(id) do update set label=excluded.label;

update public.wow_packs
set moments = case
  when not ('gender_reveal' = any(moments)) then array_append(moments,'gender_reveal')
  else moments end,
  theme = coalesce(theme,'theme-baby')
where id='wow_baby';
