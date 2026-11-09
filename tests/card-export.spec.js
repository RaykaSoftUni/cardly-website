import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { demoCards, mockCatalog } from './helpers/demo-catalog.js';
import { mockAdmin } from './helpers/admin.js';
import { designs } from '../src/data/card-designs.js';

const card = demoCards.find(c => c.design_key === 'space-explorer');
const values = { recipient_name: 'Emma', recipient_age: 12, custom_message: 'To the moon and back, with love.', sender_name: 'Raya' };
test.beforeEach(async ({ page }) => mockCatalog(page));

test('downloads a real production PNG, then invalidates stale output and handles errors', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await page.goto(`/card-editor/?id=${card.id}`);
  const download = page.getByRole('link', { name: 'Download Card', exact: true });
  const generate = page.getByRole('button', { name: 'Generate PNG', exact: true });
  await expect(download).toBeHidden();
  await generate.click();
  await expect(download).toBeHidden();
  await page.getByLabel('Recipient name').fill(values.recipient_name);
  await page.getByRole('spinbutton', { name: 'Age Optional', exact: true }).fill('12');
  await page.getByLabel('Your message').fill(values.custom_message);
  await page.getByLabel('Sender name').fill(values.sender_name);
  await generate.click();
  await expect(download).toBeVisible();
  const event = page.waitForEvent('download');
  await download.click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('tiny-space-explorer.png');
  await file.saveAs(test.info().outputPath('export.png'));
  const bytes = await readFile(await file.path());
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.readUInt32BE(16)).toBe(1500);
  expect(bytes.readUInt32BE(20)).toBe(2000);
  expect(bytes.includes(Buffer.from('Emma'))).toBe(false);
  await page.getByLabel('Recipient name').fill('Mila');
  await expect(download).toBeHidden();
  await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = function(callback) { callback(null); }; });
  await generate.click();
  await expect(page.locator('.card-export')).toContainText('PNG generation failed');
  await expect(download).toBeHidden();
  await expect(generate).toBeEnabled();
});

test('all known designs render deterministically at production resolution with artwork and complete fitted text', async ({ page }) => {
  for (const path of ['services/card-export.js', 'data/card-designs.js', 'data/cat-artwork.js']) {
    const source = await readFile(new URL('../src/' + path, import.meta.url), 'utf8');
    await page.route('**/__test__/' + path, route => route.fulfill({ contentType:'text/javascript', body:source }));
  }
  await page.goto('/faq/');
  const result = await page.evaluate(async keys => {
    const { renderCardPng, cardFilename, validateExportDesign } = await import('/__test__/services/card-export.js');
    const { renderCardSvg } = await import('/__test__/data/card-designs.js');
    const values = { recipient_name: 'W'.repeat(60), recipient_age: 99, main_headline: 'Happy birthday '.repeat(5), custom_message: 'A message of love and happiness for you. '.repeat(6), sender_name: 'W'.repeat(60) };
    const records = [];
    for (const key of keys) {
      const blob = await renderCardPng(key, values);
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas'); canvas.width = 1500; canvas.height = 2000;
      const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, 1500, 2000).data;
      const colorCount = new Set();
      for (let i = 0; i < data.length; i += 400) colorCount.add(`${data[i]},${data[i+1]},${data[i+2]}`);
      const svg = renderCardSvg(key, values, { animate: false });
      const holder = document.createElement('div'); holder.innerHTML = svg; document.body.append(holder);
      const outside = [...holder.querySelectorAll('text')].filter(t => { const b=t.getBBox(); return b.x < 0 || b.y < 0 || b.x+b.width > 600.5 || b.y+b.height > 800; }).map(t => t.textContent);
      const message = [...holder.querySelectorAll('text')].find(t => t.querySelector('title')?.textContent === values.custom_message);
      const fullMessage = [...message.querySelectorAll('tspan')].map(t=>t.textContent).join(' ');
      records.push({ key, width: bitmap.width, height: bitmap.height, colors: colorCount.size, outside, fullMessage });
      holder.remove(); bitmap.close();
    }
    const first = await renderCardPng('disco-whiskers', values);
    const second = await renderCardPng('disco-whiskers', values);
    let rejected = 0;
    for (const [key, layout] of [['unknown', null], ['birthday-type', { canvas: { width:800,height:600 } }], ['birthday-type', { canvas: {width:600,height:800}, photo_upload:true }]]) {
      try { validateExportDesign(key, layout); } catch { rejected++; }
    }
    return { records, deterministic: [...new Uint8Array(await first.arrayBuffer())].join() === [...new Uint8Array(await second.arrayBuffer())].join(), filename:cardFilename('../../Private @ account 💌'), rejected };
  }, Object.keys(designs));
  expect(result.deterministic).toBe(true);
  expect(result.filename).toBe('private-account.png');
  expect(result.rejected).toBe(3);
  for (const record of result.records) {
    expect([record.width, record.height], record.key).toEqual([1500, 2000]);
    expect(record.colors, record.key).toBeGreaterThan(5);
    expect(record.outside, record.key).toEqual([]);
    expect(record.fullMessage, record.key).toBe('A message of love and happiness for you. '.repeat(6).trim());
  }
});

test('blocked cards never expose export; eligibility changes block generation', async ({ page }) => {
  const paid = demoCards.find(c => c.pricing_type === 'paid');
  await page.goto(`/card-editor/?id=${paid.id}`);
  await expect(page.getByRole('button', { name: 'Generate PNG' })).toHaveCount(0);
  await page.goto(`/card-editor/?id=${card.id}`);
  await page.getByLabel('Recipient name').fill('Emma');
  await page.route('**/rpc/get_card_detail', route => route.fulfill({ json: { ...card, is_available: false } }));
  await page.getByRole('button', { name: 'Generate PNG' }).click();
  await expect(page.locator('.card-export')).toContainText('no longer available');
  await expect(page.getByRole('link', { name: 'Download Card' })).toBeHidden();
});

test('owned snapshots export their saved words without completing server jobs', async ({ page }) => {
  await mockAdmin(page, 'user');
  const saved = { id:'saved-job', status:'processing', template_version:1, card_snapshot:{title:'Saved birthday',pricing_type:'free'}, template_snapshot:{ layout_config:{design_key:'birthday-type',canvas:{width:600,height:800},photo_upload:false} }, personalization_data:{recipient_name:'Saved Emma',custom_message:'Words from the saved snapshot'} };
  await page.route('**/rpc/get_generated_cards', route => route.fulfill({json:[saved,{...saved,id:'failed-job',status:'failed'}]}));
  await page.goto('/my-cards/');
  await expect(page.getByRole('button', { name:'Generate PNG' })).toHaveCount(1);
  await expect(page.locator('main')).toContainText('server status: processing');
  await page.getByRole('button', { name:'Generate PNG' }).click();
  await expect(page.getByRole('link', { name:'Download Card' })).toBeVisible();
  await expect(page.locator('main')).toContainText('server status: processing');
  await expect(page.locator('.design-preview img').first()).toHaveAttribute('src', new RegExp(encodeURIComponent('Saved Emma')));
});
