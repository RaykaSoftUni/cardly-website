// Catalogue content only: use the same checked admin RPCs as the application.
// Never use this script to change schema or migration history.
import { readFileSync, accessSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
import { publicDesignKey } from '../src/data/card-designs.js';
const env = loadEnv('development', process.cwd());
const email = process.env.CARDLY_ADMIN_EMAIL;
const password = process.env.CARDLY_ADMIN_PASSWORD;
if (!email || !password) throw new Error('Supply CARDLY_ADMIN_EMAIL and CARDLY_ADMIN_PASSWORD through the environment.');
const cards = JSON.parse(readFileSync(new URL('../supabase/seed/catalog.json', import.meta.url))).filter(c => ['disco-whiskers','cake-catnaps'].includes(c.slug));
if (cards.length !== 2) throw new Error('Expected exactly two cat fixtures.');
for (const card of cards) for (const size of ['thumb','preview']) accessSync(new URL(`../public/demo-cards/${card.slug}-${size}.svg`, import.meta.url));
const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const checked = result => { if (result.error) throw new Error(result.error.message); return result.data; };
const save = async (entity,data,id=null) => checked(await client.rpc('admin_save_card_data',{p_entity:entity,p_data:data,p_id:id}));
try {
 const login = checked(await client.auth.signInWithPassword({ email, password }));
 const role = checked(await client.from('user_roles').select('role').eq('user_id',login.user.id).single());
 if (role.role !== 'admin') throw new Error('An authenticated database administrator is required.');
 // Read actual taxonomy/configuration before mutations; never invent identifiers.
 const occasion = checked(await client.from('occasions').select('id').eq('slug','demo-birthday').eq('is_active',true).single());
 for (const fixture of cards) {
  const slug = `demo-${fixture.slug}`;
  const category = checked(await client.from('categories').select('id').eq('name',fixture.category).eq('slug',`demo-${fixture.category.toLowerCase()}`).eq('is_active',true).single());
  let card = checked(await client.from('cards').select('*').eq('slug',slug).maybeSingle());
  if (card && (card.title !== fixture.title || card.description !== fixture.description)) throw new Error(`${slug} already exists with different content; preserving it.`);
  if (!card) card = await save('cards',{title:fixture.title,slug,description:fixture.description,occasion_id:occasion.id,category_id:category.id,status:'draft',pricing_type:'free',price:null,currency:'EUR',is_available:false,is_featured:false,sort_order:fixture.sort_order,style:fixture.style});
  let template = checked(await client.from('card_templates').select('*').eq('card_id',card.id).maybeSingle());
  if (template && (template.template_key !== slug || template.layout_config.design_key !== fixture.designKey)) throw new Error(`${slug} has an existing different template; preserving it.`);
  const fields = checked(await client.from('personalization_fields').select('*').eq('card_id',card.id));
  const assets = checked(await client.from('card_images').select('*').eq('card_id',card.id));
  if (card.status === 'published') {
   if (!template || !fixture.fields.every(f=>fields.some(r=>r.field_key===f.key)) || !assets.some(a=>a.image_type==='preview')) throw new Error(`${slug} is published with incomplete configuration; inspect it in Admin.`);
   console.log(`Preserved existing ${slug}.`); continue;
  }
  if (card.status !== 'draft') throw new Error(`${slug} is not a draft; preserving its publication state.`);
  if (!template) template = await save('card_templates',{card_id:card.id,template_key:slug,layout_config:{design_key:fixture.designKey,canvas:{width:600,height:800},regions:fixture.fields.map(f=>({field:f.key,role:f.key==='recipient_name'?'recipient':f.key==='sender_name'?'signature':f.key==='custom_message'?'body':'dynamic'})),artwork:{type:'original-svg',key:fixture.designKey,animation:{duration_ms:4200,reduced_motion:true}},photo_upload:false},style_config:{design_key:fixture.designKey}});
  for (const [index,field] of fixture.fields.entries()) if (!fields.some(f=>f.field_key===field.key)) await save('personalization_fields',{card_id:card.id,field_key:field.key,label:field.label,field_type:field.type,is_required:field.required,sort_order:index,help_text:'Leave optional fields blank to use the design’s own wording.',config:field.config});
  for (const [index,size] of ['preview','thumb'].entries()) {
   const path=`demo-cards/${fixture.slug}-${size}.svg`;
   if (!assets.some(a=>a.storage_path===path)) checked(await client.rpc('admin_save_card_asset',{p_card_id:card.id,p_asset:{storage_path:path,alt_text:fixture.description,image_type:size==='thumb'?'thumbnail':'preview',sort_order:index,is_primary:size==='preview'},p_id:null}));
  }
  // Publish only after a complete template, fields and primary preview exist.
  await save('cards',{status:'published',is_available:true},card.id);
  console.log(`Published ${slug}.`);
 }
 const publicCards=checked(await client.rpc('get_card_catalogue',{p_style:'Animated illustration'}));
 if (!cards.every(f=>publicCards.some(c=>c.slug===`demo-${f.slug}`&&publicDesignKey(c)===f.designKey&&c.is_available&&c.pricing_type==='free'))) throw new Error('Public cat-card verification failed.');
 console.log('Verified both original cat designs in the public catalogue.');
} finally { await client.auth.signOut({ scope:'local' }); }
