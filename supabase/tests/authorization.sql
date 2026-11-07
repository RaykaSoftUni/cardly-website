-- Current permission and Storage regression tests. Run as postgres; fixtures roll back.
begin;
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.denied(statement text) returns boolean language plpgsql as $$
begin execute statement; return false;
exception when insufficient_privilege or check_violation or unique_violation then return true;
end $$;
select pg_temp.ok((select bool_and(rowsecurity) from pg_tables where schemaname='public'),'RLS enabled');
select pg_temp.ok((select count(*)=2 from storage.buckets where id in ('card-assets','user-generated-cards') and not public),'private buckets');
select pg_temp.ok((select allowed_mime_types=array['image/png','image/jpeg'] and file_size_limit=10485760 from storage.buckets where id='user-generated-cards'),'output MIME and size limits');
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
select pg_temp.ok((select count(*)=2 from public.profiles where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')),'profile provisioning');
insert into storage.objects(bucket_id,name) values
 ('user-generated-cards','11111111-1111-4111-8111-111111111111/test.png'),
 ('user-generated-cards','22222222-2222-4222-8222-222222222222/test.png');
select pg_temp.ok(pg_temp.denied($q$insert into public.cards(title,slug,pricing_type,price) values ('Bad','__bad_free','free',2)$q$),'free price');
select pg_temp.ok(pg_temp.denied($q$insert into public.cards(title,slug,pricing_type,is_available) values ('Bad','__bad_paid','paid',true)$q$),'paid availability');
select pg_temp.ok(pg_temp.denied($q$insert into public.cards(title,slug,price) values ('Bad','__bad_price',-1)$q$),'negative price');
select pg_temp.ok(pg_temp.denied($q$insert into public.cards(title,slug,currency) values ('Bad','__bad_currency','USD')$q$),'EUR only');
select pg_temp.ok(pg_temp.denied($q$insert into public.cards(title,slug,sort_order) values ('Bad','__bad_order',-1)$q$),'nonnegative sort');
set local role anon;
select pg_temp.ok(pg_temp.denied('select * from public.profiles'),'anonymous profiles');
select pg_temp.ok(pg_temp.denied('select * from public.cards'),'catalogue projection required');
select pg_temp.ok((select count(*)=0 from storage.objects where bucket_id='user-generated-cards'),'anonymous private Storage');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select pg_temp.ok((select count(*)=1 from public.profiles),'profile isolation');
update public.profiles set display_name='Owner' where id=auth.uid();
select pg_temp.ok((select display_name='Owner' from public.profiles),'profile permitted edit');
select pg_temp.ok(pg_temp.denied($q$update public.profiles set id='22222222-2222-4222-8222-222222222222'$q$),'profile identity immutable');
select pg_temp.ok(pg_temp.denied($q$update public.user_roles set role='admin' where user_id=auth.uid()$q$),'role escalation');
select pg_temp.ok((select count(*)=1 from storage.objects where bucket_id='user-generated-cards'),'owner Storage');
select pg_temp.ok(pg_temp.denied($q$insert into storage.objects(bucket_id,name) values ('user-generated-cards','22222222-2222-4222-8222-222222222222/forged.png')$q$),'forged Storage owner');
select pg_temp.ok(pg_temp.denied($q$update storage.objects set name='22222222-2222-4222-8222-222222222222/stolen.png' where bucket_id='user-generated-cards' and name='11111111-1111-4111-8111-111111111111/test.png'$q$),'Storage ownership transfer');
select pg_temp.ok(pg_temp.denied($q$insert into storage.objects(bucket_id,name) values ('card-assets','__forged.png')$q$),'catalogue asset admin only');
select pg_temp.ok(not has_function_privilege('authenticated','public.finish_card_generation(uuid,text,text)','EXECUTE'),'worker function not callable by user');
select pg_temp.ok(not has_function_privilege('anon','public.generate_card(uuid,numeric)','EXECUTE'),'generation not callable by visitor');
reset role;
select 'Authorization checks passed; all fixtures rolled back.' as result;
rollback;
