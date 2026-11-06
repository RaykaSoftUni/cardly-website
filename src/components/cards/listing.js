import { el, safeUrl } from '../../utils/dom.js';
import { button, badge, icon } from '../ui.js';
import { createCardPreview } from './preview.js';

export function priceAndAvailability({ paid = false, price, available = false, published = true }) {
  const formatted = Number.isFinite(price) && price >= 0 ? new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(price) : 'Price to be confirmed';
  return el('div', { className: 'price-status' }, [
    badge(paid ? 'Paid · Premium' : 'Free', paid ? 'premium' : 'free'),
    paid && el('span', { className: 'price' }, formatted),
    el('span', { className: 'availability' }, [icon(!published ? 'eye-slash' : available ? 'check-circle' : 'clock'), !published ? 'Unpublished' : available ? 'Available' : 'Currently unavailable']),
  ]);
}

export function createCardListing({ card, onPersonalize, canPersonalize = card.available && !card.paid && card.published !== false }) {
  return el('article', { className: 'catalog-card' }, [
    createCardPreview({ ...card.preview, sample: true }).element,
    el('div', { className: 'catalog-card-body' }, [
      el('p', { className: 'eyebrow' }, `${card.occasion} · ${card.style}`),
      el('h3', {}, el('a', { href: `/card/?id=${encodeURIComponent(card.id)}` }, card.title)),
      el('p', { className: 'muted small' }, card.category),
      priceAndAvailability(card),
      button({ label: canPersonalize ? 'Personalize sample' : 'Personalization unavailable', variant: 'outline-primary', iconName: 'arrow-up-right', disabled: !canPersonalize,
        href: onPersonalize ? undefined : `/card-editor/?id=${encodeURIComponent(card.id)}`, onClick: () => onPersonalize?.(card) }),
    ]),
  ]);
}

export function createCategoryCard({ label, description, iconName = 'gift', href }) {
  return el('a', { className: 'category-card', href: safeUrl(href) }, [icon(iconName), el('span', {}, [el('strong', {}, label), el('span', { className: 'muted small d-block' }, description)]), icon('arrow-up-right')]);
}
