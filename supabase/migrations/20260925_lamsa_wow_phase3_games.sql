-- LAMSA WOW Phase 3 — production games and interaction events.
-- Additive only: existing memories and Phase 1/2 behavior stay unchanged.

create table if not exists public.wow_events (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  moment_id uuid not null references public.memory_wow_moments(id) on delete cascade,
  event text not null check (event in ('win','skip','hunt_step','hunt_done','redeem')),
  data jsonb null,
  ip_hash text not null check (char_length(ip_hash)=64),
  created_at timestamptz not null default now()
);

create index if not exists wow_events_memory_created_idx on public.wow_events(memory_id,created_at desc);
create index if not exists wow_events_moment_created_idx on public.wow_events(moment_id,created_at desc);
create unique index if not exists wow_events_coupon_once_idx on public.wow_events(moment_id,(data->>'coupon')) where event='redeem';

alter table public.wow_events enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='wow_events'
      and policyname='deny client wow events'
  ) then
    create policy "deny client wow events" on public.wow_events
      for all to anon, authenticated using(false) with check(false);
  end if;
end $$;

revoke all on table public.wow_events from public, anon, authenticated;
grant select, insert, update, delete on table public.wow_events to service_role;

insert into public.wow_addons(id,label,price,active,sort_order) values
('game_quiz','لعبة مين فينا؟',null,false,120),
('game_puzzle','لعبة البازل',null,false,130),
('game_hearts','لعبة اصطاد القلوب',null,false,140),
('game_memory','لعبة الذاكرة',null,false,150),
('game_balloons','لعبة البلالين',null,false,160),
('game_story','اختاري الحكاية',null,false,170),
('game_wheel','عجلة الخروجات',null,false,180),
('treasure','صيد الكنز',null,false,190),
('coupons','كوبونات الحب',null,false,200)
on conflict(id) do update set label=excluded.label,sort_order=excluded.sort_order;

insert into public.wow_packs(id,label,price,moments,theme,active,sort_order)
values('wow_love_games','WOW Love Games',null,array['game','treasure','coupons'],null,false,15)
on conflict(id) do update set label=excluded.label,moments=excluded.moments,sort_order=excluded.sort_order;
