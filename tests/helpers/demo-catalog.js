import { readFileSync } from 'node:fs';
const records=JSON.parse(readFileSync(new URL('../../supabase/seed/catalog.json',import.meta.url)));
const id=i=>`a0000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
export const demoCards=records.filter(c=>c.status==='published').map((c,i)=>({
 id:id(i+1),title:c.title,slug:`demo-${c.slug}`,description:c.description,style:c.style,design_key:c.designKey,is_available:c.available,pricing_type:c.paid?'paid':'free',price:c.paid?c.price:null,currency:'EUR',available_for_purchase:false,
 occasion:{id:id(100+['Birthday','Thank You','Congratulations','Anniversary'].indexOf(c.occasion)),name:c.occasion},category:{id:id(200+['Kids','Elegant','Funny','Minimal','Playful','Modern'].indexOf(c.category)),name:c.category},
 preview_assets:[{image_type:'thumbnail',storage_path:`demo-cards/${c.slug}-thumb.svg`,alt_text:`${c.title} — original demo artwork`},{image_type:'preview',storage_path:`demo-cards/${c.slug}-preview.svg`,alt_text:`${c.title} — original demo artwork`}],
 personalization_fields:c.fields.map(f=>({field_key:f.key,label:f.label,field_type:f.type,is_required:f.required,config:f.config,help_text:'Add a personal touch.'})),
}));
export async function mockCatalog(page){
 await page.route('**/rest/v1/rpc/*',async route=>{
  const body=route.request().postDataJSON()||{};
  const name=new URL(route.request().url()).pathname.split('/').pop();
  let data;
  if(name==='get_card_detail')data=demoCards.find(c=>c.id===body.p_card_id)||null;
  else if(name==='get_card_catalogue')data=demoCards.filter(c=>(!body.p_occasion||c.occasion.id===body.p_occasion)&&(!body.p_category||c.category.id===body.p_category)&&(!body.p_style||c.style===body.p_style)&&(!body.p_pricing_type||c.pricing_type===body.p_pricing_type)&&(body.p_available==null||c.is_available===body.p_available)&&(!body.p_search||`${c.title} ${c.description} ${c.style} ${c.occasion.name} ${c.category.name}`.toLowerCase().includes(body.p_search.toLowerCase())));
  else data=[];
  await route.fulfill({json:data});
 });
}
