import { el, uniqueId } from '../../utils/dom.js';
import { button, icon } from '../ui.js';

// Future integration must supply verified session state and a real logout callback.
// Admin navigation is deliberately not rendered until role checking is implemented.
export const futureAdminNavigation = Object.freeze([
  { label: 'Cards Management', href: '/admin/cards/' },
  { label: 'Categories', href: '/admin/categories/' },
  { label: 'Users', href: '/admin/users/' },
]);

export function createHeader({ pageId, authenticated = false, onLogout } = {}) {
  const menuId = uniqueId('site-menu');
  const nav = el('nav', { className: 'site-nav', id: menuId, 'aria-label': 'Main navigation' });
  const links = authenticated
    ? [['Home', '/', 'home'], ['Cards', '/cards/', 'cards'], ['My Cards', '/my-cards/', 'my-cards'], ['Saved Cards', '/my-cards/?view=saved', 'saved-cards'], ['Account', '/account/', 'account']]
    : [['Home', '/', 'home'], ['Cards', '/cards/', 'cards'], ['Login', '/login/', 'login'], ['Register', '/register/', 'register']];
  const list = el('ul', { className: 'navigation-list' });
  for (const [label, href, id] of links) list.append(el('li', {}, el('a', {
    href, className: id === 'register' ? 'nav-register' : '', 'aria-current': id === pageId ? 'page' : null,
  }, label)));
  if (authenticated) list.append(el('li', {}, button({ label: 'Logout', variant: 'quiet', disabled: !onLogout, onClick: onLogout })));
  nav.append(list);
  const toggle = button({ label: 'Menu', variant: 'quiet', iconName: 'list', onClick: () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(expanded));
    nav.classList.toggle('is-open', expanded);
  } });
  toggle.classList.add('menu-toggle');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', menuId);
  nav.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
  return el('header', { className: 'site-header' }, el('div', { className: 'page-container header-inner' }, [
    el('a', { href: '/', className: 'brand', 'aria-label': 'Cardly home' }, [icon('envelope-heart'), 'cardly', el('span', { className: 'brand-dot' }, '.')]), toggle, nav,
  ]));
}
