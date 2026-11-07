import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { renderCardSvg } from '../src/data/card-designs.js';
const cards = JSON.parse(readFileSync(new URL('../supabase/seed/catalog.json', import.meta.url)));
const output = new URL('../public/demo-cards/', import.meta.url);
mkdirSync(output, { recursive: true });
for (const card of cards.filter(card => card.status === 'published')) {
  const svg = renderCardSvg(card.designKey, {
    recipient_name: 'Alex',
    recipient_age: ['space-explorer', 'wild-confetti'].includes(card.designKey) ? '8' : '',
  });
  writeFileSync(new URL(`${card.slug}-preview.svg`, output), svg);
  writeFileSync(new URL(`${card.slug}-thumb.svg`, output), svg.replace('width="600" height="800"', 'width="300" height="400"'));
}
console.log('Built local demo artwork for published cards only.');
