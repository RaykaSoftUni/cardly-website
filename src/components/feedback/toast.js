import { el, uniqueId } from '../../utils/dom.js';
import { button } from '../ui.js';
export function mountToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = el('div', { id: 'toast-container', className: 'toast-container', role: 'region', 'aria-label': 'Notifications' });
    document.body.append(container);
  }
  return container;
}
export function showToast({ message, tone = 'success' }) {
  const id = uniqueId('notification');
  const text = el('p', { id, role: tone === 'error' ? 'alert' : 'status', 'aria-atomic': 'true' });
  const notification = el('div', { className: `notification notification-${tone}` }, [text, button({ label: 'Dismiss', variant: 'quiet', onClick: () => notification.remove() })]);
  mountToastContainer().append(notification);
  // Insert after mounting so live regions announce the update. No forced timeout.
  requestAnimationFrame(() => { text.textContent = message; });
  return () => notification.remove();
}
