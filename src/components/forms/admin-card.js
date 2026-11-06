import { el } from '../../utils/dom.js';
import { button } from '../ui.js';
import { createForm } from './fields.js';
import { personalizationFields } from './personalization.js';

export function createAdminCardForm({ onSubmit, onPublish, onUnpublish, onArchive } = {}) {
  const fields = [
    { name: 'title', label: 'Card title', required: true, maxLength: 100 },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'occasion', label: 'Occasion', required: true, options: ['', 'Birthday', 'Thank you', 'Congratulations', 'Anniversary', 'Christmas'] },
    { name: 'category', label: 'Category', required: true, options: ['', 'For friends', 'For family', 'For a partner', 'For colleagues'] },
    { name: 'style', label: 'Style', options: ['Botanical', 'Playful', 'Minimal', 'Celestial'] },
    { name: 'publication', label: 'Publication', options: [{ value: 'draft', label: 'Draft / unpublished' }, { value: 'published', label: 'Published' }] },
    { name: 'availability', label: 'Availability', options: [{ value: 'unavailable', label: 'Currently unavailable' }, { value: 'available', label: 'Available' }] },
    { name: 'pricing', label: 'Free or paid', options: [{ value: 'free', label: 'Free' }, { value: 'paid', label: 'Paid' }] },
    { name: 'price', label: 'Price in EUR', type: 'number', min: 0, hint: 'For paid cards. Payments are not connected.' },
    { name: 'preview', label: 'Preview image', type: 'file', accept: 'image/png,image/jpeg,image/webp', hint: 'Image storage is not connected.' },
  ];
  const form = createForm({ fields, submitLabel: 'Save card', onSubmit: onSubmit ? () => onSubmit(form.values()) : undefined });
  form.element.querySelector('[name="price"]').step = '0.01';
  const configuration = el('fieldset', { className: 'field-group' }, el('legend', {}, 'Personalization fields'));
  for (const field of personalizationFields) configuration.append(el('label', { className: 'check-label' }, [el('input', { type: 'checkbox', name: `field-${field.name}`, value: field.name, checked: true }), field.label]));
  form.element.insertBefore(configuration, form.element.lastElementChild);
  const values = form.values;
  form.values = () => ({ ...values(), personalizationFields: [...configuration.querySelectorAll('input:checked')].map((input) => input.value) });
  const actions = el('div', { className: 'action-row mt-4' }, [
    button({ label: 'Publish', variant: 'outline-primary', disabled: !onPublish, onClick: () => onPublish?.(form.values()) }),
    button({ label: 'Unpublish', variant: 'outline-primary', disabled: !onUnpublish, onClick: () => onUnpublish?.(form.values()) }),
    button({ label: 'Archive card', variant: 'danger', disabled: !onArchive, onClick: () => onArchive?.(form.values()) }),
  ]);
  return { ...form, element: el('div', { className: 'surface-panel' }, [el('p', { className: 'sample-notice' }, 'Administration UI preview · No data is saved. Actions require a future authorized service.'), form.element, actions]) };
}
