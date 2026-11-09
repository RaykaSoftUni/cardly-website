import {test,expect} from '@playwright/test';
test('live public Supabase catalog and seeded artwork',async({page})=>{
 test.skip(process.env.CARDLY_LIVE_SMOKE!=='1','Enable explicitly to verify the connected project.');
 await page.goto('/cards/');
 await expect(page.locator('.catalog-card')).toHaveCount(13,{timeout:20000});
 await expect(page.locator('main')).not.toContainText('Confetti laboratory');
 await expect(page.locator('main')).not.toContainText('The retired garden');
 await page.locator('.catalog-card img').evaluateAll(images=>images.forEach(image=>image.loading='eager'));
 await expect.poll(()=>page.locator('.catalog-card img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0))).toBe(true);
 await page.screenshot({path:test.info().outputPath('live-catalog-desktop.png'),fullPage:true});
 await page.setViewportSize({width:375,height:850});
 await page.screenshot({path:test.info().outputPath('live-catalog-mobile.png'),fullPage:true});
 await page.getByRole('link',{name:'Tiny space explorer',exact:true}).click();
 await page.getByRole('link',{name:'Personalize',exact:true}).click();
 await page.getByLabel('Recipient name').fill('Alex');
 await page.getByRole('spinbutton',{name:'Age Optional'}).fill('8');
 await page.getByLabel('Favourite adventures').fill('space and dinosaurs');
 await page.screenshot({path:test.info().outputPath('live-editor-mobile.png'),fullPage:true});
 await expect(page.locator('main')).toContainText('Your words, in this design’s own layout.');
});

test('live cat cards expose valid templates, previews and guest personalization',async({page})=>{
 test.skip(process.env.CARDLY_LIVE_SMOKE!=='1','Enable explicitly to verify the connected project.');
 for(const title of ['Disco whiskers','Cake & catnaps']) {
  await page.goto('/cards/?search='+encodeURIComponent(title));
  await expect(page.locator('.catalog-card')).toHaveCount(1,{timeout:20000});
  await page.getByRole('link',{name:title,exact:true}).click();
  await page.getByRole('link',{name:'Personalize',exact:true}).click();
  await expect(page.getByRole('heading',{level:1})).toHaveText(title);
  await page.getByLabel('Recipient name').fill('Mila');
  await expect(page.getByRole('button',{name:'Replay animation',exact:true})).toBeVisible();
  await expect.poll(()=>page.locator('.design-preview img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 }
});
