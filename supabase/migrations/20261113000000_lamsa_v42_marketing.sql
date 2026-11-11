-- v42: ad attribution per order (UTM / fbclid captured on the site) + Meta Pixel setting.
-- Additive only. Rollback: supabase/rollbacks/20261113000000_lamsa_v42_marketing.down.sql
alter table public.orders add column if not exists attribution jsonb;
comment on column public.orders.attribution is 'Ad/source attribution captured client-side (utm_*, fbclid, landing, referrer). No personal data.';
insert into public.site_settings(key, value, is_public)
values ('meta_pixel', '{"id":""}'::jsonb, true)
on conflict (key) do nothing;
update public.site_settings set value = value || '{"name":"Lamsa"}'::jsonb, updated_at = now()
where key = 'instapay' and not (value ? 'name');
