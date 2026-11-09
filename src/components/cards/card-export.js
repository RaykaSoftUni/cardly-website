import { el } from '../../utils/dom.js';
import { button } from '../ui.js';
import { cardFilename, renderCardPng } from '../../services/card-export.js';

export function createCardExport({ getInput, title }) {
  let url = null;
  let revision = 0;
  const feedback = el('p', { className: 'field-hint', role: 'status', 'aria-live': 'polite' });
  const download = el('a', { className: 'btn btn-primary', hidden: true }, 'Download Card');
  const invalidate = () => {
    revision++;
    download.hidden = true;
    download.removeAttribute('href');
    if (url) URL.revokeObjectURL(url);
    url = null;
    feedback.textContent = '';
  };
  const generate = button({ label: 'Generate PNG', variant: 'outline-primary', onClick: async () => {
    invalidate();
    const attempt = revision;
    generate.disabled = true;
    feedback.textContent = 'Generating your high-resolution PNG…';
    try {
      const input = await getInput();
      if (!input) { if (attempt === revision) feedback.textContent = 'Complete the required fields before generating.'; return; }
      const blob = await renderCardPng(input.key, input.values, input.layout, input.photoData);
      if (attempt !== revision) return;
      url = URL.createObjectURL(blob);
      download.href = url;
      download.download = cardFilename(title);
      download.hidden = false;
      feedback.textContent = 'PNG ready · 1500 × 2000 px. Animated designs export as a still image. This file is generated in your browser.';
    } catch (error) {
      if (attempt === revision) feedback.textContent = error.message || 'PNG generation failed. Please try again.';
    } finally { generate.disabled = false; }
  } });
  window.addEventListener('pagehide', invalidate, { once: true });
  return { element: el('div', { className: 'card-export mt-3' }, [el('div', { className: 'action-row' }, [generate, download]), feedback]), invalidate };
}
