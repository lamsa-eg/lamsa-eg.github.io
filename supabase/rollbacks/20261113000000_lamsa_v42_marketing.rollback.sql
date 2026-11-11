alter table public.orders drop column if exists attribution;
delete from public.site_settings where key = 'meta_pixel';
update public.site_settings set value = value - 'name' where key = 'instapay';
