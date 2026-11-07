-- Run in SQL Editor or through execute_sql as postgres. All fixtures roll back.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void
language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAIL: %', label; end if;
end $$;
create function pg_temp.denied(statement text) returns boolean
language plpgsql as $$ begin
 execute statement;
 return false;
exception when insufficient_privilege or check_violation or unique_violation or foreign_key_violation or not_null_violation then return true;
end $$;
insert into auth.users (id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333');
update public.user_roles set role = 'admin' where user_id = '33333333-3333-4333-8333-333333333333';
select pg_temp.assert_true((select count(*) = 3 from public.profiles where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333')), 'automatic profiles');
insert into public.cards (id,title,slug,status) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Test published','__test_published','published'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Test draft','__test_draft','draft');
insert into public.card_images (card_id,storage_path,image_type) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','__tests/public.png','preview'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','__tests/draft.png','preview');
insert into public.card_templates (card_id,template_key,layout_config) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','__test_public','{}'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','__test_private','{}');
insert into storage.objects (bucket_id,name) values
 ('card-assets','__tests/public.png'),('card-assets','__tests/draft.png'),
 ('user-generated-cards','11111111-1111-4111-8111-111111111111/test.png'),
 ('user-generated-cards','22222222-2222-4222-8222-222222222222/test.png');
