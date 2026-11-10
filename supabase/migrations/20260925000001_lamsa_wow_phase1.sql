-- LAMSA WOW Phase 1 — additive schema only. Existing non-WOW memories are untouched.

create table if not exists public.memory_wow (
  memory_id uuid primary key references public.memories(id) on delete cascade,
  enabled boolean not null default false,
  pack text null,
  theme text null,
  gates jsonb not null default '{}'::jsonb check (jsonb_typeof(gates) = 'object'),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_wow_moments (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  type text not null check (type ~ '^[a-z0-9_]{2,64}$'),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists memory_wow_moments_memory_sort_idx on public.memory_wow_moments(memory_id, sort_order, id);

create table if not exists public.memory_wow_state (
  memory_id uuid primary key references public.memories(id) on delete cascade,
  first_opened_at timestamptz null,
  open_notify_sent_at timestamptz null,
  updated_at timestamptz not null default now()
);

create table if not exists public.wow_replies (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  kind text not null check (kind in ('text','voice','mirror')),
  text_body text null check (text_body is null or char_length(text_body) <= 1000),
  storage_bucket text null check (storage_bucket is null or storage_bucket = 'wow-replies'),
  storage_path text null unique,
  mime_type text null,
  bytes bigint not null default 0 check (bytes >= 0 and bytes <= 10485760),
  duration_ms integer not null default 0 check (duration_ms >= 0 and duration_ms <= 60000),
  status text not null default 'pending' check (status in ('pending','ready','failed')),
  created_at timestamptz not null default now(),
  ready_at timestamptz null
);
create index if not exists wow_replies_memory_created_idx on public.wow_replies(memory_id, created_at desc);

create table if not exists public.wow_sender_subscriptions (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  active boolean not null default true,
  user_agent text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(memory_id, endpoint)
);
create index if not exists wow_sender_subscriptions_active_idx on public.wow_sender_subscriptions(memory_id, active);

create table if not exists public.wow_addons (
  id text primary key,
  label text not null,
  price numeric null check (price is null or price >= 0),
  active boolean not null default false,
  sort_order integer not null default 0
);

create table if not exists public.wow_packs (
  id text primary key,
  label text not null,
  price numeric null check (price is null or price >= 0),
  moments text[] not null default '{}'::text[],
  theme text null,
  active boolean not null default false,
  sort_order integer not null default 0
);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('wow-replies','wow-replies',false,10485760,array['image/jpeg','image/png','image/webp','audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/x-m4a'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

alter table public.memory_wow enable row level security;
alter table public.memory_wow_moments enable row level security;
alter table public.memory_wow_state enable row level security;
alter table public.wow_replies enable row level security;
alter table public.wow_sender_subscriptions enable row level security;
alter table public.wow_addons enable row level security;
alter table public.wow_packs enable row level security;

-- Admin-only configuration/catalog access. Public/stateful access goes through Edge Functions with service role.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='memory_wow' and policyname='admins manage memory wow') then
    create policy "admins manage memory wow" on public.memory_wow for all to authenticated
      using (exists(select 1 from public.admin_profiles a where a.user_id=(select auth.uid())))
      with check (exists(select 1 from public.admin_profiles a where a.user_id=(select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='memory_wow_moments' and policyname='admins manage wow moments') then
    create policy "admins manage wow moments" on public.memory_wow_moments for all to authenticated
      using (exists(select 1 from public.admin_profiles a where a.user_id=(select auth.uid())))
      with check (exists(select 1 from public.admin_profiles a where a.user_id=(select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wow_replies' and policyname='admins read wow replies') then
    create policy "admins read wow replies" on public.wow_replies for select to authenticated
      using (exists(select 1 from public.admin_profiles a where a.user_id=(select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wow_addons' and policyname='admins manage wow addons') then
    create policy "admins manage wow addons" on public.wow_addons for all to authenticated
      using (exists(select 1 from public.admin_profiles a where a.user_id=(select auth.uid())))
      with check (exists(select 1 from public.admin_profiles a where a.user_id=(select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wow_packs' and policyname='admins manage wow packs') then
    create policy "admins manage wow packs" on public.wow_packs for all to authenticated
      using (exists(select 1 from public.admin_profiles a where a.user_id=(select auth.uid())))
      with check (exists(select 1 from public.admin_profiles a where a.user_id=(select auth.uid())));
  end if;
end $$;

-- Explicitly deny direct client access to function-only state tables.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='memory_wow_state' and policyname='deny client wow state') then
    create policy "deny client wow state" on public.memory_wow_state for all to anon,authenticated using(false) with check(false);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wow_sender_subscriptions' and policyname='deny client wow sender subscriptions') then
    create policy "deny client wow sender subscriptions" on public.wow_sender_subscriptions for all to anon,authenticated using(false) with check(false);
  end if;
end $$;

-- Atomic reply reservation: max 3 pending/ready replies per memory.
create or replace function public.wow_reserve_reply(
  p_memory_id uuid,
  p_kind text,
  p_text_body text default null,
  p_storage_path text default null,
  p_mime_type text default null,
  p_bytes bigint default 0,
  p_duration_ms integer default 0
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_count integer;
begin
  if p_kind not in ('text','voice','mirror') then raise exception 'invalid reply kind'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_memory_id::text,1977));
  update public.wow_replies set status='failed' where memory_id=p_memory_id and status='pending' and created_at < now()-interval '30 minutes';
  select count(*) into v_count from public.wow_replies where memory_id=p_memory_id and status in ('pending','ready');
  if v_count >= 3 then raise exception 'reply limit reached'; end if;
  insert into public.wow_replies(id,memory_id,kind,text_body,storage_bucket,storage_path,mime_type,bytes,duration_ms,status,ready_at)
  values(v_id,p_memory_id,p_kind,p_text_body,case when p_storage_path is null then null else 'wow-replies' end,p_storage_path,p_mime_type,coalesce(p_bytes,0),coalesce(p_duration_ms,0),case when p_kind='text' then 'ready' else 'pending' end,case when p_kind='text' then now() else null end);
  return v_id;
end $$;
revoke all on function public.wow_reserve_reply(uuid,text,text,text,text,bigint,integer) from public, anon, authenticated;
grant execute on function public.wow_reserve_reply(uuid,text,text,text,text,bigint,integer) to service_role;

-- Catalog seeds are deliberately inactive/unpriced. Admin decides commercial prices later.
insert into public.wow_addons(id,label,price,active,sort_order) values
('wax_seal','ختم الشمع',null,false,10),('locked','الذكرى المقفولة',null,false,20),('secret_question','سؤال السر',null,false,30),
('live_counter','العدّاد الحي',null,false,40),('typewriter_letter','الجواب',null,false,50),('first_chat','أول شات بينا',null,false,60),
('open_notify','إشعار الفتح',null,false,70),('reply','رُدّ على الهدية',null,false,80),('mirror','المراية',null,false,90)
on conflict(id) do nothing;

insert into public.wow_packs(id,label,price,moments,theme,active,sort_order) values
('wow_love','WOW Love',null,array['wax_seal','live_counter','typewriter_letter','first_chat','open_notify','reply'],null,false,10),
('wow_birthday','WOW Birthday',null,array['locked','candle','polaroid','balloons','quiz','reply'],null,false,20),
('wow_proposal','WOW Proposal',null,array['secret_question','constellation','heartbeat','rose_bloom','proposal'],null,false,30),
('wow_eid','WOW Eid / عيدية',null,array['eidiya','fanous'],'theme-eid',false,40),
('wow_baby','WOW Baby',null,array['pregnancy_reveal','gender_reveal'],'theme-baby',false,50),
('wow_trip','WOW Trip',null,array['trip_reveal'],null,false,60),
('wow_graduation','WOW Graduation',null,array['graduation'],null,false,70),
('wow_sorry','WOW Sorry',null,array['apology','soundboard','coupons'],null,false,80),
('wow_mothers_day','WOW Mother''s Day',null,array['soundboard','typewriter_letter','then_now'],null,false,90),
('wow_in_memory','WOW In Memory',null,array['typewriter_letter','soundboard','memorial_candle'],'theme-memorial',false,100)
on conflict(id) do nothing;

create or replace function public.wow_touch_first_open(p_memory_id uuid)
returns table(first_open boolean, first_opened_at timestamptz, notify_sent boolean)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_inserted integer := 0;
  v_updated integer := 0;
  v_row public.memory_wow_state%rowtype;
begin
  insert into public.memory_wow_state(memory_id,first_opened_at,updated_at)
  values(p_memory_id,now(),now()) on conflict(memory_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    update public.memory_wow_state set first_opened_at=now(),updated_at=now()
      where memory_id=p_memory_id and first_opened_at is null;
    get diagnostics v_updated = row_count;
  end if;
  select * into v_row from public.memory_wow_state where memory_id=p_memory_id;
  return query select (v_inserted>0 or v_updated>0), v_row.first_opened_at, (v_row.open_notify_sent_at is not null);
end $$;
revoke all on function public.wow_touch_first_open(uuid) from public, anon, authenticated;
grant execute on function public.wow_touch_first_open(uuid) to service_role;
