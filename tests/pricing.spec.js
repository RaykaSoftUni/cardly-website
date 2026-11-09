import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockCatalog } from './helpers/demo-catalog.js';

test('public pricing renders without backend access and states current limits', async ({ page }) => {
  const requests = [];
  await page.route('**/auth/v1/**', route => { requests.push(route.request().url()); return route.abort(); });
  await page.route('**/rest/v1/**', route => { requests.push(route.request().url()); return route.abort(); });
  await page.goto('/pricing/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Simple pricing for meaningful digital cards');
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Pricing', exact: true })).toHaveAttribute('aria-current', 'page');
  const free = page.getByRole('article', { name: 'Free Cards', exact: true });
  const premium = page.getByRole('article', { name: 'Premium Cards', exact: true });
  await expect(free).toContainText('€0');
  await expect(free).toContainText('No payment required');
  await expect(premium).toContainText('Currently unavailable');
  await expect(premium).toContainText('Intended EUR prices');
  await expect(page.getByText('No cards are currently available for purchase.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: /buy now|checkout/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /buy now|checkout/i })).toHaveCount(0);
  expect(requests).toEqual([]);
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  }
});

test('pricing navigation and catalogue actions open the intended filters', async ({ page }) => {
  await mockCatalog(page);
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Pricing', exact: true }).click();
  await expect(page).toHaveURL('/pricing/');
  await page.getByRole('link', { name: 'Browse Free Cards', exact: true }).click();
  await expect(page.getByLabel('Free or paid')).toHaveValue('free');
  await expect(page.getByRole('combobox', { name: 'Availability', exact: true })).toHaveValue('true');
  await page.goto('/pricing/');
  await page.getByRole('link', { name: 'Explore Premium Designs', exact: true }).click();
  await expect(page.getByLabel('Free or paid')).toHaveValue('paid');
  await page.goto('/pricing/');
  await page.setViewportSize({ width: 375, height: 850 });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Pricing', exact: true })).toBeVisible();
});
