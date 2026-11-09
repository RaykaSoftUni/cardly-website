import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
import { png } from './helpers/admin.js';
test.use({trace:'off',screenshot:'off'});

test('live private uploads isolate two ordinary users and enforce admin boundaries',async({page})=>{
 const passwords=[process.env.CARDLY_DEMO_ALEX_PASSWORD,process.env.CARDLY_DEMO_SAM_PASSWORD,process.env.CARDLY_DEMO_ADMIN_PASSWORD];
 test.skip(passwords.some(p=>!p),'Configure both demo user passwords and the admin password in the local operator environment.');
 const env=loadEnv('development',process.cwd());
 const make=()=>createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const [a,b,admin,anon]=[make(),make(),make(),make()];
 const clients=[a,b,admin];
 for(const [i,email]of ['alex.demo@example.test','sam.demo@example.test','admin.demo@example.test'].entries())expect((await clients[i].auth.signInWithPassword({email,password:passwords[i]})).error).toBeNull();
 const au=(await a.auth.getUser()).data.user,bu=(await b.auth.getUser()).data.user;
 for(const [client,user]of [[a,au],[b,bu]]){
  const role=await client.from('user_roles').select('role').eq('user_id',user.id).single();expect(role.data?.role).toBe('user');
  const profile=await client.from('profiles').select('avatar_url').eq('id',user.id).single();
  expect(profile.data?.avatar_url,'Use test accounts with empty avatars to preserve existing user files.').toBeNull();
 }
 expect((await a.rpc('user_file_storage_available')).data).toBe(true);
 const upload=async(client,purpose,draftId)=>{
  const body=new FormData();body.set('purpose',purpose);if(draftId)body.set('draft_id',draftId);body.set('file',new Blob([png],{type:'image/png'}),'fixture.png');
  const r=await client.functions.invoke('user-file-upload',{body});expect(r.error).toBeNull();return r.data.path;
 };
 const remove=async(client,purpose,draftId)=>{
  const body=new FormData();body.set('purpose',purpose);body.set('action','remove');if(draftId)body.set('draft_id',draftId);
  const r=await client.functions.invoke('user-file-upload',{body});expect(r.error).toBeNull();
 };
 let draftId,fixtureId,assetId;const outputPath=`${au.id}/security-test/${crypto.randomUUID()}.png`;const adminPath=`security-fixtures/${crypto.randomUUID()}.png`;
 try{
  const ap=await upload(a,'avatar'),bp=await upload(b,'avatar');
  expect((await a.storage.from('user-uploads').download(ap)).error).toBeNull();
  expect((await b.storage.from('user-uploads').download(ap)).error).toBeTruthy();
  expect((await anon.storage.from('user-uploads').download(ap)).error).toBeTruthy();
  expect((await b.storage.from('user-uploads').createSignedUrl(ap,60)).error).toBeTruthy();
  expect((await b.storage.from('user-uploads').upload(ap,png,{contentType:'image/png',upsert:true})).error).toBeTruthy();
  await b.storage.from('user-uploads').remove([ap]);
  expect((await a.storage.from('user-uploads').list(au.id+'/avatars')).data.some(o=>ap.endsWith('/'+o.name))).toBe(true);
  expect((await a.from('profiles').update({avatar_url:bp}).eq('id',au.id)).error).toBeTruthy();
  const forged=await b.from('profiles').update({avatar_url:bp}).eq('id',au.id).select('id');expect(forged.data).toEqual([]);
  const replacement=await upload(a,'avatar');expect(replacement).not.toBe(ap);
  expect((await a.storage.from('user-uploads').list(au.id+'/avatars')).data.some(o=>ap.endsWith('/'+o.name))).toBe(false);
  const cards=await a.rpc('get_card_catalogue',{p_search:'A birthday worth keeping'});const card=cards.data.find(c=>c.slug==='demo-photo-keepsake');expect(card).toBeTruthy();
  const draft=await a.rpc('create_card_draft',{p_card_id:card.id,p_personalization_data:{recipient_name:'Storage test'}});expect(draft.error).toBeNull();draftId=draft.data.id;
  const photo=await upload(a,'draft',draftId);
  expect((await b.from('card_drafts').select('id').eq('id',draftId)).data).toEqual([]);
  expect((await b.rpc('prepare_user_upload',{p_purpose:'draft',p_draft_id:draftId})).error).toBeTruthy();
  expect((await a.rpc('update_card_draft',{p_draft_id:draftId,p_personalization_data:{recipient_name:'Test',recipient_photo:bp}})).error).toBeTruthy();
  expect((await b.from('card_drafts').update({uploaded_image_path:bp}).eq('id',draftId)).error).toBeTruthy();
  expect((await b.storage.from('user-uploads').download(photo)).error).toBeTruthy();
  const replacementPhoto=await upload(a,'draft',draftId);expect(replacementPhoto).not.toBe(photo);
  expect((await a.storage.from('user-uploads').list(au.id+'/drafts/'+draftId)).data.some(o=>photo.endsWith('/'+o.name))).toBe(false);
  expect((await a.storage.from('user-generated-cards').upload(outputPath,png,{contentType:'image/png'})).error).toBeNull();
  expect((await b.storage.from('user-generated-cards').download(outputPath)).error).toBeTruthy();
  expect((await b.storage.from('user-generated-cards').createSignedUrl(outputPath,60)).error).toBeTruthy();
  await page.goto('/login/');
  await page.getByLabel('Email address').fill('alex.demo@example.test');await page.getByLabel('Password',{exact:false}).fill(passwords[0]);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL('/my-cards/');
  await page.goto('/card-editor/?id='+card.id+'&draft='+draftId);
  await page.getByRole('button',{name:'Generate PNG',exact:true}).click();
  await expect(page.getByRole('link',{name:'Download Card',exact:true})).toBeVisible();
  // Isolated fixture for administrative positive/negative actions.
  const fixture=await admin.rpc('admin_save_card_data',{p_entity:'cards',p_data:{title:'Storage permissions fixture',slug:'storage-fixture-'+crypto.randomUUID(),status:'draft',is_available:false}});expect(fixture.error).toBeNull();fixtureId=fixture.data.id;
  expect((await admin.storage.from('card-assets').upload(adminPath,png,{contentType:'image/png'})).error).toBeNull();
  const asset=await admin.rpc('admin_save_card_asset',{p_card_id:fixtureId,p_asset:{storage_path:adminPath,alt_text:'Temporary security test image',image_type:'preview',is_primary:true}});expect(asset.error).toBeNull();assetId=asset.data.id;
  expect((await admin.rpc('admin_save_card_data',{p_entity:'cards',p_id:fixtureId,p_data:{status:'published'}})).error).toBeNull();
  expect((await anon.storage.from('card-assets').download(adminPath)).error).toBeNull();
  expect((await a.storage.from('card-assets').upload(adminPath,png,{contentType:'image/png',upsert:true})).error).toBeTruthy();
  expect((await a.from('user_roles').update({role:'admin'}).eq('user_id',au.id)).error).toBeTruthy();
  for(const entity of ['cards','card_templates','categories','occasions']){
   const data=entity==='cards'?{pricing_type:'free',price:0,is_available:true}:entity==='card_templates'?{layout_config:{}}:{is_active:false};
   expect((await a.rpc('admin_save_card_data',{p_entity:entity,p_id:fixtureId,p_data:data})).error).toBeTruthy();
  }
  expect((await a.rpc('admin_list_users')).error).toBeTruthy();
  expect((await a.rpc('admin_set_user_role',{p_user_id:au.id,p_role:'admin'})).error).toBeTruthy();
  expect((await anon.rpc('prepare_user_upload',{p_purpose:'avatar'})).error).toBeTruthy();
  await remove(a,'draft',draftId);
  expect((await a.storage.from('user-uploads').list(`${au.id}/drafts/${draftId}`)).data).toEqual([]);
 }finally{
  if(draftId)await a.rpc('delete_card_draft',{p_draft_id:draftId,p_archive:false});
  await remove(a,'avatar');await remove(b,'avatar');
  await a.storage.from('user-generated-cards').remove([outputPath]);
  if(assetId)await admin.rpc('admin_remove_configuration',{p_entity:'card_images',p_id:assetId});
  await admin.storage.from('card-assets').remove([adminPath]);
  if(fixtureId)await admin.from('cards').delete().eq('id',fixtureId);
  await Promise.all(clients.map(c=>c.auth.signOut({scope:'local'})));
 }
});
