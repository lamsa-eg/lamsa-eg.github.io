-- LAMSA V35: story builder, secure WOW progress, sender timeline, referrals and seasons.
-- This migration intentionally does not alter Supabase's managed realtime schema.

alter table public.orders
  add column if not exists recipient_gender text,
  add column if not exists story_answers jsonb not null default '{}'::jsonb,
  add column if not exists simple_mode boolean not null default false,
  add column if not exists wow_pack_id text,
  add column if not exists wow_addons text[] not null default '{}'::text[],
  add column if not exists wow_price numeric(10,2) not null default 0,
  add column if not exists wow_pricing jsonb not null default '{}'::jsonb,
  add column if not exists occasion_pack text,
  add column if not exists referral_code text;

alter table public.memories
  add column if not exists recipient_gender text,
  add column if not exists simple_mode boolean not null default false,
  add column if not exists referral_code text;

do $$ begin
  alter table public.orders add constraint orders_recipient_gender_check check (recipient_gender is null or recipient_gender in ('m','f'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.memories add constraint memories_recipient_gender_check check (recipient_gender is null or recipient_gender in ('m','f'));
exception when duplicate_object then null; end $$;

create table if not exists public.wow_hunt_progress (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  moment_id uuid not null references public.memory_wow_moments(id) on delete cascade,
  clue_index integer not null check (clue_index between 0 and 20),
  opened_at timestamptz not null default now(),
  ip_hash text,
  unique (memory_id, moment_id, clue_index)
);

create table if not exists public.wow_letters (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  moment_id uuid not null references public.memory_wow_moments(id) on delete cascade,
  letter_key text not null check (char_length(letter_key) between 1 and 80),
  unlock_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  unique (memory_id, moment_id, letter_key)
);

create table if not exists public.seasons (
  id text primary key,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  order_cutoff timestamptz,
  featured_pack text,
  banner_text text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (starts_on <= ends_on)
);

create table if not exists public.wow_referrals (
  code text primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  discount_percent integer not null default 10 check (discount_percent between 1 and 50),
  uses integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.wow_hunt_progress enable row level security;
alter table public.wow_letters enable row level security;
alter table public.seasons enable row level security;
alter table public.wow_referrals enable row level security;

revoke all on public.wow_hunt_progress, public.wow_letters, public.wow_referrals from anon, authenticated;
revoke all on public.seasons from anon, authenticated;
grant all on public.wow_hunt_progress, public.wow_letters, public.seasons, public.wow_referrals to service_role;

drop policy if exists "admins read v35 hunt progress" on public.wow_hunt_progress;
create policy "admins read v35 hunt progress" on public.wow_hunt_progress for select to authenticated
using (exists (select 1 from public.admin_profiles p where p.user_id=(select auth.uid())));
drop policy if exists "admins manage v35 letters" on public.wow_letters;
create policy "admins manage v35 letters" on public.wow_letters for all to authenticated
using (exists (select 1 from public.admin_profiles p where p.user_id=(select auth.uid())))
with check (exists (select 1 from public.admin_profiles p where p.user_id=(select auth.uid())));
drop policy if exists "admins manage v35 seasons" on public.seasons;
create policy "admins manage v35 seasons" on public.seasons for all to authenticated
using (exists (select 1 from public.admin_profiles p where p.user_id=(select auth.uid())))
with check (exists (select 1 from public.admin_profiles p where p.user_id=(select auth.uid())));

-- Existing V34 demo data may contain repeated wins. V35 enforces play-once in
-- wow-event before insert and keeps this non-unique lookup index for fast checks.
create index if not exists wow_events_completion_lookup
  on public.wow_events(memory_id,moment_id,event)
  where event in ('win','skip','hunt_done');
create index if not exists wow_events_timeline_idx on public.wow_events(memory_id,created_at desc);
create index if not exists wow_hunt_progress_lookup_idx on public.wow_hunt_progress(memory_id,moment_id,clue_index);

alter table public.wow_events drop constraint if exists wow_events_event_check;
alter table public.wow_events add constraint wow_events_event_check
  check (event in ('game_start','game_fail','win','skip','hunt_step','hunt_done','redeem','open','promise','letter_open','share'));

update public.packages set price=299 where id='mini';
update public.packages set price=499 where id='memory';
update public.packages set price=799 where id='premium';

insert into public.wow_addons(id,label,price,active,sort_order) values
 ('extra_game','لعبة إضافية',49,true,10),
 ('hunt_stickers','٣ ستيكرات صيد الكنز',99,true,20)
on conflict (id) do update set label=excluded.label,price=excluded.price,active=excluded.active,sort_order=excluded.sort_order;

insert into public.wow_packs(id,label,price,moments,theme,active,sort_order) values
 ('engagement','خطوبة',149,array['quiz','wheel'],'black_gold',true,10),
 ('baby','السبوع',149,array['balloons','scratch'],'birthday_balloons',true,20),
 ('mothers_day','عيد الأم',149,array['order_story','open_when'],'elegant_cream',true,30),
 ('eidiya','عيدية',149,array['scratch','coupons'],'black_gold',true,40),
 ('apology','اعتذار',149,array['finish_sentence','open_when'],'black_rose',true,50)
on conflict (id) do update set label=excluded.label,price=excluded.price,moments=excluded.moments,theme=excluded.theme,active=excluded.active,sort_order=excluded.sort_order;

insert into public.seasons(id,name,starts_on,ends_on,order_cutoff,featured_pack,banner_text,active)
values ('default-2026','موسم الهدايا','2026-01-01','2026-12-31','2026-12-20T20:00:00Z','engagement','اطلب بدري عشان لمستك توصل في معادها',true)
on conflict (id) do nothing;

drop policy if exists "deny client v35 referrals" on public.wow_referrals;
create policy "deny client v35 referrals" on public.wow_referrals for all to anon,authenticated using(false) with check(false);
create index if not exists wow_hunt_progress_moment_idx on public.wow_hunt_progress(moment_id);
create index if not exists wow_letters_moment_idx on public.wow_letters(moment_id);
create index if not exists wow_referrals_order_idx on public.wow_referrals(order_id);
drop index if exists public.wow_events_timeline_idx;
