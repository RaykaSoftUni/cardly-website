// Public renderer definitions. Private template configuration never enters this module.
import { discoCat, catnapCake, catMotion } from './cat-artwork.js';
export const designs = {
 'photo-keepsake': { background:'#fff6eb', ink:'#3b4d46', headline:'A birthday worth keeping.', message:'Here’s to you, and all the memories still to come.', composition:'photo' },
 'disco-whiskers': { background: '#e9e1ff', ink: '#30244c', headline: 'Birthday on repeat.', message: 'Good tunes, great cake, and all your favourite people.', composition: 'disco-cat', animated: true },
 'cake-catnaps': { background: '#fff4e3', ink: '#234b43', headline: 'Cake first. Catnap later.', message: 'A little sweetness. A lot of love. A day just for you.', composition: 'catnap', animated: true },
 'birthday-type': { background: '#f5ebdf', ink: '#263f37', headline: 'A very happy birthday.', message: 'A new year of little wonders.', composition: 'type' },
 'space-explorer': { background: '#172747', ink: '#fff4ca', headline: 'Out of this world!', message: 'Your next big adventure starts today.', composition: 'space' },
 'wild-confetti': { background: '#ffe882', ink: '#573287', headline: 'Hooray for you!', message: 'Cake, wishes and a little wild magic.', composition: 'confetti' },
 'botanical-wishes': { background: '#eaf0e3', ink: '#364f40', headline: 'A beautiful new chapter.', message: 'May the coming year bring room to bloom.', composition: 'botanical' },
 'older-wiser': { background: '#ff684c', ink: '#221f28', headline: 'Older? Yes. Wiser? Debatable.', message: 'At least the cake keeps getting better.', composition: 'funny' },
 'little-thanks': { background: '#fff7e8', ink: '#9b3932', headline: 'A thousand little thanks.', message: 'You made more of a difference than you know.', composition: 'frame' },
 'big-congratulations': { background: '#dde8f0', ink: '#1b3b57', headline: 'LOOK AT YOU GO.', message: 'This is your moment. Take it all in.', composition: 'editorial' },
 'sunshine-split': { background: '#fff2dc', ink: '#6d3829', headline: 'You are pure sunshine.', message: 'Thank you for showing up in your own lovely way.', composition: 'split' },
 'memory-window': { background: '#e4dcd1', ink: '#293c38', headline: 'The view from here is wonderful.', message: 'Here is to the memories still waiting to be made.', composition: 'landscape' },
 'paper-party': { background: '#f2e9f0', ink: '#463447', headline: 'You did a brilliant thing.', message: 'A whole new chapter deserves a celebration.', composition: 'collage' },
};
const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
// Older public projections recognize only the original ten renderer keys.
// Local demo art is already public. Resolve only a matching known slug AND asset;
// never fetch or expose private template configuration to identify new designs.
export function publicDesignKey(card) {
 if (Object.hasOwn(designs,card.design_key)) return card.design_key;
 return Object.keys(designs).find(key => card.slug === `demo-${key}` && card.preview_assets?.some(asset => asset.storage_path === `demo-cards/${key}-preview.svg` || asset.storage_path === `demo-cards/${key}-thumb.svg`)) || null;
}
function text(value, x, y, width, size, { maxLines = 3, align = 'middle', family = 'Georgia,serif', weight = 400, fill = 'currentColor' } = {}) {
 const content = String(value ?? '');
 const wrap = () => {
  const measure = value => Array.from(value).reduce((sum, char) => sum + (/[MW@%]/.test(char) ? 1.08 : /[ilI.,'! :;]/.test(char) ? .38 : /[A-Zmw]/.test(char) ? .86 : char.codePointAt(0) > 255 ? 1.1 : .67), 0) * size;
  const words = content.split(/\s+/).flatMap(word => {
   const chunks = []; let chunk = '';
   for (const char of word) { if (chunk && measure(chunk + char) > width) { chunks.push(chunk); chunk = ''; } chunk += char; }
   if (chunk) chunks.push(chunk);
   return chunks;
  });
  const lines = []; let line = '';
  for (const word of words) { if (measure((line + ' ' + word).trim()) > width && line) { lines.push(line); line = word; } else line = (line + ' ' + word).trim(); }
  if (line) lines.push(line);
  return lines;
 };
 let shown = wrap();
 while (shown.length > maxLines && size > .01) { size = Math.max(.01, size - Math.min(.5, size * .1)); shown = wrap(); }
 return `<text x="${x}" y="${y}" text-anchor="${align}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}"><title>${escape(value)}</title>${shown.map((v,i)=>`<tspan x="${x}" dy="${i ? size * 1.2 : 0}">${escape(v)}</tspan>`).join('')}</text>`;
}
const star = (x,y,r,color) => `<path d="M${x} ${y-r} L${x+r*.3} ${y-r*.3} L${x+r} ${y} L${x+r*.3} ${y+r*.3} L${x} ${y+r} L${x-r*.3} ${y+r*.3} L${x-r} ${y} L${x-r*.3} ${y-r*.3}Z" fill="${color}"/>`;
export function renderCardSvg(key, values = {}, { animate = true, replay = 0, photoData = null } = {}) {
 const d = designs[key] || designs['birthday-type'];
 const name = values.recipient_name || 'Someone wonderful';
 const sender = values.sender_name ? `From ${values.sender_name}` : 'With a little love';
 const headline = values.main_headline || d.headline;
 const themedMessage = key === 'space-explorer' && values.interests ? `A universe of ${values.interests} awaits your next adventure.`
  : key === 'older-wiser' && values.humour_style ? ({ Gentle: 'Another year of being wonderfully you.', Cheeky: 'Still younger than you will be next year.', Dry: 'A birthday. Statistically inevitable.' }[values.humour_style])
  : key === 'botanical-wishes' && values.tone ? ({ Warm: 'A little warmth for every day ahead.', Heartfelt: 'You bring so much good into the lives around you.', Simple: 'Wishing you a wonderful birthday.' }[values.tone]) : d.message;
 const message = values.custom_message || themedMessage || d.message;
 const age = values.recipient_age ? `${values.recipient_age}` : '';
 let art = ''; let regions = '';
 const body = (y=540, color=d.ink) => text(message,300,y,450,24,{maxLines:4,fill:color}) + text(sender,300,740,440,19,{family:'Arial,sans-serif',fill:color,maxLines:1});
 if (d.composition === 'photo') {
  const photo = typeof photoData === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(photoData) ? photoData : null;
  art = '<rect x="45" y="40" width="510" height="720" rx="22" fill="none" stroke="#d9c3a2" stroke-width="2"/><rect x="80" y="160" width="440" height="330" rx="12" fill="#e3ddcf"/>';
  art += photo ? '<defs><clipPath id="recipient-photo"><rect x="80" y="160" width="440" height="330" rx="12"/></clipPath></defs><image x="80" y="160" width="440" height="330" preserveAspectRatio="xMidYMid slice" clip-path="url(#recipient-photo)" href="'+escape(photo)+'"/>' : text('YOUR FAVOURITE MEMORY',300,330,380,18,{family:'Arial,sans-serif'});
  regions = text(name,300,104,440,32,{maxLines:1}) + text(headline,300,555,440,34,{maxLines:2}) + text(message,300,642,430,22,{maxLines:3}) + text(sender,300,736,430,18,{maxLines:1});
 } else if (d.composition === 'disco-cat' || d.composition === 'catnap') {
  art = (animate ? catMotion : '') + (d.composition === 'disco-cat' ? discoCat() : catnapCake());
  regions = text(d.composition === 'disco-cat' ? 'THE BIRTHDAY MIX' : 'THE SLOW BIRTHDAY CLUB',300,72,450,14,{family:'Arial,sans-serif',weight:700}) + text(headline,300,128,460,43,{maxLines:2,weight:700}) + text(name,300,558,455,29,{maxLines:1}) + text(message,300,613,440,23,{maxLines:4}) + text(sender,300,737,440,18,{family:'Arial,sans-serif',maxLines:1});
 } else if (d.composition === 'type') {
  art = '<circle cx="485" cy="126" r="54" fill="#edbc82"/><path d="M62 675h476" stroke="#263f37" stroke-width="2"/>';
  regions = text('A DAY JUST FOR',90,115,400,16,{align:'start',family:'Arial,sans-serif',weight:700}) + text(name,90,190,420,35,{align:'start',maxLines:2}) + text(headline,90,335,430,70,{align:'start',maxLines:3,weight:700}) + text(message,90,600,420,23,{align:'start',maxLines:2}) + text(sender,90,725,420,19,{align:'start',maxLines:1});
 } else if (d.composition === 'space') {
  art = Array.from({length:15},(_,i)=>star(40+(i*107)%520,35+(i*83)%420,4+i%3,'#ffe29f')).join('') + '<circle cx="300" cy="300" r="111" fill="#d8b9f3"/><ellipse cx="300" cy="300" rx="182" ry="30" fill="none" stroke="#f8c66a" stroke-width="20" transform="rotate(-24 300 300)"/><path d="M415 120l55-45 12 72-26 25z" fill="#f7eee2"/><path d="M452 160l-8 45 25-31" fill="#f48e6d"/>';
  regions = text(`${name}${age ? ` • ${age} today` : ''}`,300,100,470,30,{maxLines:2}) + text(headline,300,490,470,43,{weight:700}) + body(625);
 } else if (d.composition === 'confetti') {
  art = Array.from({length:24},(_,i)=>`<rect x="${20+(i*79)%550}" y="${30+(i*137)%700}" width="${i%2?12:22}" height="${i%2?30:12}" rx="4" fill="${['#fa714c','#579c90','#9e78cc'][i%3]}" transform="rotate(${i*21} ${20+(i*79)%550} ${30+(i*137)%700})"/>`).join('') + '<ellipse cx="100" cy="230" rx="48" ry="62" fill="#fa714c"/><path d="M100 292q-35 60 10 110" fill="none" stroke="#573287" stroke-width="3"/>';
  regions = text(headline,300,180,430,60,{weight:700,family:'Arial,sans-serif'}) + text(age || '★',310,420,240,140,{weight:700,family:'Arial,sans-serif'}) + text(name,300,510,430,35,{maxLines:2}) + body(625);
 } else if (d.composition === 'botanical') {
  art = '<path d="M55 690Q140 370 85 100M530 700Q440 410 525 130" fill="none" stroke="#7b9374" stroke-width="4"/>' + Array.from({length:12},(_,i)=>`<ellipse cx="${i%2?505:90}" cy="${120+Math.floor(i/2)*105}" rx="20" ry="49" fill="${i%3?'#abbc9b':'#c9ac78'}" transform="rotate(${i%2?-40:40} ${i%2?505:90} ${120+Math.floor(i/2)*105})"/>`).join('');
  regions = text(values.relationship ? `FOR MY ${values.relationship.toUpperCase()}` : 'FOR YOUR NEXT CHAPTER',300,170,360,15,{family:'Arial,sans-serif'}) + text(name,300,255,360,37,{maxLines:2}) + text(headline,300,385,355,43) + body(570);
 } else if (d.composition === 'funny') {
  art = '<path d="M65 640q230-70 470 0" fill="none" stroke="#221f28" stroke-width="5"/><circle cx="470" cy="675" r="45" fill="#f9df9d"/>' + text(age || 'HA!',470,690,80,30,{family:'Arial,sans-serif',weight:700});
  regions = text(name.toUpperCase(),55,85,490,25,{align:'start',family:'Arial,sans-serif',weight:700,maxLines:1}) + text(headline,55,205,490,75,{align:'start',family:'Arial,sans-serif',weight:900,maxLines:4}) + text(message,55,560,470,24,{align:'start',maxLines:2}) + text(sender,55,740,480,19,{align:'start',maxLines:1});
 } else if (d.composition === 'frame') {
  art = '<rect x="32" y="32" width="536" height="736" rx="100" fill="none" stroke="#9b3932" stroke-width="3"/><rect x="48" y="48" width="504" height="704" rx="90" fill="none" stroke="#c3a35e" stroke-width="2"/>' + star(300,130,35,'#c3a35e');
  regions = text(name,300,240,400,30,{maxLines:2}) + text(headline,300,365,380,51) + body(570);
 } else if (d.composition === 'editorial') {
  art = '<rect x="420" y="0" width="180" height="800" fill="#ee6b40"/><circle cx="480" cy="655" r="92" fill="#f5d679"/><path d="M45 100h510M45 705h350" stroke="#1b3b57" stroke-width="2"/>';
  regions = text('THE GOOD NEWS EDITION',45,70,460,16,{align:'start',family:'Arial,sans-serif',weight:700}) + text(headline,45,205,470,83,{align:'start',family:'Arial,sans-serif',weight:900,maxLines:4}) + text(name,45,565,350,32,{align:'start',maxLines:2}) + text(message,45,645,330,21,{align:'start',maxLines:2}) + text(sender,45,755,450,18,{align:'start',maxLines:1});
 } else if (d.composition === 'split') {
  art = '<rect width="245" height="800" fill="#ebad73"/><circle cx="120" cy="335" r="77" fill="#ffe7a3"/><path d="M120 440v230M75 575q45-75 90 0" fill="none" stroke="#816d42" stroke-width="8"/>' + Array.from({length:8},(_,i)=>`<path d="M120 220v-45" stroke="#fff2dc" stroke-width="7" transform="rotate(${i*45} 120 335)"/>`).join('');
  regions = text(name,420,165,280,28,{maxLines:2}) + text(headline,420,300,270,44,{maxLines:4}) + text(message,420,565,260,23,{maxLines:4}) + text(sender,420,745,275,17,{maxLines:1});
 } else if (d.composition === 'landscape') {
  art = '<rect x="45" y="45" width="510" height="570" rx="220" fill="#a8c8c5"/><circle cx="400" cy="170" r="55" fill="#f8d69b"/><path d="M45 420L210 190l160 250 95-150 90 140v185H45" fill="#6e9991"/><path d="M45 520l190-160 175 190 145-100v165H45" fill="#345951"/><path d="M55 615h490" stroke="#e4dcd1" stroke-width="8"/>';
  regions = text(name,300,115,355,28,{fill:'#243b37',maxLines:2}) + text(headline,300,460,410,42,{fill:'#fff8e8',weight:700,maxLines:3}) + text(message,300,675,470,23,{maxLines:2}) + text(sender,300,755,440,18,{maxLines:1});
 } else {
  art = '<path d="M20 90l285-60 30 305L55 360z" fill="#e2b7c3"/><path d="M310 175l270 70-85 330-245-85z" fill="#dfac65"/><circle cx="170" cy="555" r="128" fill="#91aaa0"/><path d="M450 40l45 55-45 55-45-55z" fill="#a69bc6"/><path d="M95 320l390-45 40 220-390 45z" fill="#fff8e8"/>';
  regions = text(name,285,200,420,28,{maxLines:2}) + text(headline,300,365,360,43,{weight:700,maxLines:3}) + text(message,300,640,440,24,{maxLines:3}) + text(sender,300,755,440,18);
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800" role="img" aria-label="${escape(headline)}"${d.animated ? ` data-animation-run="${Number.isSafeInteger(replay) ? replay : 0}"` : ''}><rect width="600" height="800" fill="${d.background}"/><g color="${d.ink}">${art}${regions}</g></svg>`;
}
