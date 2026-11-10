-- LAMSA core schema (fresh project baseline).
-- Creates every base table the site, the admin panel and the Edge Functions use.
-- Later migrations (WOW phases, v35, v38) build on top of this file.
-- Safe to re-run: every statement is idempotent.

create extension if not exists pgcrypto;

-- ───────────────────────── helpers ─────────────────────────
create or replace function public.lamsa_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

-- ───────────────────────── admins ─────────────────────────
create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  role text not null default 'editor' check (role in ('owner','admin','editor')),
  created_at timestamptz not null default now()
);
alter table public.admin_profiles enable row level security;

-- Any staff member (owner/admin/editor) — orders, memories, media.
create or replace function public.lamsa_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()));
$$;
-- Owner/admin only — prices, catalog, audit (also defined again in v38; same body).
create or replace function public.lamsa_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.role in ('owner','admin'));
$$;
create or replace function public.lamsa_is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.role = 'owner');
$$;
revoke all on function public.lamsa_is_owner() from public;
grant execute on function public.lamsa_is_owner() to authenticated, service_role;
revoke all on function public.lamsa_is_staff() from public;
revoke all on function public.lamsa_is_admin() from public;
grant execute on function public.lamsa_is_staff() to anon, authenticated, service_role;
grant execute on function public.lamsa_is_admin() to anon, authenticated, service_role;

drop policy if exists "core staff read own profile" on public.admin_profiles;
create policy "core staff read own profile" on public.admin_profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.lamsa_is_admin()));
drop policy if exists "core owner manage profiles" on public.admin_profiles;
create policy "core owner manage profiles" on public.admin_profiles for all to authenticated
  using ((select public.lamsa_is_owner())) with check ((select public.lamsa_is_owner()));

