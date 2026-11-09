-- Requires unified user_file_storage proposal applied. Transactional fixtures; no real users changed.
begin;
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.denied(statement text) returns boolean language plpgsql as $$
begin execute statement; return false; exception when insufficient_privilege or check_violation then return true; end $$;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.user_uploads(user_id,purpose,storage_path,state,bytes,width,height) values
 ('11111111-1111-4111-8111-111111111111','avatar','11111111-1111-4111-8111-111111111111/avatar/11111111-1111-4111-8111-111111111111.png','ready',100,1,1),
 ('22222222-2222-4222-8222-222222222222','avatar','22222222-2222-4222-8222-222222222222/avatar/22222222-2222-4222-8222-222222222222.png','ready',100,1,1);
insert into storage.objects(bucket_id,name) values
 ('user-uploads','11111111-1111-4111-8111-111111111111/avatar/11111111-1111-4111-8111-111111111111.png'),
 ('user-uploads','22222222-2222-4222-8222-222222222222/avatar/22222222-2222-4222-8222-222222222222.png');
select pg_temp.ok((select not public and file_size_limit=10485760 and allowed_mime_types=array['image/png'] from storage.buckets where id='user-uploads'),'avatar bucket limits');
set local role anon;
select pg_temp.ok(pg_temp.denied('select * from public.profiles'),'guest profiles denied');
select pg_temp.ok((select count(*)=0 from storage.objects where bucket_id='user-uploads'),'guest avatar denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select pg_temp.ok((select count(*)=1 from public.profiles),'profile owner isolation');
update public.profiles set display_name='Account owner',avatar_path='11111111-1111-4111-8111-111111111111/avatar/11111111-1111-4111-8111-111111111111.png' where id=auth.uid();
select pg_temp.ok((select display_name='Account owner' from public.profiles where id=auth.uid()),'profile owner can update');
with changed as (update public.profiles set display_name='Forged' where id='22222222-2222-4222-8222-222222222222' returning 1)
 select pg_temp.ok(count(*)=0,'cannot edit another profile') from changed;
select pg_temp.ok(pg_temp.denied($q$update public.profiles set display_name=repeat('x',81) where id=auth.uid()$q$),'display length');
select pg_temp.ok(pg_temp.denied($q$update public.profiles set display_name='' where id=auth.uid()$q$),'empty display name');
select pg_temp.ok(pg_temp.denied($q$update public.profiles set avatar_path='22222222-2222-4222-8222-222222222222/avatar/22222222-2222-4222-8222-222222222222.png' where id=auth.uid()$q$),'avatar owner cannot be forged');
select pg_temp.ok(pg_temp.denied($q$update public.profiles set avatar_path='https://example.test/picture.png' where id=auth.uid()$q$),'no arbitrary avatar URL');
select pg_temp.ok(pg_temp.denied($q$update public.profiles set id='22222222-2222-4222-8222-222222222222'$q$),'identity immutable');
select pg_temp.ok(pg_temp.denied($q$update public.profiles set created_at=now()$q$),'metadata immutable');
select pg_temp.ok(pg_temp.denied($q$update public.user_roles set role='admin' where user_id=auth.uid()$q$),'no self promotion');
select pg_temp.ok((select count(*)=1 from storage.objects where bucket_id='user-uploads'),'only own avatar visible');
select pg_temp.ok(pg_temp.denied($q$insert into storage.objects(bucket_id,name) values ('user-uploads','22222222-2222-4222-8222-222222222222/avatar/11111111-1111-4111-8111-111111111111.png')$q$),'cannot upload for another user');
with changed as (update storage.objects set name='11111111-1111-4111-8111-111111111111/avatar/22222222-2222-4222-8222-222222222222.png' where bucket_id='user-uploads' returning 1)
 select pg_temp.ok(count(*)=0,'no avatar overwrite policy') from changed;
-- Use the Storage HTTP API for delete tests: Supabase protects direct SQL deletion.
reset role;
select 'Account authorization checks passed; fixtures rolled back.' as result;
rollback;
