-- LAMSA v38 — catalog management, game catalog and admin audit log.
-- ADDITIVE ONLY: no table/column is dropped or renamed and no data is deleted.
-- Safe to run more than once. Rollback: supabase/rollbacks/20261110000000_lamsa_v38_catalog_admin.rollback.sql
-- Before running in production: take a backup (Dashboard → Database → Backups).


-- 1) Helper: is the current user a catalog admin (owner/admin)?
create or replace function public.lamsa_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_profiles p where p.user_id = (select auth.uid()) and p.role in ('owner','admin'));
$$;
revoke all on function public.lamsa_is_admin() from public;
grant execute on function public.lamsa_is_admin() to authenticated, service_role;

-- 2) Packages: single source of truth for prices + marketing fields.
alter table public.packages
  add column if not exists max_games integer,
  add column if not exists is_recommended boolean not null default false,
  add column if not exists tagline text,
  add column if not exists features text[] not null default '{}'::text[],
  add column if not exists updated_at timestamptz not null default now();
do $$ begin
  alter table public.packages add constraint packages_max_games_check check (max_games is null or max_games between 0 and 3);
exception when duplicate_object then null; end $$;
-- Backfill with the rule the order-wow-selection function used until now.
update public.packages set max_games = case id when 'premium' then 3 when 'memory' then 2 else 0 end where max_games is null;

alter table public.packages enable row level security;
drop policy if exists "v38 admins manage packages" on public.packages;
create policy "v38 admins manage packages" on public.packages for all to authenticated
  using ((select public.lamsa_is_admin())) with check ((select public.lamsa_is_admin()));
-- NOTE: the existing public read policy for active packages is left untouched.

-- 3) Game catalog (enable/disable games and rename them without a deploy).
create table if not exists public.game_catalog (
  key text primary key check (key ~ '^[a-z0-9_]{2,40}$'),
  label text not null check (char_length(label) between 1 and 80),
  description text check (description is null or char_length(description) <= 240),
  active boolean not null default true,
  sort_order integer not null default 0,
  min_package text references public.packages(id) on update cascade on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.game_catalog enable row level security;
drop policy if exists "v38 public read game catalog" on public.game_catalog;
create policy "v38 public read game catalog" on public.game_catalog for select to anon, authenticated using (true);
drop policy if exists "v38 admins manage game catalog" on public.game_catalog;
create policy "v38 admins manage game catalog" on public.game_catalog for all to authenticated
  using ((select public.lamsa_is_admin())) with check ((select public.lamsa_is_admin()));
grant select on public.game_catalog to anon, authenticated;
grant insert, update, delete on public.game_catalog to authenticated;

insert into public.game_catalog(key,label,sort_order) values
 ('who_of_us','مين فينا؟',10),('guess_answer','خمّن إجابتي',20),('order_story','رتّب ذكرياتنا',30),('open_when','افتحها عندما…',40),
 ('true_false','صح ولا غلط',50),('scramble','رتّب الكلمة',60),('wheel','عجلة الوعد',70),('coupons','كوبونات الحب',80),
 ('balloons','بلالين المفاجأة',90),('puzzle','بازل الصورة',100),('memory','لعبة الذاكرة',110),('scratch','اكشط المفاجأة',120),
 ('story','محطات الحكاية',130),('reunion_countdown','ميعاد اللقاء',140),('love_wrapped','Love Wrapped',150),('remote_touch','لمسة عن بُعد',160),('treasure','صيد الكنز',170)
on conflict (key) do nothing;

-- Admin write access for the other catalog tables (policies already exist for wow_addons, wow_packs, seasons, shipping_zones in earlier migrations or the live project).
alter table public.seasons add column if not exists updated_at timestamptz not null default now();

-- 4) Audit log for important admin changes.
create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor uuid,
  actor_role text,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  table_name text not null,
  row_id text,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_table_idx on public.admin_audit_logs(table_name, row_id);
alter table public.admin_audit_logs enable row level security;
drop policy if exists "v38 admins read audit" on public.admin_audit_logs;
create policy "v38 admins read audit" on public.admin_audit_logs for select to authenticated using ((select public.lamsa_is_admin()));
revoke insert, update, delete on public.admin_audit_logs from anon, authenticated;

-- Records only the changed columns. For orders we keep operational fields only
-- (no addresses/phones/messages) so the log never duplicates customer PII.
create or replace function public.lamsa_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else '{}'::jsonb end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  v_keep text[] := tg_argv;  -- optional whitelist of columns
  v_diff jsonb := '{}'::jsonb; k text; v_role text;
begin
  for k in select jsonb_object_keys(v_old || v_new) loop
    if k in ('updated_at') then continue; end if;
    if array_length(v_keep,1) is not null and not (k = any(v_keep)) then continue; end if;
    if (v_old -> k) is distinct from (v_new -> k) then
      v_diff := v_diff || jsonb_build_object(k, jsonb_build_object('from', v_old -> k, 'to', v_new -> k));
    end if;
  end loop;
  if tg_op = 'UPDATE' and v_diff = '{}'::jsonb then return coalesce(new, old); end if;
  select role into v_role from public.admin_profiles where user_id = (select auth.uid());
  insert into public.admin_audit_logs(actor, actor_role, action, table_name, row_id, changes)
  values ((select auth.uid()), coalesce(v_role, case when (select auth.uid()) is null then 'system' else 'user' end), tg_op, tg_table_name,
          coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'key', v_old ->> 'key', v_new ->> 'memory_id', v_old ->> 'memory_id'), v_diff);
  return coalesce(new, old);
end $$;
revoke all on function public.lamsa_audit() from public, anon, authenticated;

do $$ declare t text; begin
  foreach t in array array['packages','shipping_zones','wow_addons','wow_packs','seasons','game_catalog','admin_profiles'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists lamsa_audit_trg on public.%I', t);
      execute format('create trigger lamsa_audit_trg after insert or update or delete on public.%I for each row execute function public.lamsa_audit()', t);
    end if;
  end loop;
  if to_regclass('public.orders') is not null then
    drop trigger if exists lamsa_audit_trg on public.orders;
    create trigger lamsa_audit_trg after update on public.orders for each row
      execute function public.lamsa_audit('status','payment_status','submission_state','admin_hidden_at','shipping_fee','total_amount','price');
  end if;
  if to_regclass('public.memories') is not null then
    drop trigger if exists lamsa_audit_trg on public.memories;
    create trigger lamsa_audit_trg after update on public.memories for each row execute function public.lamsa_audit('is_published','slug','theme');
  end if;
  if to_regclass('public.memory_wow_moments') is not null then
    drop trigger if exists lamsa_audit_trg on public.memory_wow_moments;
    create trigger lamsa_audit_trg after insert or update or delete on public.memory_wow_moments for each row execute function public.lamsa_audit('type','enabled','sort_order');
  end if;
end $$;

