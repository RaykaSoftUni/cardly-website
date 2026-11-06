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
  renderDesignPage(main, pageId);
  document.querySelector('footer')?.remove();
  document.body.append(createFooter());
  mountToastContainer();
}
