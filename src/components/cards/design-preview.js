import { el } from '../../utils/dom.js';
import { renderCardSvg, designs } from '../../data/card-designs.js';
import { button } from '../ui.js';
export function createDesignPreview(key, values = {}, { controls = true, photoData = null } = {}) {
 const image = el('img', { className:'design-art', alt:'Personalized demo greeting card', width:600, height:800 });
 const root = el('div', { className:'design-preview' }, image);
 const motion = matchMedia('(prefers-reduced-motion: reduce)');
 let replay = 0;
 const render = () => {
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderCardSvg(key,values,{animate:!motion.matches,replay:replay++,photoData}))}`;
  image.alt = `${values.recipient_name ? `For ${values.recipient_name}: ` : ''}${values.main_headline || designs[key]?.headline || 'Greeting card'} — demo preview`;
 };
 render();
 if (designs[key]?.animated) {
  const replayButton = controls ? button({label:'Replay animation',variant:'quiet',iconName:'arrow-clockwise',onClick:render}) : null;
  replayButton?.classList.add('animation-replay');
  const sync = () => { if (replayButton) replayButton.hidden = motion.matches; render(); };
  if (replayButton) replayButton.hidden = motion.matches;
  motion.addEventListener('change',sync);
  window.addEventListener('pagehide',()=>motion.removeEventListener('change',sync),{once:true});
  if (replayButton) root.append(replayButton);
 }
 return { element:root, setPhoto(next) { photoData=next; render(); }, update(next) { values={...next}; render(); } };
}
export function selectCardAsset(card, size='thumb') {
 return card.preview_assets?.find(a=>a.is_primary) || card.preview_assets?.find(a=>a.image_type===(size==='thumb'?'thumbnail':'preview')) || card.preview_assets?.find(a=>['preview','thumbnail'].includes(a.image_type));
}
export function createDemoArtwork(card, size='thumb', imageUrl=null) {
 const fallback = createDesignPreview(card.design_key, {recipient_name:'Alex'}, { controls: false }).element;
 if (designs[card.design_key]?.animated && matchMedia('(prefers-reduced-motion: reduce)').matches) return fallback;
 const asset = selectCardAsset(card,size);
 if (!asset || (!imageUrl && !/^demo-cards\/[a-z0-9-]+-(thumb|preview)\.svg$/.test(asset.storage_path))) return fallback;
 const image = el('img', { className:'design-art', src:imageUrl || `/${asset.storage_path}`, alt:asset.alt_text, width:600,height:800,loading:'lazy' });
 image.addEventListener('error',()=>image.replaceWith(fallback),{once:true});
 return image;
}
