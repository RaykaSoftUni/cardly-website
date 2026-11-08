import { test, expect } from '@playwright/test';
import { mockCatalog, demoCards } from './helpers/demo-catalog.js';
test.beforeEach(async ({ page }) => mockCatalog(page));

test('HTML has a styled loading shell before JavaScript arrives', async ({ page }) => {
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    let release;
    const ready = new Promise(resolve => { release = resolve; });
    await page.route('**/assets/*.js', async route => { await ready; await route.continue(); });
    await page.goto('/cards/', { waitUntil: 'commit' });
    await expect(page.locator('.page-loading')).toBeVisible();
    await expect.poll(() => page.locator('.site-header').evaluate(el => Math.round(el.getBoundingClientRect().height))).toBe(width < 768 ? 77 : 93);
    const before = await page.locator('.brand').boundingBox();
    expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(250, 248, 244)');
    await expect(page.locator('main')).not.toContainText('This page is a placeholder');
    release();
    await expect(page.locator('.catalog-card')).toHaveCount(demoCards.length);
    await expect(page.locator('main')).not.toHaveAttribute('aria-busy', 'true');
    const after = await page.locator('.site-header .brand').boundingBox();
    expect(Math.abs(before.x - after.x)).toBeLessThan(1);
    expect(Math.abs(before.y - after.y)).toBeLessThan(1);
    await page.unroute('**/assets/*.js');
  }
});

test('slow data keeps the shell stable until the complete catalog is ready', async ({ page }) => {
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  await page.route('**/rest/v1/rpc/get_card_catalogue', async route => { await ready; await route.fallback(); });
  await page.goto('/cards/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.page-loading')).toBeVisible();
  const header = await page.locator('.site-header').boundingBox();
  expect(await page.locator('.site-footer').evaluate(el => el.getBoundingClientRect().top >= innerHeight)).toBe(true);
  await expect(page.locator('main h1')).toHaveCount(0);
  release();
  await expect(page.getByRole('heading', { name: 'Find their kind of card.' })).toBeVisible();
  await expect(page.locator('.catalog-card')).toHaveCount(demoCards.length);
  await expect(page.locator('.page-loading')).toHaveCount(0);
  expect(await page.locator('.site-header').boundingBox()).toEqual(header);
});

test('short and long pages keep the same horizontal alignment with ordinary navigation', async ({ page }) => {
  await page.goto('/cards/');
  await expect(page.locator('.catalog-card')).toHaveCount(demoCards.length);
  const before = await page.locator('.site-header .brand').boundingBox();
  await page.evaluate(() => { window.documentMarker = 'catalog-document'; });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Good to see you.' })).toBeVisible();
  const after = await page.locator('.site-header .brand').boundingBox();
  expect(after.x).toBe(before.x);
  expect(await page.evaluate(() => window.documentMarker)).toBeUndefined();
});

test('reduced motion disables loading shimmer and the content reveal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  await page.route('**/rest/v1/rpc/get_card_catalogue', async route => { await ready; await route.fallback(); });
  await page.goto('/cards/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.page-loading')).toBeVisible();
  expect(await page.locator('.skeleton').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  release();
  await expect(page.locator('.catalog-card')).toHaveCount(demoCards.length);
  expect(await page.locator('main').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});

test('admin navigation waits for verification without flashing guest links',async({page})=>{
 const {mockAdmin}=await import('./helpers/admin.js');
 await mockAdmin(page);
 let release;const ready=new Promise(resolve=>{release=resolve;});
 await page.route('**/auth/v1/user',async route=>{await ready;await route.fallback();});
 await page.goto('/admin/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.page-loading')).toBeVisible();
 const header=await page.locator('.site-header').boundingBox();
 await expect(page.locator('.site-header nav')).toHaveCount(0);
 release();
 await expect(page.getByRole('heading',{name:'Administration workspace'})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Admin',exact:true})).toBeVisible();
 expect(await page.locator('.site-header').boundingBox()).toEqual(header);
});

test('failed data loading clears the busy state and shows a usable error page',async({page})=>{
 await page.route('**/rest/v1/rpc/get_card_catalogue',route=>route.fulfill({status:500,json:{message:'Temporary test failure'}}));
 await page.goto('/cards/');
 await expect(page.getByRole('heading',{name:'We could not load this page.'})).toBeVisible();
 await expect(page.locator('main')).not.toHaveAttribute('aria-busy','true');
 await expect(page.locator('.page-loading')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Try again'})).toBeVisible();
});
