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
  await expect(page.getByRole('heading', { name: 'Images and assets', exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('live-admin-editor.png'), fullPage: true });
  await page.setViewportSize({ width: 375, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('live Storage upload, replacement, private visibility and cleanup', async () => {
  test.skip(!password || !process.env.CARDLY_USER_TEST_PASSWORD, 'Explicit admin and user test passwords required.');
  const env = loadEnv('development', process.cwd());
  const client = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const admin = client(), user = client(), visitor = client();
  const login = await admin.auth.signInWithPassword({ email: 'admin.demo@example.test', password });
  expect(login.error?.message).toBeUndefined();
  const regular = await user.auth.signInWithPassword({ email: 'alex.demo@example.test', password: process.env.CARDLY_USER_TEST_PASSWORD });
  expect(regular.error?.message).toBeUndefined();
  const nonce = crypto.randomUUID();
  const paths = [`admin-smoke/${nonce}.png`, `admin-smoke/${nonce}-replacement.png`];
  let cardId, imageId;
  const rpc = async (name, args) => { const { data, error } = await admin.rpc(name, args); expect(error?.message).toBeUndefined(); return data; };
  try {
    const card = await rpc('admin_save_card_data', { p_entity: 'cards', p_data: { title: 'Temporary Storage verification', slug: `storage-check-${nonce}`, status: 'draft' } });
    cardId = card.id;
    const forbidden = await user.storage.from('card-assets').upload(`admin-smoke/${nonce}-forbidden.png`, png, { contentType: 'image/png' });
    expect(forbidden.error).toBeTruthy();
    const wrongType = await admin.storage.from('card-assets').upload(`admin-smoke/${nonce}.txt`, 'not an image', { contentType: 'text/plain' });
    expect(wrongType.error).toBeTruthy();
    const upload = await admin.storage.from('card-assets').upload(paths[0], png, { contentType: 'image/png', upsert: false });
    expect(upload.error?.message).toBeUndefined();
    const image = await rpc('admin_save_card_data', { p_entity: 'card_images', p_data: { card_id: cardId, storage_path: paths[0], image_type: 'preview', alt_text: 'Temporary pink pixel used for authorized Storage verification' } });
    imageId = image.id;
    const hidden = await visitor.storage.from('card-assets').download(paths[0]);
    expect(hidden.error).toBeTruthy();
    const owned = await admin.storage.from('card-assets').download(paths[0]);
    expect(owned.error?.message).toBeUndefined();
    expect(Buffer.from(await owned.data.arrayBuffer())).toEqual(png);
    const replacement = await admin.storage.from('card-assets').upload(paths[1], png, { contentType: 'image/png', upsert: false });
    expect(replacement.error?.message).toBeUndefined();
    await rpc('admin_save_card_data', { p_entity: 'card_images', p_id: imageId, p_data: { storage_path: paths[1] } });
    expect(await rpc('admin_asset_deletable', { p_path: paths[0] })).toBe(true);
    expect(await rpc('admin_asset_deletable', { p_path: paths[1] })).toBe(false);
    await rpc('admin_remove_configuration', { p_entity: 'card_images', p_id: imageId }); imageId = null;
    const removal = await admin.storage.from('card-assets').remove(paths);
    expect(removal.error?.message).toBeUndefined();
    expect((await admin.storage.from('card-assets').download(paths[1])).error).toBeTruthy();
  } finally {
    if (imageId) await admin.rpc('admin_remove_configuration', { p_entity: 'card_images', p_id: imageId });
    await admin.storage.from('card-assets').remove(paths);
    if (cardId) { const { error } = await admin.from('cards').delete().eq('id', cardId); expect(error?.message).toBeUndefined(); }
    await Promise.all([admin.auth.signOut(), user.auth.signOut()]);
  }
});
