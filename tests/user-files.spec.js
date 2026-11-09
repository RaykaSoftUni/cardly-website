import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockAdmin, adminId, png } from './helpers/admin.js';
import { demoCards } from './helpers/demo-catalog.js';
const card={...demoCards[0],design_key:'photo-keepsake',slug:'demo-photo-keepsake',personalization_fields:[...demoCards[0].personalization_fields,{field_key:'recipient_photo',label:'Recipient photo',field_type:'image',is_required:false,config:{}}]};
const draftId='d0000000-0000-4000-8000-000000000099';
async function setup(page){
 await mockAdmin(page,'user');
 const state={path:null,fail:false,draft:null,uploads:0};
 await page.route('**/rpc/get_card_detail',route=>route.fulfill({json:card}));
 await page.route('**/rpc/card_photo_available',route=>route.fulfill({json:true}));
 await page.route('**/rpc/create_card_draft',route=>{state.draft={id:draftId,personalization_data:route.request().postDataJSON().p_personalization_data};return route.fulfill({json:state.draft});});
 await page.route('**/rpc/update_card_draft',route=>{state.draft.personalization_data=route.request().postDataJSON().p_personalization_data;return route.fulfill({json:state.draft});});
 await page.route('**/rest/v1/card_drafts*',route=>route.fulfill({json:{...state.draft,uploaded_image_path:state.path}}));
 await page.route('**/functions/v1/user-file-upload',route=>{
  if(state.fail)return route.fulfill({status:400,json:{error:'The image could not be uploaded. Please try again.'}});
  const body=route.request().postData()||'';
  if(body.includes('name="action"'))state.path=null;
  else{state.path=`${adminId}/drafts/${draftId}/${crypto.randomUUID()}.png`;state.uploads++;}
  return route.fulfill({json:{path:state.path,cleanupFailed:false}});
 });
 return state;
}

test('private photo upload saves a draft, updates the card and exports the photo',async({page})=>{
 const state=await setup(page);
 await page.setViewportSize({width:375,height:900});
 await page.goto('/card-editor/?id='+card.id);
 await page.getByLabel('Recipient name').fill('Emma');
 await page.getByLabel('Your message').fill('A memory to keep.');
 await page.getByLabel('Recipient photo', {exact:false}).setInputFiles({name:'memory.png',mimeType:'image/png',buffer:png});
 await expect(page.getByAltText('Selected photo preview')).toBeVisible();
 await page.getByRole('button',{name:'Upload card photo',exact:true}).click();
 await expect(page.locator('main')).toContainText('Private photo saved to your draft.');
 expect(state.draft.personalization_data).not.toHaveProperty('recipient_photo');
 await expect(page).toHaveURL(new RegExp('draft='+draftId));
 const image=page.locator('.design-preview img');
 expect(decodeURIComponent(await image.getAttribute('src'))).toContain('data:image/png;base64,');
 await page.getByRole('button',{name:'Generate PNG',exact:true}).click();
 await expect(page.getByRole('link',{name:'Download Card',exact:true})).toBeVisible();
 const dimensions=await page.getByRole('link',{name:'Download Card',exact:true}).evaluate(async a=>{const image=await createImageBitmap(await(await fetch(a.href)).blob());return [image.width,image.height];});
 expect(dimensions).toEqual([1500,2000]);
 const colors=await page.getByRole('link',{name:'Download Card',exact:true}).evaluate(async(a,source)=>{
  const output=await createImageBitmap(await(await fetch(a.href)).blob());
  const original=await createImageBitmap(new Blob([new Uint8Array(source)],{type:'image/png'}));
  const canvas=document.createElement('canvas');canvas.width=1500;canvas.height=2000;const ctx=canvas.getContext('2d');
  ctx.drawImage(output,0,0);const exported=[...ctx.getImageData(750,800,1,1).data];ctx.clearRect(0,0,1500,2000);ctx.drawImage(original,0,0);
  return {exported,original:[...ctx.getImageData(0,0,1,1).data]};
 },[...png]);
 expect(colors.exported).toEqual(colors.original);
 const old=state.path;
 await page.getByLabel('Recipient photo',{exact:false}).setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:png});
 await page.getByRole('button',{name:'Upload card photo',exact:true}).click();
 await expect.poll(()=>state.path).not.toBe(old);
 await expect(page.getByRole('link',{name:'Download Card',exact:true})).toBeHidden();
 await page.getByRole('button',{name:'Remove card photo',exact:true}).click();
 await expect(page.locator('.draft-photo')).toContainText('Photo removed.');
 expect(state.path).toBeNull();
 expect(decodeURIComponent(await image.getAttribute('src'))).not.toContain('<image ');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});

test('photo errors preserve text and unsupported templates have no upload controls',async({page})=>{
 const state=await setup(page);
 await page.goto('/card-editor/?id='+card.id);
 await page.getByLabel('Recipient name').fill('Emma');
 await page.getByLabel('Your message').fill('Keep my words.');
 const file=page.getByLabel('Recipient photo',{exact:false});
 await file.setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
 await expect(page.locator('.draft-photo')).toContainText('contents do not match');
 expect(state.uploads).toBe(0);
 await file.setInputFiles({name:'memory.png',mimeType:'image/png',buffer:png});
 state.fail=true;
 await page.getByRole('button',{name:'Upload card photo',exact:true}).click();
 await expect(page.locator('.draft-photo')).toContainText('Upload failed');
 await expect(page.getByLabel('Your message')).toHaveValue('Keep my words.');
 await expect(page.getByLabel('Recipient name')).toHaveValue('Emma');
 await page.route('**/rpc/card_photo_available',route=>route.fulfill({json:false}));
 await page.goto('/card-editor/?id='+card.id);
 await expect(page.getByRole('button',{name:'Upload card photo',exact:true})).toHaveCount(0);
});
