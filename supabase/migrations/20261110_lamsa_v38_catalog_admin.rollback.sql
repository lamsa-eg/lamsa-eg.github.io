-- Rollback for 20261110_lamsa_v38_catalog_admin.sql
-- Removes only what v38 added. Packages columns are kept (data-preserving);
-- uncomment the last block only if you are sure nothing reads them.
begin;
do $$ declare t text; begin
  foreach t in array array['packages','shipping_zones','wow_addons','wow_packs','seasons','game_catalog','admin_profiles','orders','memories','memory_wow_moments'] loop
    if to_regclass('public.'||t) is not null then execute format('drop trigger if exists lamsa_audit_trg on public.%I', t); end if;
  end loop;
end $$;
drop function if exists public.lamsa_audit();
drop policy if exists "v38 admins manage packages" on public.packages;
-- Audit history and the game catalog are data; keep them by default.
-- drop table if exists public.admin_audit_logs;
-- drop table if exists public.game_catalog;
-- alter table public.packages drop column if exists max_games, drop column if exists is_recommended, drop column if exists tagline, drop column if exists features;
commit;
