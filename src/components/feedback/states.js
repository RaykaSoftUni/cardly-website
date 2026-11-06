import { el } from '../../utils/dom.js';
import { icon, button } from '../ui.js';
export function emptyState({ title = 'Nothing here just yet', description, action } = {}) {
  return el('div', { className: 'empty-state', role: 'status' }, [icon('envelope-open-heart'), el('h2', {}, title), el('p', { className: 'muted' }, description), action && button(action)]);
}
export function loadingSkeleton({ count = 3, label = 'Loading cards' } = {}) {
  return el('div', { role: 'status', 'aria-busy': 'true' }, [el('span', { className: 'visually-hidden' }, label),
    el('div', { className: 'card-grid', 'aria-hidden': 'true' }, Array.from({ length: count }, () => el('div', { className: 'skeleton-card' }, [el('div', { className: 'skeleton skeleton-art' }), el('div', { className: 'skeleton skeleton-line' }), el('div', { className: 'skeleton skeleton-line short' })]))),
  ]);
}
