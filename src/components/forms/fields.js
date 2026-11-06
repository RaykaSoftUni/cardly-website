import { el, uniqueId } from '../../utils/dom.js';
import { button } from '../ui.js';

export function createField({ name, label, type = 'text', required = false, hint, options, value = '', min, max, maxLength = 500, accept } = {}) {
  const id = uniqueId(name);
  const input = el(options ? 'select' : type === 'textarea' ? 'textarea' : 'input', {
    id, name, className: options ? 'form-select' : 'form-control', type: options || type === 'textarea' ? null : type,
    required, min, max, maxlength: ['text', 'textarea', 'email'].includes(type) ? maxLength : null,
    rows: type === 'textarea' ? 4 : null, accept,
    'aria-describedby': `${id}-hint ${id}-error`,
  });
  if (options) for (const option of options) input.append(el('option', { value: typeof option === 'string' ? option : option.value }, typeof option === 'string' ? option : option.label));
  if (type !== 'file') input.value = value;
  const error = el('p', { id: `${id}-error`, className: 'field-error', hidden: true });
  const root = el('div', { className: 'field-group' }, [
    el('label', { for: id, className: 'form-label' }, [label, el('span', { className: 'field-requirement' }, required ? 'Required' : 'Optional')]),
    input, el('p', { id: `${id}-hint`, className: 'field-hint' }, hint || (required ? 'Please complete this field.' : 'Leave blank if you prefer.')), error,
  ]);
  function setError(message = '') {
    error.textContent = message;
    error.hidden = !message;
    input.classList.toggle('is-invalid', Boolean(message));
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
  function validate() {
    const whitespaceOnly = required && type !== 'file' && !input.value.trim();
    const message = whitespaceOnly ? `${label} is required.` : input.validationMessage;
    setError(message);
    return !message;
  }
  input.addEventListener('input', () => { if (input.hasAttribute('aria-invalid')) validate(); });
  input.addEventListener('blur', () => { if (input.value || input.hasAttribute('aria-invalid')) validate(); });
  return { element: root, input, name, setError, validate };
}

export function createForm({ fields, submitLabel = 'Update preview', onSubmit, onChange, description } = {}) {
  const form = el('form', { novalidate: true, className: 'design-form' });
  const summary = el('div', { className: 'validation-summary', role: 'alert', hidden: true, tabindex: '-1' });
  const controls = fields.map(createField);
  const values = () => Object.fromEntries(controls.map(({ name, input }) => [name, input.type === 'file' ? input.files[0] ?? null : input.value]));
  form.append(description ? el('p', { className: 'muted' }, description) : '', summary, ...controls.map(({ element }) => element));
  const submit = button({ label: submitLabel, type: 'submit', disabled: !onSubmit, iconName: 'arrow-right' });
  form.append(submit);
  form.addEventListener('input', () => onChange?.(values()));
  form.addEventListener('change', () => onChange?.(values()));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!onSubmit) return;
    const invalid = controls.filter((field) => !field.validate());
    summary.hidden = !invalid.length;
    if (invalid.length) {
      summary.textContent = `Please check ${invalid.length} ${invalid.length === 1 ? 'field' : 'fields'} below.`;
      invalid[0].input.focus();
      return;
    }
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    try { await onSubmit(values()); }
    catch { summary.hidden = false; summary.textContent = 'This action could not be completed. Please try again.'; summary.focus(); }
    finally { submit.disabled = false; form.removeAttribute('aria-busy'); }
  });
  return {
    element: form, values,
    setErrors(errors) { for (const control of controls) control.setError(errors[control.name]); },
    reset() { form.reset(); for (const control of controls) control.setError(); summary.hidden = true; onChange?.(values()); },
  };
}
