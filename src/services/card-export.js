import { designs, renderCardSvg } from '../data/card-designs.js';

export const PNG_SIZE = Object.freeze({ width: 1500, height: 2000 });

// Only known, self-contained renderers are supported. Never substitute another design.
export function validateExportDesign(key, layout) {
  if (!Object.hasOwn(designs, key)) throw new Error('PNG export is not supported for this template yet.');
  if (layout && (layout.canvas?.width !== 600 || layout.canvas?.height !== 800 || layout.photo_upload || layout.background_path || layout.image_regions?.length || layout.decorative_assets?.length)) {
    throw new Error('This template requires a renderer that supports its artwork and dimensions. PNG export is unavailable.');
  }
}

export function cardFilename(title = 'personalized-card') {
  // Use the public design title only: no recipient, account identity, job ID or message.
  const slug = String(title).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '');
  return `${slug || 'personalized-card'}.png`;
}

export async function renderCardPng(key, values, layout) {
  validateExportDesign(key, layout);
  const svg = renderCardSvg(key, values, { animate: false }).replace('width="600" height="800"', 'width="1500" height="2000"');
  const source = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const canvas = document.createElement('canvas');
  canvas.width = PNG_SIZE.width;
  canvas.height = PNG_SIZE.height;
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('The card artwork could not be rendered. Please try again.'));
      image.src = source;
    });
    const context = canvas.getContext('2d');
    if (!context) throw new Error('PNG export is unavailable in this browser.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob || blob.type !== 'image/png') throw new Error('PNG generation failed. Please try again.');
    return blob;
  } finally {
    URL.revokeObjectURL(source);
    canvas.width = canvas.height = 0;
  }
}
