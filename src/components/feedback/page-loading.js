import { el } from '../../utils/dom.js';

export function createPageLoading() {
  return el('div', { className: 'page-loading', role: 'status' }, [
    el('span', { className: 'visually-hidden' }, 'Loading page…'),
    el('div', { className: 'loading-intro', 'aria-hidden': 'true' }, [
      el('div', { className: 'skeleton loading-eyebrow' }),
      el('div', { className: 'skeleton loading-title' }),
      el('div', { className: 'skeleton loading-description' }),
    ]),
    el('div', { className: 'card-grid', 'aria-hidden': 'true' }, Array.from({ length: 3 }, () => el('div', { className: 'skeleton-card' }, [
      el('div', { className: 'skeleton loading-art' }),
      el('div', { className: 'skeleton skeleton-line' }),
      el('div', { className: 'skeleton skeleton-line short' }),
    ]))),
  ]);
}
export function showPageLoading(main) {
  document.body.dataset.pageLoading = 'true';
  main.setAttribute('aria-busy', 'true');
  main.classList.remove('page-ready');
  // Reuse the HTML shell instead of replacing one loading view with another.
  if (!main.querySelector('.page-loading')) main.replaceChildren(createPageLoading());
}
export function finishPageLoading(main) {
  delete document.body.dataset.pageLoading;
  main.removeAttribute('aria-busy');
  main.classList.add('page-ready');
}
export function pageLoadError(main, message) {
  main.replaceChildren(el('div', { className: 'page-intro' }, [el('h1', {}, 'Page unavailable'), el('p', {}, message)]));
  finishPageLoading(main);
}
