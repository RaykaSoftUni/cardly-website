import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
import { png } from './helpers/admin.js';
// Real credentials/tokens are never recorded in traces or automatic screenshots.
test.use({ trace: 'off', screenshot: 'off' });
const password = process.env.CARDLY_ADMIN_TEST_PASSWORD;
test('live admin login and protected management pages', async ({ page }) => {
  test.skip(!password, 'Supply an operator password explicitly for this authenticated smoke test.');
  await page.goto('/login/?next=/admin/');
  await page.getByLabel('Email address').fill('admin.demo@example.test');
  await page.getByLabel('Password', { exact: false }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Administration workspace' })).toBeVisible({ timeout: 20000 });
  await page.goto('/admin/cards/');
  await expect(page.locator('table tbody tr')).toHaveCount(12, { timeout: 20000 });
  await page.getByRole('link', { name: 'Tiny space explorer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save card', exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('heading', { name: 'Card template', exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('heading', { name: 'Personalization fields', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Images & Assets', exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('live-admin-editor.png'), fullPage: true });
  await page.setViewportSize({ width: 375, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('live Storage multi-assets, primary selection, replacement and cleanup', async () => {
  test.skip(!password || !process.env.CARDLY_USER_TEST_PASSWORD, 'Explicit admin and user test passwords required.');
  const env = loadEnv('development', process.cwd());
  const client = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const admin = client(), user = client(), visitor = client();
  expect((await admin.auth.signInWithPassword({ email: 'admin.demo@example.test', password })).error?.message).toBeUndefined();
  expect((await user.auth.signInWithPassword({ email: 'alex.demo@example.test', password: process.env.CARDLY_USER_TEST_PASSWORD })).error?.message).toBeUndefined();
  const nonce = crypto.randomUUID();
  const paths = [0,1,2].map(i=>`admin-smoke/${nonce}-${i}.png`);
  let cardId; const imageIds=new Set();
  const rpc = async (name, args) => { const {data,error}=await admin.rpc(name,args);expect(error?.message).toBeUndefined();return data; };
  try {
    const settings=await rpc('admin_asset_settings',{});
    expect(settings.max_bytes).toBeGreaterThan(0);
    expect((await user.rpc('admin_asset_settings',{p_max_bytes:1048576})).error).toBeTruthy();
    expect((await admin.rpc('admin_asset_settings',{p_max_bytes:0})).error).toBeTruthy();
    const card=await rpc('admin_save_card_data',{p_entity:'cards',p_data:{title:'Temporary Storage verification',slug:`storage-check-${nonce}`,status:'draft',is_available:false}});cardId=card.id;
    expect((await user.storage.from('card-assets').upload(`admin-smoke/${nonce}-forbidden.png`,png,{contentType:'image/png'})).error).toBeTruthy();
    expect((await admin.storage.from('card-assets').upload(`admin-smoke/${nonce}.txt`,'not an image',{contentType:'text/plain'})).error).toBeTruthy();
    for(const path of paths)expect((await admin.storage.from('card-assets').upload(path,png,{contentType:'image/png',upsert:false})).error?.message).toBeUndefined();
    const first=await rpc('admin_save_card_asset',{p_card_id:cardId,p_asset:{storage_path:paths[0],image_type:'preview',alt_text:'Temporary first pink pixel',is_primary:true}});imageIds.add(first.id);
    expect((await visitor.storage.from('card-assets').download(paths[0])).error).toBeTruthy();
    const second=await rpc('admin_save_card_asset',{p_card_id:cardId,p_asset:{storage_path:paths[1],image_type:'hero',alt_text:'Temporary hero pink pixel',is_primary:true}});imageIds.add(second.id);
    expect((await user.rpc('admin_save_card_asset',{p_card_id:cardId,p_id:first.id,p_asset:{is_primary:true}})).error).toBeTruthy();
    const rows=await admin.from('card_images').select('id,is_primary').eq('card_id',cardId);
    expect(rows.data.filter(r=>r.is_primary)).toHaveLength(1);
    expect(rows.data.find(r=>r.is_primary).id).toBe(second.id);
    expect((await admin.from('card_images').update({is_primary:true}).eq('id',first.id)).error?.code).toBe('23505');
    await rpc('admin_reorder_assets',{p_card_id:cardId,p_asset_ids:[second.id,first.id]});
    expect((await admin.rpc('admin_reorder_assets',{p_card_id:cardId,p_asset_ids:[first.id,crypto.randomUUID()]})).error).toBeTruthy();
    await rpc('admin_save_card_asset',{p_card_id:cardId,p_id:second.id,p_asset:{storage_path:paths[2]}});
    expect(await rpc('admin_asset_deletable',{p_path:paths[1]})).toBe(true);
    expect((await admin.storage.from('card-assets').remove([paths[1]])).error?.message).toBeUndefined();
    const downloaded=await admin.storage.from('card-assets').download(paths[2]);
    expect(Buffer.from(await downloaded.data.arrayBuffer())).toEqual(png);
    await rpc('admin_save_card_data',{p_entity:'cards',p_id:cardId,p_data:{status:'published'}});
    const detail=await visitor.rpc('get_card_detail',{p_card_id:cardId});
    expect(detail.data.preview_assets[0]).toMatchObject({id:second.id,is_primary:true,image_type:'hero',storage_path:paths[2]});
    expect((await visitor.storage.from('card-assets').download(paths[2])).error?.message).toBeUndefined();
    await rpc('admin_save_card_data',{p_entity:'cards',p_id:cardId,p_data:{status:'draft'}});
    for(const id of [...imageIds]){await rpc('admin_remove_configuration',{p_entity:'card_images',p_id:id});imageIds.delete(id);}
    expect((await admin.storage.from('card-assets').remove(paths)).error?.message).toBeUndefined();
    const remaining=await admin.storage.from('card-assets').list('admin-smoke',{search:nonce});
    expect(remaining.error?.message).toBeUndefined();
    expect(remaining.data).toEqual([]);
  } finally {
    for(const id of imageIds)await admin.rpc('admin_remove_configuration',{p_entity:'card_images',p_id:id});
    await admin.storage.from('card-assets').remove(paths);
    if(cardId)expect((await admin.from('cards').delete().eq('id',cardId)).error?.message).toBeUndefined();
    await Promise.all([admin.auth.signOut(),user.auth.signOut()]);
  }
});
