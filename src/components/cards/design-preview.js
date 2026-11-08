import { el } from '../../utils/dom.js';
import { renderCardSvg, designs } from '../../data/card-designs.js';
export function createDesignPreview(key, values = {}) {
 const image = el('img', { className:'design-art', alt:'Personalized demo greeting card', width:600, height:800 });
 const root = el('div', { className:'design-preview' }, image);
 const render = () => {
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderCardSvg(key,values))}`;
  image.alt = `${values.recipient_name ? `For ${values.recipient_name}: ` : ''}${values.main_headline || designs[key]?.headline || 'Greeting card'} — demo preview`;
 };
 render();
 return { element:root, update(next) { values={...next}; render(); } };
}
export function selectCardAsset(card, size='thumb') {
 return card.preview_assets?.find(a=>a.is_primary) || card.preview_assets?.find(a=>a.image_type===(size==='thumb'?'thumbnail':'preview')) || card.preview_assets?.find(a=>['preview','thumbnail'].includes(a.image_type));
}
export function createDemoArtwork(card, size='thumb', imageUrl=null) {
 const fallback = createDesignPreview(card.design_key).element;
 const asset = selectCardAsset(card,size);
 if (!asset || (!imageUrl && !/^demo-cards\/[a-z0-9-]+-(thumb|preview)\.svg$/.test(asset.storage_path))) return fallback;
 const image = el('img', { className:'design-art', src:imageUrl || `/${asset.storage_path}`, alt:asset.alt_text, width:600,height:800,loading:'lazy' });
 image.addEventListener('error',()=>image.replaceWith(fallback),{once:true});
 return image;
}