select pg_temp.assert_true(pg_temp.denied($q$insert into public.cards(title,slug,pricing_type,price) values ('Bad','__bad_free','free',2)$q$), 'free price');
select pg_temp.assert_true(pg_temp.denied($q$insert into public.cards(title,slug,pricing_type,is_available) values ('Bad','__bad_paid','paid',true)$q$), 'paid availability');
select pg_temp.assert_true(pg_temp.denied($q$insert into public.cards(title,slug,price) values ('Bad','__bad_price',-1)$q$), 'negative price');
select pg_temp.assert_true(pg_temp.denied($q$insert into public.cards(title,slug,currency) values ('Bad','__bad_currency','USD')$q$), 'EUR only');
set local role anon;
select pg_temp.assert_true((select count(*) = 1 from public.cards where slug like '__test_%'), 'anonymous publication');
select pg_temp.assert_true((select count(*) = 1 from public.card_templates where template_key like '__test_%'), 'template publication');
select pg_temp.assert_true((select count(*) = 1 from storage.objects where name like '__tests/%'), 'asset publication');
select pg_temp.assert_true((select count(*) = 0 from storage.objects where bucket_id = 'user-generated-cards'), 'anonymous private storage');
select pg_temp.assert_true(pg_temp.denied('select * from public.profiles'), 'anonymous profiles');
select pg_temp.assert_true(pg_temp.denied($q$insert into public.cards(title,slug) values ('Bad','__anon')$q$), 'anonymous writes');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*) = 1 from public.profiles), 'profile privacy');
update public.profiles set display_name = 'Test owner' where id = auth.uid();
select pg_temp.assert_true((select display_name = 'Test owner' from public.profiles where id = auth.uid()), 'profile edit');
select pg_temp.assert_true(pg_temp.denied($q$update public.user_roles set role = 'admin' where user_id = auth.uid()$q$), 'role escalation');
select pg_temp.assert_true(pg_temp.denied($q$update public.profiles set id = '22222222-2222-4222-8222-222222222222' where id = auth.uid()$q$), 'profile identity');
insert into public.card_drafts (user_id,card_id) values (auth.uid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
update public.card_drafts set personalization_data = '{"recipient_name":"Test"}' where user_id = auth.uid();
select pg_temp.assert_true((select count(*) = 1 from public.card_drafts where personalization_data->>'recipient_name' = 'Test'), 'draft edit');
select pg_temp.assert_true(pg_temp.denied($q$insert into public.card_drafts(user_id,card_id) values ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$q$), 'forged owner');
select pg_temp.assert_true(pg_temp.denied($q$insert into public.card_drafts(user_id,card_id) values (auth.uid(),'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$q$), 'unpublished draft');
select pg_temp.assert_true(pg_temp.denied($q$update public.card_drafts set user_id = '22222222-2222-4222-8222-222222222222'$q$), 'ownership transfer');
select pg_temp.assert_true(pg_temp.denied($q$insert into public.generated_cards(user_id,card_id,personalization_data) values (auth.uid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{}')$q$), 'server-only generation');
insert into public.favorites(user_id,card_id) values (auth.uid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select pg_temp.assert_true(pg_temp.denied($q$insert into public.favorites(user_id,card_id) values (auth.uid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$q$), 'duplicate favorite');
select pg_temp.assert_true((select count(*) = 1 from storage.objects where bucket_id = 'user-generated-cards'), 'owner storage');
select pg_temp.assert_true(pg_temp.denied($q$insert into storage.objects(bucket_id,name) values ('user-generated-cards','22222222-2222-4222-8222-222222222222/forged.png')$q$), 'storage forged owner');
select pg_temp.assert_true(pg_temp.denied($q$insert into storage.objects(bucket_id,name) values ('card-assets','__tests/forged.png')$q$), 'asset write admin only');
reset role;
insert into public.generated_cards(user_id,card_id,source_draft_id,personalization_data)
 select user_id,card_id,id,personalization_data from public.card_drafts where user_id = '11111111-1111-4111-8111-111111111111';
select pg_temp.assert_true(pg_temp.denied($q$insert into public.generated_cards(user_id,card_id,source_draft_id,personalization_data) select '22222222-2222-4222-8222-222222222222',card_id,id,'{}' from public.card_drafts where user_id = '11111111-1111-4111-8111-111111111111'$q$), 'generated source ownership');
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*) = 0 from public.card_drafts), 'other-user drafts');
select pg_temp.assert_true((select count(*) = 0 from public.generated_cards), 'other-user generated cards');
select pg_temp.assert_true((select count(*) = 0 from public.favorites), 'other-user favorites');
with changed as (update public.cards set title = 'Tampered' where slug = '__test_published' returning id)
select pg_temp.assert_true(count(*) = 0, 'regular user catalog update') from changed;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*) = 2 from public.cards where slug like '__test_%'), 'admin sees drafts');
update public.cards set status = 'archived' where slug = '__test_draft';
select pg_temp.assert_true((select status = 'archived' from public.cards where slug = '__test_draft'), 'admin archive');
select pg_temp.assert_true((select count(*) = 2 from storage.objects where name like '__tests/%'), 'admin assets');
select pg_temp.assert_true(pg_temp.denied($q$update public.user_roles set role = 'admin' where user_id = auth.uid()$q$), 'admin client cannot assign roles');
reset role;
insert into public.cards(id,title,slug,status,pricing_type,price,is_available)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Paid','__paid','published','paid',5,false);
select pg_temp.assert_true(pg_temp.denied($q$insert into public.generated_cards(user_id,card_id,personalization_data) values ('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc','{}')$q$), 'paid generation blocked on server');
select pg_temp.assert_true(pg_temp.denied($q$insert into public.cards(title,slug,sort_order) values ('Bad','__bad_order',-1)$q$), 'negative sort order');
insert into public.personalization_fields(card_id,field_key,label,field_type) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','name','Name','text');
select pg_temp.assert_true(pg_temp.denied($q$insert into public.personalization_fields(card_id,field_key,label,field_type) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','name','Name','text')$q$), 'unique card field');
insert into public.categories(id,name,slug,is_active) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Inactive','__inactive',false);
update public.cards set category_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' where slug = '__test_published';
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
select pg_temp.assert_true((select count(*) = 0 from public.cards where slug = '__test_published'), 'inactive taxonomy hides card');
reset role;
update public.cards set category_id = null where slug = '__test_published';
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*) = 1 from public.generated_cards), 'owner generated read');
select pg_temp.assert_true(pg_temp.denied($q$insert into public.card_drafts(user_id,card_id) values (auth.uid(),'cccccccc-cccc-4ccc-8ccc-cccccccccccc')$q$), 'paid draft blocked');
select pg_temp.assert_true(pg_temp.denied($q$update storage.objects set name = '22222222-2222-4222-8222-222222222222/stolen.png' where bucket_id = 'user-generated-cards' and name = '11111111-1111-4111-8111-111111111111/test.png'$q$), 'storage ownership transfer');
delete from public.card_drafts where user_id = auth.uid();
select pg_temp.assert_true((select source_draft_id is null from public.generated_cards), 'deleting draft preserves generated record');
reset role;
select 'Authorization and integrity checks passed; all fixtures rolled back.' as result;
rollback;
