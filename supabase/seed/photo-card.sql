-- Run once through an authorized operator AFTER user_file_storage migration.
-- Preserve existing records with this slug; never rewrite existing snapshots.
insert into public.cards(title,slug,description,occasion_id,category_id,status,is_available,style)
select 'A birthday worth keeping','demo-photo-keepsake','Your favourite photo, framed with birthday wishes and your own words.',
 (select id from public.occasions where slug='demo-birthday'),(select id from public.categories where slug='demo-minimal'),'draft',true,'Photo keepsake'
where not exists(select 1 from public.cards where slug='demo-photo-keepsake');
insert into public.card_templates(card_id,template_key,layout_config,style_config)
select id,'demo-photo-keepsake','{"design_key":"photo-keepsake","canvas":{"width":600,"height":800},"photo_upload":true,"regions":[],"artwork":{"type":"original-svg","key":"photo-keepsake"}}'::jsonb,'{}'::jsonb
from public.cards where slug='demo-photo-keepsake' on conflict(card_id) do nothing;
insert into public.personalization_fields(card_id,field_key,label,field_type,is_required,sort_order,config)
select c.id,f.key,f.label,f.type,f.required,f.ord,f.config::jsonb from public.cards c cross join(values
 ('recipient_name','Recipient name','text',true,0,'{"max_length":60}'),
 ('main_headline','Main headline','text',false,1,'{"max_length":80}'),
 ('custom_message','Your message','textarea',false,2,'{"max_length":240}'),
 ('sender_name','Sender name','text',false,3,'{"max_length":60}'),
 ('recipient_photo','Recipient photo','image',false,4,'{}')
)f(key,label,type,required,ord,config) where c.slug='demo-photo-keepsake' on conflict(card_id,field_key) do nothing;
update public.cards set status='published' where slug='demo-photo-keepsake' and status='draft';

insert into public.card_images(card_id,storage_path,alt_text,image_type)
select id,'demo-cards/photo-keepsake-preview.svg','Photo keepsake birthday card preview','preview' from public.cards c where slug='demo-photo-keepsake' and not exists(select 1 from public.card_images where card_id=c.id and storage_path='demo-cards/photo-keepsake-preview.svg');
