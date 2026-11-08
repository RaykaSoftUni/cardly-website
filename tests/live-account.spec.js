import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
test.use({ trace: 'off', screenshot: 'off' });
const password = process.env.CARDLY_USER_TEST_PASSWORD;

test('live account profile ownership, permitted columns and UI', async ({ page }) => {
  test.skip(!password, 'Explicit demo user test password required.');
  const env = loadEnv('development', process.cwd());
  const makeClient = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const owner = makeClient(), other = makeClient(), visitor = makeClient();
  const ownLogin = await owner.auth.signInWithPassword({ email: 'alex.demo@example.test', password });
  const otherLogin = await other.auth.signInWithPassword({ email: 'sam.demo@example.test', password });
  expect(ownLogin.error?.message).toBeUndefined();
  expect(otherLogin.error?.message).toBeUndefined();
  const id = ownLogin.data.user.id;
  const original = await owner.from('profiles').select('display_name,avatar_url').eq('id',id).single();
  expect(original.error?.message).toBeUndefined();
  try {
    expect((await visitor.from('profiles').select('id')).error).toBeTruthy();
    const isolated = await other.from('profiles').select('display_name').eq('id',id);
    expect(isolated.error?.message).toBeUndefined(); expect(isolated.data).toEqual([]);
    const forbidden = await other.from('profiles').update({ display_name: 'Forbidden edit' }).eq('id',id).select('display_name');
    expect(forbidden.error?.message).toBeUndefined(); expect(forbidden.data).toEqual([]);
    expect((await owner.from('profiles').update({ id: otherLogin.data.user.id }).eq('id',id)).error).toBeTruthy();
    expect((await owner.from('profiles').update({ created_at: new Date().toISOString() }).eq('id',id)).error).toBeTruthy();
    expect((await owner.from('user_roles').update({ role: 'admin' }).eq('user_id',id)).error).toBeTruthy();
    await page.goto('/login/?next=/account/');
    await page.getByLabel('Email address').fill('alex.demo@example.test');
    await page.getByLabel('Password', { exact: false }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL('/account/', { timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Your account', exact: true })).toBeVisible();
    await page.getByLabel('Display name').fill('Account smoke verification');
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await expect(page.locator('main')).toContainText('Your profile has been updated.');
    expect((await owner.from('profiles').select('display_name').eq('id',id).single()).data?.display_name).toBe('Account smoke verification');
    await page.reload();
    await expect(page.getByLabel('Display name')).toHaveValue('Account smoke verification');
    await expect(page.locator('header a[href="/admin/"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Log out of this account' }).click();
    await expect(page).toHaveURL('/');
    await page.goto('/account/');
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  } finally {
    const restored = await owner.from('profiles').update({ display_name: original.data.display_name }).eq('id',id);
    expect(restored.error?.message).toBeUndefined();
    await owner.auth.signOut({ scope: 'local' });
    await other.auth.signOut({ scope: 'local' });
  }
});
