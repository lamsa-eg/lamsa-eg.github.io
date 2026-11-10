-- Minimal stand-in for the live Supabase project (schema inferred from the code).
-- Used ONLY by tests/db/run.sh to validate migrations + RLS locally. Fictional.
create extension if not exists pgcrypto;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema if not exists storage;
create table if not exists storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);

create table public.admin_profiles(user_id uuid primary key, display_name text, role text not null check (role in ('owner','admin','editor')));
create table public.packages(id text primary key, label text not null, price numeric not null, sort_order int default 0, active boolean default true, max_images int, max_image_bytes bigint, allow_video boolean default false, max_video_bytes bigint default 0, allow_audio boolean default false, max_audio_bytes bigint default 0, allow_song boolean default false);
create table public.shipping_zones(id text primary key, label text, fee numeric, sort_order int default 0, active boolean default true, updated_at timestamptz default now());
create table public.orders(id uuid primary key default gen_random_uuid(), order_number text unique, status text default 'pending', payment_status text default 'pending', submission_state text default 'uploading', admin_hidden_at timestamptz, package_id text references public.packages(id), price numeric, shipping_fee numeric default 0, total_amount numeric, phone text, street text, sender_name text, recipient_name text);
create table public.memories(id uuid primary key default gen_random_uuid(), order_id uuid references public.orders(id) on delete cascade, slug text unique, is_published boolean default false, theme text, sender_name text, recipient_name text, message text);
alter table public.admin_profiles enable row level security; alter table public.packages enable row level security; alter table public.shipping_zones enable row level security; alter table public.orders enable row level security; alter table public.memories enable row level security;
create policy "public read active packages" on public.packages for select to anon, authenticated using (active);
create policy "admins read profiles" on public.admin_profiles for select to authenticated using (user_id = auth.uid());
create policy "admins manage orders" on public.orders for all to authenticated using (exists(select 1 from public.admin_profiles a where a.user_id = auth.uid())) with check (exists(select 1 from public.admin_profiles a where a.user_id = auth.uid()));
create policy "admins manage memories" on public.memories for all to authenticated using (exists(select 1 from public.admin_profiles a where a.user_id = auth.uid())) with check (exists(select 1 from public.admin_profiles a where a.user_id = auth.uid()));
create policy "admins manage zones" on public.shipping_zones for all to authenticated using (exists(select 1 from public.admin_profiles a where a.user_id = auth.uid()));
create policy "public read zones" on public.shipping_zones for select to anon using (active);
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
alter default privileges in schema public grant select on tables to anon, authenticated;
alter default privileges in schema public grant insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
insert into public.packages(id,label,price,sort_order,max_images) values ('mini','Mini',100,10,3),('memory','Memory',200,20,8),('premium','Premium',300,30,12);
