import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pages } from '../src/pages/entries.js';
import { mockCatalog, demoCards } from './helpers/demo-catalog.js';
test.beforeEach(async ({page}) => mockCatalog(page));

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

test('catalogue filters preserve state, show EUR prices and an empty state', async ({page})=>{
 await page.goto('/cards/');
 await expect(page.locator('.catalog-card')).toHaveCount(demoCards.length);
 await page.getByLabel('Free or paid').selectOption('paid');
 await expect(page.locator('.catalog-card')).toHaveCount(3);
 await expect(page.locator('.catalog-card').first()).toContainText('€4.50');
 await expect(page.locator('.catalog-card').first()).toContainText('Currently unavailable');
 await page.getByRole('link',{name:'A beautiful new chapter',exact:true}).click();
 await expect(page.getByRole('button',{name:'Currently unavailable'})).toBeDisabled();
 await page.getByRole('link',{name:'← Back to your cards'}).click();
 await expect(page.getByLabel('Free or paid')).toHaveValue('paid');
 await expect(page.locator('.catalog-card')).toHaveCount(3);
 await page.getByLabel('Search cards').fill('no matching card');
 await expect(page.getByRole('heading',{name:'No matching cards'})).toBeVisible();
});

test('per-card personalization validates safely and retains input across errors',async({page})=>{
 await page.goto('/card-editor/?id='+demoCards[1].id);
 await page.getByRole('button',{name:'Validate demo preview'}).click();
 const recipient=page.getByLabel('Recipient name');
 await expect(recipient).toHaveAttribute('aria-invalid','true');
 await recipient.fill('<img src=x onerror=alert(1)>');
 await page.getByLabel('Your message').fill('A thoughtful little message.');
 await expect(page.getByRole('spinbutton',{name:'Age Optional'})).toBeVisible();
 await expect(page.getByLabel('Favourite adventures')).toBeVisible();
 await page.getByRole('button',{name:'Validate demo preview'}).click();
 await expect(page.locator('main')).toContainText('Demo preview validated.');
 const svg=await page.locator('.design-preview img').getAttribute('src');
 expect(decodeURIComponent(svg)).toContain('&lt;img');
 await expect(page.locator('.design-preview script')).toHaveCount(0);
 await page.getByRole('button',{name:'Save my draft'}).click();
 await expect(page.locator('main')).toContainText('Sign in to save.');
 await expect(recipient).toHaveValue('<img src=x onerror=alert(1)>');
 await page.reload();
 await expect(recipient).toHaveValue('<img src=x onerror=alert(1)>');
 await page.goto('/card-editor/?id='+demoCards[4].id);
 await expect(page.getByLabel('Humour style')).toBeVisible();
 await expect(page.getByLabel('Favourite adventures')).toHaveCount(0);
});

test('missing artwork falls back to its own design and long text stays responsive',async({page})=>{
 await page.route('**/demo-cards/*',route=>route.abort());
 await page.goto('/cards/');
 await expect(page.locator('.catalog-card')).toHaveCount(demoCards.length);
 await page.locator('.catalog-card img').evaluateAll(images=>images.forEach(image=>image.loading='eager'));
 await expect(page.locator('.catalog-card .design-preview')).toHaveCount(demoCards.length);
 await page.goto('/card-editor/?id='+demoCards[0].id);
 await page.setViewportSize({width:375,height:850});
 await page.getByLabel('Recipient name').fill('A'.repeat(60));
 await page.getByLabel('Your message').fill('A long thoughtful message. '.repeat(8));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for (const route of ['/', '/cards/', '/card-editor/', '/login/', '/admin/card-edit/', '/admin/cards/']) {
  test(`accessible component composition: ${route}`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
  });
}

test('direct admin URLs require authentication', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/admin/cards/');
  await expect(page.getByRole('heading', { name: 'Administrator sign-in required' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create card' })).toHaveCount(0);
});

test('catalogue uses its explicit primary image and falls back when none exists',async({page})=>{
 let empty=false;
 await page.route('**/rest/v1/rpc/get_card_catalogue',route=>route.fulfill({json:demoCards.map(c=>({...c,preview_assets:empty?[]:c.preview_assets.map(a=>({...a,is_primary:a.image_type==='preview'}))}))}));
 await page.goto('/cards/');
 await expect(page.locator('.catalog-card').first().locator('img')).toHaveAttribute('src','/demo-cards/birthday-type-preview.svg');
 empty=true;await page.reload();
 await expect(page.locator('.catalog-card .design-preview')).toHaveCount(demoCards.length);
});
