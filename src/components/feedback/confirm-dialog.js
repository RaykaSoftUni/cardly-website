import { el, uniqueId } from '../../utils/dom.js';
import { button } from '../ui.js';
// Native modal dialog provides focus containment, inert background, and Escape.
export function confirmDialog({ title, message, confirmLabel = 'Confirm', destructive = false }) {
  const previousFocus = document.activeElement;
  const titleId = uniqueId('dialog-title');
  const messageId = uniqueId('dialog-description');
  const dialog = el('dialog', { className: 'confirmation-dialog', 'aria-labelledby': titleId, 'aria-describedby': messageId });
  return new Promise((resolve) => {
    const cancel = button({ label: 'Cancel', variant: 'outline-primary', onClick: () => dialog.close('cancel') });
    cancel.autofocus = true;
    dialog.append(el('h2', { id: titleId }, title), el('p', { id: messageId, className: 'muted' }, message), el('div', { className: 'action-row' }, [cancel, button({ label: confirmLabel, variant: destructive ? 'danger' : 'primary', onClick: () => dialog.close('confirm') })]));
    dialog.addEventListener('close', () => {
      const confirmed = dialog.returnValue === 'confirm';
      dialog.remove();
      previousFocus?.focus();
      resolve(confirmed);
    }, { once: true });
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button:not(:disabled)')];
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}
