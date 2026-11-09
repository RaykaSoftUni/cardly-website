import { showPageLoading, finishPageLoading, pageLoadError } from './feedback/page-loading.js';
import { createHeader } from './layout/header.js';
import { createFooter } from './layout/footer.js';
import { mountToastContainer } from './feedback/toast.js';
import { renderPricingPage } from '../pages/pricing-content.js';
import { renderFaqPage } from '../pages/faq-content.js';
import { renderDesignPage } from '../pages/design-pages.js';
const connectedPages = new Set(['home', 'cards', 'category', 'categories', 'card', 'card-editor', 'card-preview', 'login', 'my-cards']);
const accountPages = new Set(['account', 'forgot-password', 'reset-password']);

export function initializePage(pageId) {
  if (!pageId.startsWith('admin') && !connectedPages.has(pageId) && !accountPages.has(pageId)) document.querySelector('header').replaceWith(createHeader({ pageId }));
  const main = document.querySelector('main');
  main.className = 'page-container page-main';
  showPageLoading(main);
  if (pageId.startsWith('admin')) {
    import('../pages/admin-pages.js').then(({ renderAdminPage }) => renderAdminPage(main, pageId)).catch(() => {
      pageLoadError(main, 'Administrator access could not be checked. Please sign in and try again.');
    });
  } else if (accountPages.has(pageId)) {
    import('../pages/account-pages.js').then(({ renderAccountPage }) => renderAccountPage(main, pageId)).catch(() => {
      pageLoadError(main, 'Your account could not connect. Please refresh and try again.');
    });
  } else if (connectedPages.has(pageId)) {
    import('../pages/catalog-pages.js').then(({ renderCatalogPage }) => renderCatalogPage(main, pageId)).catch(() => {
      pageLoadError(main, 'Cardly could not connect. Check the Supabase configuration and try again.');
    });
  } else if (pageId === 'pricing') { renderPricingPage(main); finishPageLoading(main);
  } else if (pageId === 'faq') { renderFaqPage(main); finishPageLoading(main);
  } else { renderDesignPage(main, pageId); finishPageLoading(main); }
  document.querySelector('footer')?.remove();
  document.body.append(createFooter());
  mountToastContainer();
}
