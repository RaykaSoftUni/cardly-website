import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockAdmin, cardId, png } from './helpers/admin.js';

test('a forged client admin hint cannot grant access to a regular user', async ({ page }) => {
  const state = await mockAdmin(page, 'user');
  await page.goto('/admin/card-edit/?id=' + cardId);
  await expect(page.getByRole('heading', { name: 'Administrator access required' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save card', exact: true })).toHaveCount(0);
  expect(state.reads).toEqual([]);
  expect(state.writes).toEqual([]);
});
test('admin card edits preserve values after errors and enforce paid UI state', async ({ page }) => {
  const state = await mockAdmin(page);
  await page.goto('/admin/card-edit/?id=' + cardId);
  await page.getByLabel('Card title').fill('A changed title');
  await page.getByLabel('Unique slug', { exact: false }).fill('taken');
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('already in use');
  await expect(page.getByLabel('Card title')).toHaveValue('A changed title');
  await expect(page.getByLabel('Unique slug', { exact: false })).toHaveValue('taken');
  await page.getByLabel('Unique slug', { exact: false }).fill('changed-title');
  await page.getByLabel('Pricing type').selectOption('paid');
  await expect(page.getByLabel('Available', { exact: false })).toBeDisabled();
  await page.getByLabel('Price in EUR').fill('4.50');
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await expect(page.locator('.admin-feedback')).toContainText('Card saved.');
  expect(state.cards[0]).toMatchObject({ pricing_type: 'paid', price: 4.5, is_available: false, currency: 'EUR' });
  await page.goto('/admin/cards/');
  await expect(page.getByRole('link', { name: 'Create card' })).toBeVisible();
  await expect(page.locator('table')).toContainText('€4.50');
});
test('template revisions, field ordering and confirmed removal use authorized operations', async ({ page }) => {
  const state = await mockAdmin(page);
  await page.goto('/admin/card-edit/?id=' + cardId);
  await page.getByLabel('Layout configuration').fill('{"regions":[{"field":"recipient_name","x":70,"y":200}],"image_regions":[]}');
  await page.getByRole('button', { name: 'Save template revision' }).click();
  await expect(page.locator('.admin-feedback')).toContainText('version 2');
  await page.getByRole('button', { name: 'Move Message up', exact: true }).click();
  await expect(page.locator('.admin-feedback')).toContainText('Fields reordered');
  expect(state.personalization_fields.find(f => f.label === 'Message').sort_order).toBe(0);
  await page.getByRole('button', { name: 'Remove Recipient', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(state.personalization_fields).toHaveLength(2);
  await page.getByRole('button', { name: 'Remove Recipient', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.locator('.admin-feedback')).toContainText('Field removed.');
  expect(state.personalization_fields).toHaveLength(1);
});
test('taxonomy edits and deactivation preserve user input and require confirmation', async ({ page }) => {
  const state = await mockAdmin(page);
  await page.goto('/admin/categories/?type=occasions');
  await expect(page.getByRole('heading', { name: 'Manage occasions' })).toBeVisible();
  await page.getByLabel('Name', { exact: false }).fill('Wedding');
  await page.getByLabel('Unique slug', { exact: false }).fill('wedding');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('table')).toContainText('Wedding');
  await page.locator('tr').filter({ hasText: 'Wedding' }).getByRole('button', { name: 'Deactivate', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('.admin-feedback')).toContainText('Visibility updated.');
  expect(state.occasions.find(o => o.name === 'Wedding').is_active).toBe(false);
});
test('user administration hides self-role actions and support data stays metadata-only', async ({ page }) => {
  const state = await mockAdmin(page);
  await page.goto('/admin/users/');
  await expect(page.locator('table')).toContainText('Your role cannot be changed here.');
  await page.getByRole('button', { name: 'Make reader@example.test admin' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('.admin-feedback')).toContainText('User role updated');
  expect(state.users[1].role).toBe('admin');
  await page.goto('/admin/?view=generations');
  await expect(page.getByRole('heading', { name: 'Generation metadata' })).toBeVisible();
  await expect(page.locator('table')).toContainText('Snapshot title');
  await expect(page.locator('table')).not.toContainText('password');
});
test('asset upload validates bytes, stores a unique path and saves alt text', async ({ page }) => {
  const state = await mockAdmin(page);
  await page.goto('/admin/card-edit/?id=' + cardId);
  await page.getByLabel('Image description / alt text').fill('Pink flowers around a birthday greeting');
  await page.getByLabel('Image file').setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await page.getByRole('button', { name: 'Upload image', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('contents do not match');
  expect(state.uploads).toHaveLength(0);
  await page.getByLabel('Image file').setInputFiles({ name: 'flower.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: 'Upload image', exact: true }).click();
  await expect(page.locator('.admin-feedback')).toContainText('Image saved.');
  expect(state.uploads).toHaveLength(1);
  expect(state.card_images[0].storage_path).toMatch(/^cards\/.+\/[a-f0-9-]+\.png$/);
  expect(state.card_images[0].alt_text).toContain('Pink flowers');
});
test('role revocation removes open admin controls before a write', async ({ page }) => {
  const state = await mockAdmin(page);
  await page.goto('/admin/card-edit/?id=' + cardId);
  await expect(page.getByRole('button', { name: 'Save card', exact: true })).toBeVisible();
  state.role = 'user';
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Administrator access required' })).toBeVisible();
  expect(state.writes).toEqual([]);
});
test('authorized administration stays accessible and responsive', async ({ page }) => {
  await mockAdmin(page);
  for (const url of ['/admin/', '/admin/cards/', '/admin/card-edit/?id=' + cardId, '/admin/categories/', '/admin/users/', '/admin/?view=generations']) {
    await page.goto(url);
    await expect(page.locator('main h1')).toHaveCount(1);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    await page.setViewportSize({ width: 375, height: 850 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.goto('/admin/card-edit/?id=' + cardId);
  await page.screenshot({ path: test.info().outputPath('admin-editor-desktop.png'), fullPage: true });
});
