import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockCatalog, demoCards } from './helpers/demo-catalog.js';
import { publicDesignKey } from '../src/data/card-designs.js';
const cats = demoCards.filter(c => ['disco-whiskers','cake-catnaps'].includes(c.design_key));
test.beforeEach(async ({page}) => mockCatalog(page));

test('new demo designs resolve only from matching known public identifiers',()=>{
 for (const card of cats) {
  expect(publicDesignKey({...card,design_key:null})).toBe(card.design_key);
  expect(publicDesignKey({...card,design_key:null,slug:'different-card'})).toBeNull();
  expect(publicDesignKey({...card,design_key:null,preview_assets:[{storage_path:'cards/unrelated.png'}]})).toBeNull();
 }
 expect(publicDesignKey({design_key:'__proto__',slug:'demo-unknown',preview_assets:[]})).toBeNull();
});

for (const card of cats) {
 test(`${card.title} has moving original artwork and editable words`, async ({page}) => {
  await page.emulateMedia({ reducedMotion:'no-preference' });
  await page.goto(`/cards/?search=${encodeURIComponent(card.title)}`);
  await expect(page.locator('.catalog-card')).toHaveCount(1);
  const thumbnail = page.locator('.catalog-card img');
  await expect.poll(()=>thumbnail.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  const first = await thumbnail.screenshot();
  await page.waitForTimeout(350); // Measure actual animated SVG pixels at two times.
  const next = await thumbnail.screenshot();
  expect(first.equals(next),'Cat illustration should move').toBe(false);
  await page.getByRole('link',{name:card.title,exact:true}).click();
  await expect(page.getByRole('heading',{level:1})).toHaveText(card.title);
  await page.getByRole('link',{name:'Personalize',exact:true}).click();
  await page.getByLabel('Recipient name').fill('Mila');
  await page.getByLabel('Main headline').fill('Your wonderful birthday');
  await page.getByLabel('Your message').fill('<img src=x onerror=alert(1)> Lots of love!');
  await page.getByLabel('Sender name').fill('Raya');
  const preview = page.locator('.design-preview img');
  const source = await preview.getAttribute('src');
  const svg = decodeURIComponent(source.split(',').slice(1).join(','));
  expect(svg).toContain('Mila'); expect(svg).toContain('Your wonderful birthday'); expect(svg).toContain('From Raya'); expect(svg).toContain('&lt;img');
  expect(await page.evaluate(xml=>new DOMParser().parseFromString(xml,'image/svg+xml').querySelector('parsererror')?.textContent||null,svg)).toBeNull();
  await expect(page.locator('main script')).toHaveCount(0);
  await page.getByRole('button',{name:'Replay animation',exact:true}).click();
  await expect(preview).not.toHaveAttribute('src',source);
  await expect(page.getByLabel('Recipient name')).toHaveValue('Mila');
 });

 test(`${card.title} respects reduced motion and fits mobile`, async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:375,height:900});
  await page.goto(`/card-editor/?id=${card.id}`);
  await expect(page.getByRole('heading',{level:1})).toHaveText(card.title);
  await expect(page.getByRole('button',{name:'Replay animation',exact:true})).toBeHidden();
  const image=page.locator('.design-preview img');
  await expect.poll(()=>image.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  const first=await image.screenshot();
  await page.waitForTimeout(350);
  expect(first.equals(await image.screenshot()),'Reduced-motion artwork should stay still').toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
  await image.screenshot({path:test.info().outputPath(`${card.design_key}.png`)});
 });
}

test('cat catalogue image failures retain artwork without nested interactive controls',async({page})=>{
 await page.route('**/demo-cards/*',route=>route.abort());
 await page.goto('/cards/?style=Animated+illustration');
 await expect(page.locator('.catalog-card')).toHaveCount(2);
 await expect(page.locator('.catalog-card .design-preview')).toHaveCount(2);
 await expect(page.locator('.catalog-card a button')).toHaveCount(0);
});
