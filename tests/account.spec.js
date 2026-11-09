import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockAdmin, adminId, png } from './helpers/admin.js';

async function mockAccount(page) {
  const state = await mockAdmin(page, 'user');
  state.profile = { display_name: 'Alex', avatar_path: null };
  state.profileWrites = [];
  state.authWrites = [];
  state.failProfile = false;
  state.failPassword = false;
  state.uploadLimit = 5242880;
  state.failUpload = false;
  await page.route('**/rpc/user_file_upload_settings', route => route.fulfill({json:{max_bytes:state.uploadLimit}}));
  const user = { id: adminId, email: 'alex@example.test', created_at: '2026-01-02T00:00:00Z', aud: 'authenticated', user_metadata: { role: 'admin' }, app_metadata: { provider: 'email' } };
  await page.route('**/auth/v1/user', route => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON();
      state.authWrites.push(body);
      if (state.failPassword) return route.fulfill({ status: 422, headers: { 'x-supabase-api-version': '2024-01-01', 'access-control-expose-headers': 'X-Supabase-Api-Version' }, json: { code: 'weak_password', msg: 'Password rejected' } });
    }
    return route.fulfill({ json: user });
  });
  await page.route('**/rest/v1/profiles*', route => {
    expect(new URL(route.request().url()).searchParams.get('id')).toBe(`eq.${adminId}`);
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON();
      state.profileWrites.push(body);
      if (state.failProfile) return route.fulfill({ status: 400, json: { code: '23514', message: 'validation failed' } });
      Object.assign(state.profile, body);
    }
    return route.fulfill({ json: state.profile });
  });
  await page.route('**/functions/v1/user-file-upload', async route => {
    if(state.failUpload)return route.fulfill({status:400,json:{error:'Upload failed. Previous image kept.'}});
    const body=route.request().postData()||'';
    if(body.includes('name="action"')&&body.includes('remove'))state.profile.avatar_path=null;
    else {state.profile.avatar_path=adminId+'/avatar/'+crypto.randomUUID()+'.png';state.uploads.push(state.profile.avatar_path);}
    return route.fulfill({json:{path:state.profile.avatar_path,cleanupFailed:false}});
  });
  await page.route('**/auth/v1/logout*', route => route.fulfill({ status: 204 }));
  return state;
}

test('account requires a session and login provides recovery', async ({ page }) => {
  await page.goto('/account/');
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  await expect(page.getByLabel('Display name')).toHaveCount(0);
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/login/?next=/account/');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page).toHaveURL('/forgot-password/');
});

test('profile shows safe metadata, preserves errors and writes only permitted own fields', async ({ page }) => {
  const state = await mockAccount(page);
  await page.goto('/account/?user_id=another-user');
  await expect(page.getByLabel('Display name')).toHaveValue('Alex');
  await expect(page.locator('main')).toContainText('alex@example.test');
  await expect(page.locator('main')).not.toContainText(adminId);
  await expect(page.locator('header a[href="/admin/"]')).toHaveCount(0);
  await expect(page.locator('main dd').last()).toHaveText('User');
  state.failProfile = true;
  await page.getByLabel('Display name').fill('<script>Safe name</script>');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.locator('.validation-summary').first()).toContainText('could not be completed');
  await expect(page.getByLabel('Display name')).toHaveValue('<script>Safe name</script>');
  state.failProfile = false;
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your profile has been updated.' })).toBeVisible();
  expect(state.profileWrites).toEqual([{ display_name: '<script>Safe name</script>' }, { display_name: '<script>Safe name</script>' }]);
  await expect(page.locator('main script')).toHaveCount(0);
});

test('password mismatch and Auth rejection preserve input; success clears secrets', async ({ page }) => {
  const state = await mockAccount(page);
  await page.goto('/account/');
  await page.getByLabel('New password', { exact: false }).first().fill('A test password 42');
  await page.getByLabel('Confirm new password').fill('Different password');
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await expect(page.getByLabel('Confirm new password')).toHaveAttribute('aria-invalid', 'true');
  expect(state.authWrites).toHaveLength(0);
  await page.getByLabel('Confirm new password').fill('A test password 42');
  state.failPassword = true;
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await expect(page.locator('main')).toContainText('Choose a different, stronger password');
  await expect(page.getByLabel('Confirm new password')).toHaveValue('A test password 42');
  state.failPassword = false;
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your password has been changed.' })).toBeVisible();
  await expect(page.getByLabel('Confirm new password')).toHaveValue('');
  await expect(page.locator('input[name="password"]')).toHaveValue('');
  expect(state.authWrites.at(-1)).toMatchObject({ password: 'A test password 42' });
  expect(state.profileWrites).toHaveLength(0);
});

