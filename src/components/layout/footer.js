import { el } from '../../utils/dom.js';
import { icon } from '../ui.js';
export function createFooter() {
  return el('footer', { className: 'site-footer' }, el('div', { className: 'page-container footer-inner' }, [
    el('div', {}, [el('a', { href: '/', className: 'brand' }, [icon('envelope-heart'), 'cardly.']), el('p', { className: 'muted' }, 'A little more personal. A little more you.')]),
    el('nav', { 'aria-label': 'Footer navigation' }, [el('a', { href: '/cards/' }, 'Explore cards'), el('a', { href: '/faq/' }, 'FAQ'), el('a', { href: '/categories/' }, 'Occasions & categories')]),
    el('p', { className: 'footer-note' }, 'Design preview · Sample cards, real possibilities.'),
  ]));
}
