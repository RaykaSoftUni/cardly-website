import { el, safeUrl } from '../utils/dom.js';

export function icon(name) {
  return el('i', { className: `bi bi-${name}`, 'aria-hidden': 'true' });
}

export function button({ label, variant = 'primary', href, onClick, disabled = false, type = 'button', iconName } = {}) {
  const content = [iconName && icon(iconName), el('span', {}, label)];
  const className = `btn btn-${variant}`;
  if (href && !disabled && safeUrl(href)) return el('a', { className, href: safeUrl(href), onClick }, content);
  return el('button', { className, type, disabled, onClick }, content);
}

export function badge(label, tone = 'neutral') {
  return el('span', { className: `status-badge status-${tone}` }, label);
}

export function section({ title, eyebrow, description, action, children = [] }) {
  return el('section', { className: 'page-section' }, [
    el('div', { className: 'section-heading' }, [el('div', {}, [
      eyebrow && el('p', { className: 'eyebrow' }, eyebrow),
      el('h2', {}, title), description && el('p', { className: 'muted' }, description),
    ]), action]), ...children,
  ]);
}
