import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pages } from '../src/pages/entries.js';

test('all page shells render without errors, hidden admin links, or mobile overflow', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const entry of pages) {
      await page.goto(entry.url);
      await expect(page.locator('main h1')).toHaveCount(1);
      await expect(page.locator('footer')).toHaveCount(1);
      await expect(page.locator('body > #toast-container')).toHaveCount(1);
      await expect(page.locator('header a[href^="/admin"]')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${entry.url} at ${width}px`).toBe(true);
      if (entry.id === 'home') await page.screenshot({ path: test.info().outputPath(`home-${width}.png`), fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});

test('public navigation and keyboard-operated mobile menu use document navigation', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link')).toHaveText(['Home', 'Cards', 'Login', 'Register']);
  await nav.getByRole('link', { name: 'Cards', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await nav.getByRole('link', { name: 'Cards', exact: true }).click();
  await expect(page).toHaveURL('/cards/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find their kind of card.');
});

test('sample catalogue filters and unavailable paid cards communicate their state', async ({ page }) => {
  await page.goto('/cards/');
  await expect(page.locator('.catalog-card')).toHaveCount(6);
  await page.getByLabel('Occasion', { exact: false }).selectOption('Birthday');
  await expect(page.locator('.catalog-card')).toHaveCount(3);
  await page.getByLabel('Style', { exact: false }).selectOption('Minimal');
  await expect(page.locator('.catalog-card')).toHaveCount(1);
  await expect(page.locator('.catalog-card')).toContainText('€3.50');
  await expect(page.locator('.catalog-card')).toContainText('Currently unavailable');
  await expect(page.getByRole('button', { name: 'Personalization unavailable' })).toBeDisabled();
  await page.getByLabel('Search sample cards').fill('no matching card');
  await expect(page.getByRole('heading', { name: 'No matching sample cards' })).toBeVisible();
});

test('personalization validates, renders text safely, announces updates and restores dialog focus', async ({ page }) => {
  await page.goto('/card-editor/?id=sample-lilac');
  await page.getByRole('button', { name: 'Update preview' }).click();
  const recipient = page.getByLabel('Recipient name');
  await expect(recipient).toHaveAttribute('aria-invalid', 'true');
  await expect(recipient).toBeFocused();
  await recipient.fill('<img src=x onerror=alert(1)>');
  await page.getByLabel('Custom message').fill('A thoughtful little message.');
  await expect(page.locator('.greeting-message')).toHaveText('A thoughtful little message.');
  await expect(page.locator('.greeting-recipient')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.greeting-content img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Update preview' }).click();
  await expect(page.locator('#toast-container [role="status"]')).toContainText('Nothing has been saved');
  const reset = page.getByRole('button', { name: 'Reset sample form' });
  await reset.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(reset).toBeFocused();
  await expect(recipient).not.toHaveValue('');
  await reset.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset form', exact: true }).click();
  await expect(recipient).toHaveValue('');
  await expect(reset).toBeFocused();
  await expect(page.locator('body > #toast-container')).toHaveCount(1);
});

for (const route of ['/', '/cards/', '/card-editor/', '/login/', '/admin/card-edit/', '/admin/cards/']) {
  test(`accessible component composition: ${route}`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
  });
}

test('reduced motion disables skeleton animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/admin/cards/');
  expect(await page.locator('.skeleton').first().evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
});