test('recovery requests use Auth, same-origin reset URL and neutral feedback', async ({ page }) => {
  let request;
  await page.route('**/auth/v1/recover*', route => { request = route.request(); return route.fulfill({ json: {} }); });
  await page.goto('/forgot-password/');
  await page.getByLabel('Email address').fill('someone@example.test');
  await page.getByRole('button', { name: 'Send reset email' }).click();
  await expect(page.locator('main')).toContainText('If an account exists');
  expect(request.postDataJSON().email).toBe('someone@example.test');
  expect(new URL(request.url()).searchParams.get('redirect_to')).toBe('http://127.0.0.1:4174/reset-password/');
  await page.goto('/reset-password/');
  await expect(page.getByRole('link', { name: 'Request a new reset email' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset password', exact: true })).toHaveCount(0);
});

test('recovery callback validates its session and resets through Auth', async ({ page }) => {
  const state = await mockAccount(page);
  await page.addInitScript(() => localStorage.clear());
  const payload = Buffer.from(JSON.stringify({ sub: adminId, exp: Math.floor(Date.now()/1000)+3600, role: 'authenticated' })).toString('base64url');
  await page.goto(`/reset-password/#access_token=test.${payload}.signature&refresh_token=recovery-test-only&expires_in=3600&token_type=bearer&type=recovery`);
  await expect(page.getByRole('button', { name: 'Reset password', exact: true })).toBeVisible();
  await expect.poll(() => new URL(page.url()).hash).toBe('');
  await page.locator('input[name="password"]').fill('Reset test password 42');
  await page.getByLabel('Confirm new password').fill('Reset test password 42');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.locator('main')).toContainText('Your password has been changed.');
  expect(state.authWrites).toHaveLength(1);
  expect(state.authWrites[0]).toMatchObject({ password: 'Reset test password 42' });
  await expect(page.getByRole('link', { name: 'Go to My Cards' })).toBeVisible();
});

test('an expired recovery link cannot reuse an existing signed-in session', async ({ page }) => {
  await mockAccount(page);
  await page.goto('/reset-password/#error=access_denied&error_code=otp_expired&error_description=Expired');
  await expect(page.getByRole('link', { name: 'Request a new reset email' })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});

test('avatar validates, previews, uploads unique own paths, replaces and confirms removal', async ({ page }) => {
  const state = await mockAccount(page);
  await page.goto('/account/');
  const file = page.locator('input[name="avatar"]');
  await file.setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.locator('main')).toContainText('Choose a JPEG, PNG or WebP');
  expect(state.uploads).toHaveLength(0);
  await file.setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByAltText('Your profile image')).toHaveAttribute('src', /^blob:/);
  await page.getByRole('button', { name: 'Save profile image', exact: true }).click();
  await expect(page.locator('main')).toContainText('Profile image saved.');
  const oldPath = state.profile.avatar_path;
  expect(oldPath).toMatch(new RegExp(`^${adminId}/avatar/[a-f0-9-]+\\.png$`));
  await file.setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: 'Save profile image', exact: true }).click();
  await expect.poll(() => state.profile.avatar_path).not.toBe(oldPath);
  await expect(page.getByRole('button', { name: 'Save profile image', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Remove profile image', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(state.profile.avatar_path).toBeTruthy();
  await page.getByRole('button', { name: 'Remove profile image', exact: true }).click();
  await page.getByRole('button', { name: 'Remove image', exact: true }).click();
  await expect(page.locator('main')).toContainText('Profile image removed.');
  expect(state.profile.avatar_path).toBeNull();
  await expect(page.getByRole('img', { name: 'Default profile image' })).toBeVisible();
});

test('configured avatar limit rejects oversized input and failed replacement preserves the saved image', async ({ page }) => {
  const state = await mockAccount(page);
  state.uploadLimit = 1024;
  await page.goto('/account/');
  const file = page.locator('input[name="avatar"]');
  await file.setInputFiles({name:'large.png',mimeType:'image/png',buffer:Buffer.concat([png,Buffer.alloc(2048)])});
  await expect(page.locator('main')).toContainText('Choose an image no larger than');
  expect(state.uploads).toHaveLength(0);
  await file.setInputFiles({name:'valid.png',mimeType:'image/png',buffer:png});
  await page.getByRole('button',{name:'Save profile image',exact:true}).click();
  await expect(page.locator('main')).toContainText('Profile image saved.');
  const saved = state.profile.avatar_path;
  state.failUpload = true;
  await file.setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:png});
  await page.getByRole('button',{name:'Save profile image',exact:true}).click();
  await expect(page.locator('main')).toContainText('Upload failed. Previous image kept.');
  expect(state.profile.avatar_path).toBe(saved);
  expect(state.uploads).toHaveLength(1);
});

test('account works before the avatar_path migration is applied', async ({ page }) => {
  await mockAccount(page);
  await page.route('**/rest/v1/profiles*',route=>{
    if(new URL(route.request().url()).searchParams.get('select').includes('avatar_path'))return route.fulfill({status:400,json:{code:'42703',message:'column does not exist'}});
    return route.fulfill({json:{display_name:'Alex'}});
  });
  await page.route('**/rpc/account_avatar_available',route=>route.fulfill({json:false}));
  await page.goto('/account/');
  await expect(page.getByLabel('Display name')).toHaveValue('Alex');
  await expect(page.getByRole('button',{name:'Change password',exact:true})).toBeEnabled();
});

test('logout ends the local session and leaves the account page', async ({ page }) => {
  await mockAccount(page);
  await page.goto('/account/');
  await page.getByRole('button', { name: 'Log out of this account' }).click();
  await expect(page).toHaveURL('/');
  const stored = await page.evaluate(() => Object.keys(localStorage).filter(k => k.endsWith('-auth-token')));
  expect(stored).toEqual([]);
});

for (const width of [1440,375]) test(`account forms are accessible and fit ${width}px`, async ({ page }) => {
  await mockAccount(page);
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/account/');
  await expect(page.getByRole('heading', { name: 'Your account', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('profile and password remain usable when avatar storage is not configured', async ({ page }) => {
  await mockAccount(page);
  await page.route('**/rest/v1/rpc/account_avatar_available', route => route.fulfill({ status: 404, json: { code: 'PGRST202', message: 'Missing migration' } }));
  await page.goto('/account/');
  await expect(page.getByLabel('Display name')).toHaveValue('Alex');
  await expect(page.getByRole('button', { name: 'Change password', exact: true })).toBeEnabled();
  await expect(page.locator('main')).toContainText('Profile image uploads are currently unavailable.');
  await expect(page.getByRole('button', { name: 'Save profile image', exact: true })).toHaveCount(0);
});
