import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../styles/main.css';
import { createHeader } from './layout/header.js';
import { createFooter } from './layout/footer.js';
import { mountToastContainer } from './feedback/toast.js';
import { renderDesignPage } from '../pages/design-pages.js';

export function initializePage(pageId) {
  document.querySelector('header').replaceWith(createHeader({ pageId }));
  const main = document.querySelector('main');
  main.className = 'page-container page-main';
  if (['home', 'cards', 'category', 'categories', 'card', 'card-editor', 'card-preview', 'login', 'my-cards'].includes(pageId)) {
    main.textContent = 'Loading Cardly…';
    import('../pages/catalog-pages.js').then(({ renderCatalogPage }) => renderCatalogPage(main, pageId)).catch(() => {
      main.textContent = 'Cardly could not connect. Check the Supabase configuration and try again.';
    });
  } else renderDesignPage(main, pageId);
  document.querySelector('footer')?.remove();
  document.body.append(createFooter());
  mountToastContainer();
}
