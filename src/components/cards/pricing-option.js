import { el } from '../../utils/dom.js';
import { badge, button } from '../ui.js';

export function createPricingOption({ id, title, premium = false, price, priceNote, status, description, features, action }) {
  return el('article', { className: 'surface-panel pricing-option', 'aria-labelledby': id }, [
    el('div', { className: 'action-row' }, [badge(premium ? 'Premium' : 'Free', premium ? 'premium' : 'free'), badge(status)]),
    el('h2', { id }, title),
    el('p', { className: 'pricing-amount' }, price),
    el('p', { className: 'muted small' }, priceNote),
    el('p', {}, description),
    el('ul', { className: 'pricing-features' }, features.map(text => el('li', {}, text))),
    button({ ...action, variant: premium ? 'outline-primary' : 'primary' }),
  ]);
}
