-- RLS assertions for v38. Fails (raises) on the first violation.
\set ON_ERROR_STOP on
insert into public.admin_profiles(user_id,role) values ('00000000-0000-4000-8000-000000000001','owner'),('00000000-0000-4000-8000-000000000002','editor');
insert into public.orders(id,order_number,package_id,price,phone,street) values ('10000000-0000-4000-8000-000000000001','ORD-T-1','mini',100,'01000000000','Fake st');
insert into public.memories(order_id,slug) values ('10000000-0000-4000-8000-000000000001','m-aaaaaaaaaaaaaaaa');

-- anon: can read active packages + game catalog, nothing private
set role anon; select set_config('request.jwt.claim.sub','',false);
do $$ begin
  if (select count(*) from public.packages) <> 3 then raise exception 'anon should read packages'; end if;
  if (select count(*) from public.game_catalog) < 10 then raise exception 'anon should read game catalog'; end if;
  if (select count(*) from public.orders) <> 0 then raise exception 'anon must not read orders'; end if;
  if (select count(*) from public.memories) <> 0 then raise exception 'anon must not read memories'; end if;
  if (select count(*) from public.admin_audit_logs) <> 0 then raise exception 'anon must not read audit'; end if;
end $$;
do $$ begin update public.packages set price = 1; if found then raise exception 'anon updated packages'; end if; exception when insufficient_privilege then null; end $$;
do $$ begin insert into public.game_catalog(key,label) values ('hack','x'); raise exception 'anon inserted game'; exception when insufficient_privilege then null; when others then if sqlerrm like '%anon inserted%' then raise; end if; end $$;
reset role;

-- editor (non-catalog admin): cannot change prices
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
update public.packages set price = 1 where id='mini';
do $$ begin if (select price from public.packages where id='mini') = 1 then raise exception 'editor changed price'; end if; end $$;
reset role;

-- random signed-in user: no orders, no audit
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000ff',false);
do $$ begin
  if (select count(*) from public.orders) <> 0 then raise exception 'user read orders'; end if;
  if (select count(*) from public.admin_audit_logs) <> 0 then raise exception 'user read audit'; end if;
end $$;
do $$ begin insert into public.admin_audit_logs(action,table_name) values ('UPDATE','x'); raise exception 'user wrote audit'; exception when insufficient_privilege then null; end $$;
reset role;

-- owner: can update prices + games; changes are audited with actor
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
update public.packages set price = 150, is_recommended = true where id='mini';
update public.game_catalog set active = false where key='scramble';
update public.orders set status='preparing', phone='01999999999' where order_number='ORD-T-1';
do $$ begin
  if (select price from public.packages where id='mini') <> 150 then raise exception 'owner could not update price'; end if;
  if (select count(*) from public.admin_audit_logs where table_name='packages' and actor='00000000-0000-4000-8000-000000000001' and changes ? 'price') <> 1 then raise exception 'price change not audited'; end if;
  if (select count(*) from public.admin_audit_logs where table_name='game_catalog') <> 1 then raise exception 'game change not audited'; end if;
  if exists (select 1 from public.admin_audit_logs where table_name='orders' and changes ? 'phone') then raise exception 'audit leaked order PII'; end if;
  if not exists (select 1 from public.admin_audit_logs where table_name='orders' and changes ? 'status') then raise exception 'order status not audited'; end if;
end $$;
reset role;
select 'RLS OK' as result;
