-- Explicitly authorized demo fixtures, separate from production schema migrations.
-- No password, shared credential or email delivery. Configure passwords through
-- the trusted setup script before interactive login. Re-running preserves drafts.
begin;
do $$
declare entry record; uid uuid; cid uuid; draft public.card_drafts; job jsonb;
begin
 for entry in select * from (values
 ('alex.demo@example.test','Alex Demo','user','demo-space-explorer','Alex'),
 ('sam.demo@example.test','Sam Demo','user','demo-paper-party','Sam'),
 ('admin.demo@example.test','Demo Catalog Admin','admin','demo-birthday-type','Taylor')
 ) as v(email,display_name,role,card_slug,recipient) loop
  select id into uid from auth.users where email=entry.email;
  if uid is null then
   uid:=gen_random_uuid();
   insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
   values(uid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',entry.email,null,now(),'{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('display_name',entry.display_name,'demo_seed','cardly-v1'),now(),now(),'','','','');
   insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at)
   values(uid::text,uid,jsonb_build_object('sub',uid::text,'email',entry.email,'email_verified',true,'phone_verified',false),'email',now(),now());
  elsif not exists(select 1 from auth.users where id=uid and raw_user_meta_data->>'demo_seed'='cardly-v1') then
   raise exception 'Refusing to modify an existing non-demo account';
  end if;
  update public.profiles set display_name=entry.display_name where id=uid;
  update public.user_roles set role=entry.role where user_id=uid;
  perform set_config('request.jwt.claim.sub',uid::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
  select id into cid from public.cards where slug=entry.card_slug;
  if cid is null then raise exception 'Apply the fictional catalog migration first'; end if;
  if not exists(select 1 from public.card_drafts where user_id=uid and card_id=cid) then
   draft:=public.create_card_draft(cid,jsonb_build_object('recipient_name',entry.recipient,'sender_name','The Cardly demo team','custom_message','A fictional greeting, saved just for this demo.'));
  else select * into draft from public.card_drafts where user_id=uid and card_id=cid order by created_at limit 1;
  end if;
  perform public.set_card_favorite(cid,true);
  if not exists(select 1 from public.generated_cards where user_id=uid and card_id=cid) then
   job:=public.generate_card(draft.id,0);
   update public.generated_cards set generated_text=jsonb_build_object('demo',true,'message','Placeholder generation: personalized preview only. No image has been rendered.') where id=(job->'generated_card'->>'id')::uuid;
  end if;
 end loop;
end $$;
commit;
