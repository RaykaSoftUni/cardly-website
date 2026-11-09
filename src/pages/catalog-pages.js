import { createCardExport } from '../components/cards/card-export.js';
import { validateExportDesign } from '../services/card-export.js';
import { el } from '../utils/dom.js';
import { button,section } from '../components/ui.js';
import { createField,createForm } from '../components/forms/fields.js';
import { createDesignPreview,createDemoArtwork,selectCardAsset } from '../components/cards/design-preview.js';
import { priceAndAvailability } from '../components/cards/listing.js';
import { emptyState } from '../components/feedback/states.js';
import { catalog,cardDetail,rpc } from '../services/catalog-service.js';
import { supabaseClient } from '../services/supabase-client.js';
import { createHeader } from '../components/layout/header.js';
import { adminContext } from '../services/admin-service.js';
import { publicAssetUrl } from '../services/media-service.js';
import { showPageLoading, finishPageLoading } from '../components/feedback/page-loading.js';
const intro=(title,description)=>el('div',{className:'page-intro'},[el('p',{className:'eyebrow'},'The fictional Cardly collection'),el('h1',{},title),el('p',{className:'lead muted'},description)]);
const notice=()=>el('p',{className:'sample-notice'},'Demo collection · Original fictional designs. Supported free designs export as high-resolution PNGs in your browser. Saved demo jobs keep their server status.');
const eligible=c=>c.is_available&&c.pricing_type==='free';
const status=c=>priceAndAvailability({paid:c.pricing_type==='paid',price:c.price===null?undefined:Number(c.price),available:c.is_available,published:true});
const params=()=>new URLSearchParams(location.search);
function returnQuery(){const p=params();p.delete('id');return p.toString();}
function link(path,id,query=returnQuery()){const p=new URLSearchParams(query);if(id)p.set('id',id);return `${path}${p.size?'?'+p:''}`;}
function artwork(c,size='thumb') {
 const holder=el('div',{},createDemoArtwork(c,size));
 const asset=selectCardAsset(c,size);
 if(asset&&!asset.storage_path.startsWith('demo-cards/'))publicAssetUrl(asset.storage_path).then(url=>holder.replaceChildren(createDemoArtwork(c,size,url))).catch(()=>{});
 return holder;
}
function tile(c,query=''){
 return el('article',{className:'catalog-card'},[el('a',{href:link('/card/',c.id,query),'aria-label':`View ${c.title}`},artwork(c)),el('div',{className:'catalog-card-body'},[
 el('p',{className:'eyebrow'},`${c.occasion?.name||'Greeting'} · ${c.style||'Original'}`),el('h2',{className:'h4'},el('a',{href:link('/card/',c.id,query)},c.title)),el('p',{className:'muted small'},c.category?.name||''),status(c),button({label:eligible(c)?'Personalize':'View Card',href:link(eligible(c)?'/card-editor/':'/card/',c.id,query),variant:'outline-primary'})])]);
}
async function browse(main,pageId){
 const all=await catalog();
 if(pageId==='categories'){
  const categories=[...new Map(all.filter(c=>c.occasion).map(c=>[c.occasion.id,c.occasion])).values()];
  main.replaceChildren(intro('Every feeling has its occasion.','Choose a starting point for a thoughtful card.'),notice(),el('div',{className:'category-grid'},categories.map(o=>el('a',{className:'category-card',href:`/cards/?occasion=${o.id}`},o.name))));return;
 }
 const p=params();
 const fields=[createField({name:'search',label:'Search cards',type:'search',value:p.get('search')||'',maxLength:200,hint:'Search titles, descriptions, occasions and styles.'}),...['occasion','category','style','pricing','availability'].map(name=>{
 let choices=name==='pricing'?[{value:'free',label:'Free'},{value:'paid',label:'Paid'}]:name==='availability'?[{value:'true',label:'Available'},{value:'false',label:'Unavailable'}]:[...new Map(all.filter(c=>c[name]).map(c=>[typeof c[name]==='object'?c[name].id:c[name],typeof c[name]==='object'?c[name].name:c[name]])).entries()].map(([value,label])=>({value,label}));
 return createField({name,label:name==='pricing'?'Free or paid':name[0].toUpperCase()+name.slice(1),value:p.get(name)||'',options:[{value:'',label:'All'},...choices]});
 })];
 const form=el('form',{className:'catalog-filters',role:'search','aria-label':'Filter cards',onSubmit:e=>e.preventDefault()},fields.map(f=>f.element));
 const info=el('p',{role:'status','aria-live':'polite',className:'muted small'}),grid=el('div',{className:'card-grid'});
 let version=0,timer;
 const update=async()=>{
  const request=++version;
  const values=Object.fromEntries(fields.map(f=>[f.name,f.input.value]));
  const query=new URLSearchParams(Object.entries(values).filter(([,v])=>v));
  history.replaceState(null,'',`${location.pathname}${query.size?'?'+query:''}`);
  info.textContent='Loading cards…';
  try{
   const cards=await catalog({p_search:values.search||null,p_occasion:values.occasion||null,p_category:values.category||null,p_style:values.style||null,p_pricing_type:values.pricing||null,p_available:values.availability===''?null:values.availability==='true'});
   if(request!==version)return;
   grid.replaceChildren(...cards.map(c=>tile(c,query.toString())));
   if(!cards.length)grid.append(emptyState({title:'No matching cards',description:'Try clearing a filter or changing your search.'}));
   info.textContent=`${cards.length} ${cards.length===1?'card':'cards'} shown.`;
  }catch{if(request===version){info.textContent='Cards could not be loaded. Please try again.';grid.replaceChildren();}}
 };
 form.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(update,200);});form.addEventListener('change',()=>{clearTimeout(timer);update();});
 const inspiration=all.slice(0,3);
 const purpleCat=all.find(c=>c.slug==='demo-disco-whiskers');
 if(purpleCat)inspiration[0]=purpleCat;
 if(pageId==='home')main.replaceChildren(intro('For their day. In their own way.','Thoughtful designs, a name they know, and words only you would say.'),notice(),button({label:'Browse all cards',href:'/cards/'}),section({title:'A little inspiration',children:[el('div',{className:'card-grid'},inspiration.map(c=>tile(c)))]}));
 else {await update();main.replaceChildren(intro('Find their kind of card.','Explore distinct designs for birthdays, thank-yous and new chapters.'),notice(),form,info,grid);}
}
function definitions(c){return c.personalization_fields.map(f=>({name:f.field_key,label:f.label,type:f.field_type==='select'?'text':f.field_type,required:f.is_required,maxLength:f.config.max_length??1000,min:f.config.min,max:f.config.max,minLength:f.config.min_length,options:f.field_type==='select'?[{value:'',label:'Choose an option'},...f.config.options]:undefined,hint:f.is_required ? 'Required before saving or generating this card.' : f.help_text||f.placeholder}));}
function valuesFor(c,values){
 const out={};for(const f of c.personalization_fields){const value=values[f.field_key];if(value!==''&&value!==null&&value!==undefined)out[f.field_key]=f.field_type==='number'?Number(value):value;}
 return out;
}
async function detail(main,pageId){
 const id=params().get('id');
 if(!id)return main.replaceChildren(intro('Choose a card first.','Browse the collection to find a design.'),button({label:'Browse cards',href:'/cards/'}));
 const c=await cardDetail(id);
 if(!c)return main.replaceChildren(intro('Card not found','This card is not publicly available.'),button({label:'Browse cards',href:'/cards/'}));
 const query=returnQuery();
 const back=el('a',{href:link('/cards/',null,query),className:'catalog-back-link d-inline-block mb-4'},'← Back to your cards');
 if(pageId==='card'){
  main.replaceChildren(back,intro(c.title,c.description),notice(),el('div',{className:'editor-layout'},[artwork(c,'preview'),el('section',{className:'surface-panel'},[el('p',{className:'eyebrow'},`${c.occasion?.name||''} · ${c.category?.name||''} · ${c.style||''}`),el('h2',{},'Make it personal'),status(c),el('p',{},'Personalize: '+c.personalization_fields.map(f=>f.label.toLowerCase()).join(', ')+'.'),button({label:eligible(c)?'Personalize':'Currently unavailable',href:link('/card-editor/',c.id,query),disabled:!eligible(c)}),el('p',{className:'field-hint mt-3'},c.pricing_type==='paid'?'EUR price shown for reference. Purchasing is not available.':'Preview your words before saving. Sign in to save your own draft.')])]));return;
 }
 if(!eligible(c))return main.replaceChildren(back,intro('Personalization unavailable','Choose a published, available free card.'),status(c));
 const savedKey=`cardly-demo-input:${id}`;
 let initial={};try{initial=JSON.parse(sessionStorage.getItem(savedKey)||'{}');}catch{}
 const preview=createDesignPreview(c.design_key,initial);
 const feedback=el('p',{role:'status','aria-live':'polite',className:'field-hint'});
 let pngExport;
 const change=values=>{pngExport?.invalidate();const data=valuesFor(c,values);preview.update(data);try{sessionStorage.setItem(savedKey,JSON.stringify(data));}catch{}};
 const form=createForm({fields:definitions(c).map(f=>({...f,value:initial[f.name]??''})),submitLabel:'Validate demo preview',description:'Each design has its own supported fields. Preview your words, then generate a 1500 × 2000 PNG. Animated designs export as a still image.',onChange:change,onSubmit:values=>{change(values);feedback.textContent='Preview validated. Choose Generate PNG to create your download.';}});
 pngExport=createCardExport({title:c.title,getInput:async()=>{
  if(!form.validate())return null;
  const current=await cardDetail(c.id);
  if(!current||!eligible(current))throw new Error('This card is no longer available for free generation.');
  if(current.design_key!==c.design_key)throw new Error('This design changed. Reload the editor before generating.');
  return {key:c.design_key,values:valuesFor(c,form.values())};
 }});
 const report=error=>{feedback.textContent=error.message;const field=c.personalization_fields.find(f=>error.message.includes(f.field_key));if(field)form.setErrors({[field.field_key]:error.message});};
 const save=button({label:'Save my draft',variant:'outline-primary',onClick:async()=>{
  if(!form.validate())return;
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session){feedback.textContent='Sign in to save. Your input stays in this browser tab.';return;}
  save.disabled=true;
  try{const d=await rpc('create_card_draft',{p_card_id:c.id,p_personalization_data:valuesFor(c,form.values())});feedback.textContent='Draft saved to your account.';generate.hidden=false;generate.dataset.draftId=d.id;}
  catch(error){report(error);}
  finally{save.disabled=false;}
 }});
 const generate=button({label:'Save demo generation',variant:'outline-primary',onClick:async()=>{
  if(!form.validate())return;
  generate.disabled=true;
  try{await rpc('update_card_draft',{p_draft_id:generate.dataset.draftId,p_personalization_data:valuesFor(c,form.values())});const result=await rpc('generate_card',{p_draft_id:generate.dataset.draftId,p_expected_price:0});feedback.textContent=result.status==='processing'?'Demo generation job saved. You can generate a PNG locally; the server job remains processing.':'The price changed. Review the card before continuing.';}
  catch(error){report(error);}
  finally{generate.disabled=false;}
 }});generate.hidden=true;
 main.replaceChildren(back,intro(c.title,'Your words, in this design’s own layout.'),notice(),el('div',{className:'editor-layout'},[el('section',{className:'surface-panel'},[form.element,pngExport.element,save,generate,feedback]),el('aside',{className:'preview-panel','aria-label':'Live card preview'},preview.element)]));
}
async function login(main){
 const {data:{session}}=await supabaseClient.auth.getSession();
 if(session){main.replaceChildren(intro('You are signed in.','Your saved cards belong to your account.'),button({label:'My cards',href:'/my-cards/'}),button({label:'Log out',variant:'quiet',onClick:async()=>{await supabaseClient.auth.signOut();location.reload();}}));return;}
 const feedback=el('p',{role:'status','aria-live':'polite'});
 const form=createForm({fields:[{name:'email',label:'Email address',type:'email',required:true},{name:'password',label:'Password',type:'password',required:true}],submitLabel:'Sign in',description:'Use an account configured in this Supabase project. Demo passwords are never published.',onSubmit:async values=>{
  const {error}=await supabaseClient.auth.signInWithPassword(values);
  if(error){feedback.textContent='Sign-in failed. Check your account and password.';return;}
  const next=new URL(params().get('next')||'/my-cards/',location.origin);
  location.assign(next.origin===location.origin&&(next.pathname.startsWith('/admin/')||next.pathname==='/account/')?next.pathname+next.search:'/my-cards/');
 }});
 main.replaceChildren(intro('Good to see you.','Sign in to keep your personal cards.'),el('section',{className:'auth-panel surface-panel'},[form.element,feedback,button({label:'Forgot password?',href:'/forgot-password/',variant:'quiet'})]));
}
async function collection(main){
 const {data:{session}}=await supabaseClient.auth.getSession();
 if(!session)return main.replaceChildren(intro('Your personal collection','Sign in to see your own drafts and demo generations.'),button({label:'Sign in',href:'/login/'}));
 const [generations,drafts]=await Promise.all([rpc('get_generated_cards'),supabaseClient.from('card_drafts').select('*').is('archived_at',null).order('updated_at',{ascending:false})]);
 if(drafts.error)throw drafts.error;
 const draftTiles=await Promise.all(drafts.data.map(async d=>{const c=await cardDetail(d.card_id);return el('article',{className:'surface-panel'},[el('h3',{},c?.title||'Saved draft'),el('p',{},`For ${d.personalization_data.recipient_name||'someone special'}`),button({label:'Reopen preview',href:link('/card-editor/',d.card_id,''),onClick:()=>sessionStorage.setItem(`cardly-demo-input:${d.card_id}`,JSON.stringify(d.personalization_data))})]);}));
 const generated=generations.map(g=>{
  const key=g.template_snapshot?.layout_config?.design_key;
  const content=el('div',{className:'catalog-card-body'},[el('h3',{},g.card_snapshot.title),el('p',{},`Saved snapshot · template v${g.template_version} · server status: ${g.status}`)]);
  let supported=g.card_snapshot.pricing_type==='free'&&g.status!=='failed';
  try{validateExportDesign(key,g.template_snapshot?.layout_config);}catch{supported=false;}
  if(supported){
   const png=createCardExport({title:g.card_snapshot.title,getInput:async()=>({key,values:g.personalization_data,layout:g.template_snapshot.layout_config})});
   content.append(el('p',{className:'muted small'},'Generate a local PNG from these saved words and this design. This does not complete the server job.'),png.element);
  }else content.append(el('p',{className:'muted small'},'Local PNG export is unavailable for this snapshot.'));
  return el('article',{className:'catalog-card'},[createDesignPreview(key,g.personalization_data).element,content]);
 });
 main.replaceChildren(intro('Your little collection of joy.','Only your account’s drafts and generation previews are shown.'),notice(),section({title:'Saved drafts',children:[el('div',{className:'card-grid'},draftTiles.length?draftTiles:emptyState({title:'No saved drafts',description:'Personalize an available free card to start.'}))]}),section({title:'Saved generation snapshots',children:[el('div',{className:'card-grid'},generated.length?generated:emptyState({title:'No demo generations yet',description:'Save a draft to create a generation job.'}))]}));
}
export async function renderCatalogPage(main,pageId){
 showPageLoading(main);
 try {
 const {data:{session}}=await supabaseClient.auth.getSession();
 if(session){const context=await adminContext();document.querySelector('header').replaceWith(createHeader({pageId,authenticated:true,isAdmin:context.isAdmin,onLogout:async()=>{await supabaseClient.auth.signOut();location.assign('/login/');}}));}
 else document.querySelector('header').replaceWith(createHeader({pageId}));
 if(['home','cards','category','categories'].includes(pageId))await browse(main,pageId);else if(pageId==='login')await login(main);else if(pageId==='my-cards')await collection(main);else await detail(main,pageId);
 } catch{main.replaceChildren(intro('We could not load this page.','Check your connection and Supabase configuration, then try again.'),button({label:'Try again',onClick:()=>renderCatalogPage(main,pageId)}));}
 finally{finishPageLoading(main);}
}