-- ───────────────────────── catalog ─────────────────────────
create table if not exists public.packages (
  id text primary key check (id ~ '^[a-z0-9_-]{2,30}$'),
  label text not null check (char_length(label) between 1 and 40),
  price numeric(10,2) not null check (price >= 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  max_images integer not null default 3 check (max_images between 1 and 30),
  max_image_bytes bigint not null default 8388608 check (max_image_bytes between 1048576 and 20971520),
  allow_video boolean not null default false,
  max_video_bytes bigint not null default 0 check (max_video_bytes between 0 and 52428800),
  allow_audio boolean not null default false,
  max_audio_bytes bigint not null default 0 check (max_audio_bytes between 0 and 20971520),
  allow_song boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.packages enable row level security;
drop policy if exists "core public read active packages" on public.packages;
create policy "core public read active packages" on public.packages for select to anon, authenticated using (active or (select public.lamsa_is_staff()));

create table if not exists public.shipping_zones (
  id text primary key check (id ~ '^[a-z0-9_-]{2,60}$'),
  label text not null check (char_length(label) between 1 and 80),
  fee numeric(10,2) check (fee is null or fee >= 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.shipping_zones enable row level security;
drop policy if exists "core public read active zones" on public.shipping_zones;
create policy "core public read active zones" on public.shipping_zones for select to anon, authenticated using (active or (select public.lamsa_is_staff()));
drop policy if exists "core admins manage zones" on public.shipping_zones;
create policy "core admins manage zones" on public.shipping_zones for all to authenticated
  using ((select public.lamsa_is_admin())) with check ((select public.lamsa_is_admin()));

-- ───────────────────────── orders ─────────────────────────
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid unique,
  order_number text not null unique,
  tracking_token_hash text not null check (char_length(tracking_token_hash) = 64),
  submission_state text not null default 'uploading' check (submission_state in ('uploading','complete','aborted')),
  status text not null default 'pending' check (status in ('pending','processing','shipped','delivered','cancelled')),
  package_id text not null references public.packages(id),
  price numeric(10,2) not null check (price >= 0),
  shipping_zone_id text references public.shipping_zones(id) on update cascade on delete set null,
  shipping_zone_label text,
  shipping_area text,
  shipping_fee numeric(10,2) not null default 0 check (shipping_fee >= 0),
  shipping_pending boolean not null default false,
  total_amount numeric(10,2) not null default 0 check (total_amount >= 0),
  memory_theme text,
  memory_page_copy jsonb not null default '{}'::jsonb,
  advanced_customization jsonb not null default '{}'::jsonb,
  whatsapp_opt_in boolean not null default true,
  whatsapp_status text not null default 'pending' check (whatsapp_status in ('pending','sent','failed','skipped')),
  payment_method text not null default 'cash_on_delivery' check (payment_method in ('cash_on_delivery','bank_transfer')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  sender_name text not null check (char_length(sender_name) <= 80),
  recipient_name text not null check (char_length(recipient_name) <= 80),
  occasion text check (occasion is null or char_length(occasion) <= 80),
  memory_date date,
  message text check (message is null or char_length(message) <= 2000),
  acrylic_text_color text,
  acrylic_layout text,
  street text not null check (char_length(street) <= 180),
  city text not null check (char_length(city) <= 80),
  phone text not null check (char_length(phone) <= 24),
  requested_delivery_date date,
  notes text check (notes is null or char_length(notes) <= 400),
  terms_version text,
  terms_accepted_at timestamptz,
  submitted_at timestamptz,
  admin_hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_submitted_idx on public.orders(submitted_at desc) where admin_hidden_at is null;
create index if not exists orders_state_idx on public.orders(submission_state, created_at);
alter table public.orders enable row level security;
drop policy if exists "core staff manage orders" on public.orders;
create policy "core staff manage orders" on public.orders for all to authenticated
  using ((select public.lamsa_is_staff())) with check ((select public.lamsa_is_staff()));

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  slug text not null unique check (slug ~ '^m-[a-f0-9]{16}([a-f0-9]{16})?$'),
  sender_name text,
  recipient_name text,
  memory_date date,
  occasion text,
  intro text,
  message text,
  song_title text,
  song_url text,
  theme text not null default 'black_rose',
  page_copy jsonb not null default '{}'::jsonb,
  advanced_customization jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists memories_order_idx on public.memories(order_id);
alter table public.memories enable row level security;
drop policy if exists "core staff manage memories" on public.memories;
create policy "core staff manage memories" on public.memories for all to authenticated
  using ((select public.lamsa_is_staff())) with check ((select public.lamsa_is_staff()));

create table if not exists public.order_uploads (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  client_index integer,
  kind text not null check (kind in ('image','video','audio','logo','background')),
  storage_path text not null unique,
  original_name text,
  mime_type text not null,
  bytes bigint not null check (bytes > 0),
  uploaded_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists order_uploads_order_idx on public.order_uploads(order_id, client_index);
alter table public.order_uploads enable row level security;
drop policy if exists "core staff manage uploads" on public.order_uploads;
create policy "core staff manage uploads" on public.order_uploads for all to authenticated
  using ((select public.lamsa_is_staff())) with check ((select public.lamsa_is_staff()));

create table if not exists public.memory_media (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  kind text not null check (kind in ('image','video','audio','logo','background')),
  storage_bucket text not null default 'memory-media' check (storage_bucket in ('order-uploads','memory-media')),
  storage_path text not null,
  caption text check (caption is null or char_length(caption) <= 200),
  sort_order integer not null default 0,
  source_upload_id uuid references public.order_uploads(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists memory_media_memory_idx on public.memory_media(memory_id, sort_order);
alter table public.memory_media enable row level security;
drop policy if exists "core staff manage memory media" on public.memory_media;
create policy "core staff manage memory media" on public.memory_media for all to authenticated
  using ((select public.lamsa_is_staff())) with check ((select public.lamsa_is_staff()));

create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null check (char_length(event_type) <= 60),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events(order_id, created_at desc);
alter table public.order_events enable row level security;
drop policy if exists "core staff read order events" on public.order_events;
create policy "core staff read order events" on public.order_events for select to authenticated using ((select public.lamsa_is_staff()));

create table if not exists public.nfc_tags (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','written','tested','failed')),
  written_url text,
  written_at timestamptz,
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nfc_tags_memory_idx on public.nfc_tags(memory_id, created_at desc);
alter table public.nfc_tags enable row level security;
drop policy if exists "core staff manage nfc" on public.nfc_tags;
create policy "core staff manage nfc" on public.nfc_tags for all to authenticated
  using ((select public.lamsa_is_staff())) with check ((select public.lamsa_is_staff()));

-- ───────────────────────── admin notifications ─────────────────────────
create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  event_key text unique,
  title text not null check (char_length(title) <= 140),
  body text check (body is null or char_length(body) <= 400),
  href text check (href is null or href ~ '^/admin/'),
  severity text not null default 'info' check (severity in ('info','success','warning','danger')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists admin_notifications_created_idx on public.admin_notifications(created_at desc);
alter table public.admin_notifications enable row level security;
drop policy if exists "core staff read notifications" on public.admin_notifications;
create policy "core staff read notifications" on public.admin_notifications for select to authenticated using ((select public.lamsa_is_staff()));

create table if not exists public.admin_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_push_subscriptions enable row level security;
-- Function-only (service role). No client policies = no client access.

-- VAPID keys for web push (written once by an admin through SQL; service role only).
create table if not exists public.notification_settings (
  id text primary key default 'default',
  vapid_public_key text,
  vapid_private_key text,
  updated_at timestamptz not null default now()
);
alter table public.notification_settings enable row level security;
revoke all on public.notification_settings from anon, authenticated;

-- ───────────────────────── rate limiting ─────────────────────────
create table if not exists public.api_rate_limits (
  action text not null,
  key_hash text not null,
  window_start timestamptz not null default now(),
  request_count integer not null default 0,
  primary key (action, key_hash)
);
alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon, authenticated;

create or replace function public.consume_rate_limit(p_action text, p_key_hash text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  insert into public.api_rate_limits(action, key_hash, window_start, request_count)
  values (p_action, p_key_hash, now(), 1)
  on conflict (action, key_hash) do update set
    request_count = case when public.api_rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1 else public.api_rate_limits.request_count + 1 end,
    window_start  = case when public.api_rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now() else public.api_rate_limits.window_start end
  returning request_count into v_count;
  return v_count <= p_limit;
end $$;
revoke all on function public.consume_rate_limit(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text,text,integer,integer) to service_role;

-- ───────────────────────── updated_at triggers ─────────────────────────
do $$ declare t text; begin
  foreach t in array array['packages','shipping_zones','orders','memories','nfc_tags','admin_push_subscriptions'] loop
    execute format('drop trigger if exists lamsa_updated_at on public.%I', t);
    execute format('create trigger lamsa_updated_at before update on public.%I for each row execute function public.lamsa_set_updated_at()', t);
  end loop;
end $$;

-- ───────────────────────── storage ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
 ('order-uploads','order-uploads',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','audio/mpeg','audio/mp4','audio/x-m4a','audio/wav']),
 ('memory-media','memory-media',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','audio/mpeg','audio/mp4','audio/x-m4a','audio/wav'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

-- Staff can read/write both private buckets (admin panel, memory editor).
-- Customers never touch storage directly: uploads use one-time signed URLs.
drop policy if exists "core staff read media" on storage.objects;
create policy "core staff read media" on storage.objects for select to authenticated
  using (bucket_id in ('order-uploads','memory-media') and (select public.lamsa_is_staff()));
drop policy if exists "core staff write memory media" on storage.objects;
create policy "core staff write memory media" on storage.objects for insert to authenticated
  with check (bucket_id = 'memory-media' and (select public.lamsa_is_staff()));
drop policy if exists "core staff update memory media" on storage.objects;
create policy "core staff update memory media" on storage.objects for update to authenticated
  using (bucket_id = 'memory-media' and (select public.lamsa_is_staff()));
drop policy if exists "core staff delete media" on storage.objects;
create policy "core staff delete media" on storage.objects for delete to authenticated
  using (bucket_id in ('order-uploads','memory-media') and (select public.lamsa_is_staff()));

-- ───────────────────────── initial catalog ─────────────────────────
-- Prices are the ones the project used before (V35); change them any time from
-- /admin/catalog.html. Shipping fees start empty ("يتحدد بعد التأكيد").
insert into public.packages(id,label,price,sort_order,max_images,max_image_bytes,allow_video,max_video_bytes,allow_audio,max_audio_bytes,allow_song) values
 ('mini','Mini',299,10,3,8388608,false,0,false,0,false),
 ('memory','Memory',499,20,8,8388608,false,0,false,0,true),
 ('premium','Premium',799,30,12,8388608,true,52428800,true,15728640,true)
on conflict (id) do nothing;
insert into public.shipping_zones(id,label,fee,sort_order) values
 ('cairo-giza','القاهرة والجيزة',null,10),
 ('alex','الإسكندرية',null,20),
 ('other','محافظة أخرى',null,90)
on conflict (id) do nothing;
