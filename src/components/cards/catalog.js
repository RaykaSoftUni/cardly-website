import { el } from '../../utils/dom.js';
import { createField } from '../forms/fields.js';
import { createCardListing } from './listing.js';
import { emptyState } from '../feedback/states.js';

export function createCatalog({ cards, initialFilters = {} }) {
  const filters = [
    createField({ name: 'search', label: 'Search sample cards', type: 'search', hint: 'Find a title or occasion.' }),
    ...['occasion', 'category', 'style'].map((name) => createField({ name, label: name[0].toUpperCase() + name.slice(1), value: initialFilters[name] || '', options: [{ value: '', label: `All ${name === 'category' ? 'categories' : `${name}s`}` }, ...new Set(cards.map((card) => card[name]))], hint: `Filter by ${name}.` })),
  ];
  const filterForm = el('form', { className: 'catalog-filters', role: 'search', 'aria-label': 'Filter sample cards', onSubmit: (event) => event.preventDefault() }, filters.map((field) => field.element));
  const resultStatus = el('p', { className: 'muted small', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const grid = el('div', { className: 'card-grid' });
  const update = () => {
    const values = Object.fromEntries(filters.map(({ name, input }) => [name, input.value]));
    const visible = cards.filter((card) => `${card.title} ${card.occasion} ${card.category} ${card.style}`.toLowerCase().includes(values.search.toLowerCase()) && ['occasion', 'category', 'style'].every((name) => !values[name] || card[name] === values[name]));
    grid.replaceChildren(...visible.map((card) => createCardListing({ card })));
    if (!visible.length) grid.append(emptyState({ title: 'No matching sample cards', description: 'Try a different occasion, style or search.' }));
    resultStatus.textContent = `${visible.length} sample ${visible.length === 1 ? 'card' : 'cards'} shown. This is a design preview, not a live catalogue.`;
  };
  filterForm.addEventListener('input', update);
  filterForm.addEventListener('change', update);
  update();
  return el('div', {}, [filterForm, resultStatus, grid]);
}
