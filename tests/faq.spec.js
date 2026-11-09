import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('FAQ works without authentication or backend access and exposes keyboard disclosures', async ({ page }) => {
  const backendRequests = [];
  await page.route('**/auth/v1/**', route => { backendRequests.push(route.request().url()); return route.abort(); });
  await page.route('**/rest/v1/**', route => { backendRequests.push(route.request().url()); return route.abort(); });
  await page.goto('/faq/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Frequently asked questions');
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'FAQ', exact: true })).toHaveAttribute('href', '/faq/');
  const buttons = page.locator('.faq-question');
  expect(await buttons.count()).toBeGreaterThan(30);
  for (const button of await buttons.all()) {
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toBeVisible();
    await expect(page.locator('#' + await button.getAttribute('aria-controls'))).toBeHidden();
  }
  const question = page.getByRole('button', { name: 'Can I purchase paid cards now?' });
  const answer = page.locator('#' + await question.getAttribute('aria-controls'));
  await question.focus();
  await page.keyboard.press('Enter');
  await expect(question).toHaveAttribute('aria-expanded', 'true');
  await expect(answer).toContainText('Payments are not implemented');
  await expect(answer).toBeVisible();
  await page.keyboard.press('Space');
  await expect(question).toHaveAttribute('aria-expanded', 'false');
  await expect(answer).toBeHidden();
  await expect(question).toBeFocused();
  expect(backendRequests).toEqual([]);
});

test('FAQ topic links support direct loads, mobile layout and accessible expanded content', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await page.goto('/faq/#privacy');
  await expect(page.getByRole('heading', { name: 'Privacy and security', exact: true })).toBeFocused();
  await page.getByRole('navigation', { name: 'FAQ topics' }).getByRole('link', { name: 'Downloads and sharing' }).click();
  await expect(page).toHaveURL('/faq/#downloads');
  await expect(page.getByRole('heading', { name: 'Downloads and sharing', exact: true })).toBeFocused();
  for (const button of await page.locator('.faq-question').all()) await button.click();
  await expect(page.locator('#faq-downloads-1')).toContainText('Supported free designs export as high-resolution 1500 × 2000 PNG files');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});
