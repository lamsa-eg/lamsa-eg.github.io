-- v41: InstaPay is the only payment method. Customers pay to the shop's InstaPay
-- address (IPA) after ordering and upload the transfer receipt; staff confirm it.
-- Additive: existing rows keep their values.

-- Payment method: allow 'instapay' and make it the default.
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('instapay','cash_on_delivery','bank_transfer'));
alter table public.orders alter column payment_method set default 'instapay';

-- Receipt of the transfer.
alter table public.orders
  add column if not exists payment_proof_path text,
  add column if not exists payment_proof_uploaded_at timestamptz;

alter table public.order_uploads drop constraint if exists order_uploads_kind_check;
alter table public.order_uploads add constraint order_uploads_kind_check
  check (kind in ('image','video','audio','logo','background','payment_proof'));

-- Public site settings (non-secret, shown to customers) edited by owner/admin.
create table if not exists public.site_settings (
  key text primary key check (key ~ '^[a-z0-9_]{2,60}$'),
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "v41 public read site settings" on public.site_settings;
create policy "v41 public read site settings" on public.site_settings for select to anon, authenticated
  using (is_public or (select public.lamsa_is_staff()));
drop policy if exists "v41 admins manage site settings" on public.site_settings;
create policy "v41 admins manage site settings" on public.site_settings for all to authenticated
  using ((select public.lamsa_is_admin())) with check ((select public.lamsa_is_admin()));
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;

do $$ begin
  if to_regprocedure('public.lamsa_audit()') is not null then
    drop trigger if exists lamsa_audit_trg on public.site_settings;
    create trigger lamsa_audit_trg after insert or update or delete on public.site_settings
      for each row execute function public.lamsa_audit();
  end if;
end $$;

insert into public.site_settings(key, value) values
  ('instapay', jsonb_build_object('ipa', 'mostafaelhamoly@instapay', 'link', 'https://ipn.eg/S/mostafaelhamoly/instapay/91yNAE'))
on conflict (key) do nothing;
