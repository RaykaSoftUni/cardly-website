import { el } from '../utils/dom.js';
import { button, section } from '../components/ui.js';
import { createForm } from '../components/forms/fields.js';
import { createHeader } from '../components/layout/header.js';
import { confirmDialog } from '../components/feedback/confirm-dialog.js';
import * as admin from '../services/admin-service.js';
import { createAssetManager } from '../components/admin/asset-manager.js';
import { showPageLoading, finishPageLoading, createPageLoading } from '../components/feedback/page-loading.js';

const yesNo = [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }];
const option = (value, label = value) => ({ value, label });
const textarea = (name, label, value, hint) => ({ name, label, type: 'textarea', value, maxLength: 100000, hint });
const json = (value, nullable = false) => {
  if (nullable && !value.trim()) return null;
  let parsed;
  try { parsed = JSON.parse(value); } catch { throw new Error('Enter valid JSON configuration. Your input has been kept.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Configuration must be a JSON object.');
  return parsed;
};
let subscription;
let cleanup = () => {};

function intro(title, description) {
  return el('div', { className: 'page-intro' }, [el('p', { className: 'eyebrow' }, 'Administration'), el('h1', {}, title), el('p', { className: 'muted' }, description)]);
}
function table(headers, rows) {
  return el('div', { className: 'admin-table-scroll' }, el('table', { className: 'table align-middle' }, [
    el('thead', {}, el('tr', {}, headers.map(h => el('th', { scope: 'col' }, h)))),
    el('tbody', {}, rows.length ? rows.map(cells => el('tr', {}, cells.map(cell => el('td', {}, cell)))) : el('tr', {}, el('td', { colspan: headers.length }, 'No records to show.'))),
  ]));
}
function nav() {
  return el('nav', { className: 'admin-navigation', 'aria-label': 'Administration' }, [
    ['Dashboard', '/admin/'], ['Cards', '/admin/cards/'], ['Categories', '/admin/categories/'],
    ['Occasions', '/admin/categories/?type=occasions'], ['Users and roles', '/admin/users/'], ['Generation metadata', '/admin/?view=generations'],
  ].map(([label, href]) => el('a', { className: 'btn btn-outline-primary', href }, label)));
}
function denied(main, context) {
  cleanup();
  finishPageLoading(main);
  main.replaceChildren(intro(context?.user ? 'Administrator access required' : 'Administrator sign-in required', 'This area requires an authenticated account with the database Admin role.'),
    button({ label: 'Sign in', href: `/login/?next=${encodeURIComponent(location.pathname + location.search)}` }), button({ label: 'Public catalog', href: '/cards/', variant: 'quiet' }));
  document.querySelector('header').replaceWith(createHeader({ authenticated: Boolean(context?.user), onLogout: async () => { await admin.logoutAdmin(); location.assign('/login/'); } }));
}
function managedForm({ fields, submitLabel = 'Save changes', onSave, success, onUnauthorized }) {
  const form = createForm({ fields, submitLabel, onSubmit: async values => {
    form.setError('');
    try { const saved = await onSave(values); if (saved !== false) await success?.(saved); }
    catch (error) { form.setError(admin.adminError(error)); if (error.code === '42501') onUnauthorized?.(); }
  } });
  return form;
}
function confirmRemoval(title, message) {
  return confirmDialog({ title, message, confirmLabel: 'Confirm', destructive: true });
}
export async function renderAdminPage(main, pageId) {
  subscription?.unsubscribe(); cleanup();
  showPageLoading(main);
  let context;
  try { context = await admin.adminContext(); }
  catch { main.replaceChildren(intro('Authorization check unavailable', 'Please try again when the connection is restored.'), button({ label: 'Try again', onClick: () => renderAdminPage(main, pageId) })); finishPageLoading(main); return; }
  if (!context.isAdmin) return denied(main, context);
  document.querySelector('header').replaceWith(createHeader({ pageId, authenticated: true, isAdmin: true, onLogout: async () => { await admin.logoutAdmin(); location.assign('/login/'); } }));
  subscription = admin.watchAdminLogout(() => denied(main, null));
  const verify = async () => { try { const next = await admin.adminContext(); if (!next.isAdmin) denied(main, next); } catch { /* Mutations still verify and fail closed. */ } };
  window.addEventListener('focus', verify);
  const objectUrls = [];
  let assetManager;
  cleanup = () => { assetManager?.destroy(); window.removeEventListener('focus', verify); for (const url of objectUrls) URL.revokeObjectURL(url); };
  const feedback = el('p', { className: 'admin-feedback', role: 'status', 'aria-live': 'polite' });
  const content = el('div', {}, createPageLoading());
  const success = message => { feedback.textContent = message; feedback.classList.remove('text-danger'); };
  const fail = error => { feedback.textContent = admin.adminError(error); feedback.classList.add('text-danger'); if (error.code === '42501') verify(); };
  const guarded = (label, action, { destructive = false, message = '' } = {}) => button({ label, variant: destructive ? 'outline-danger' : 'outline-primary', onClick: async event => {
    const control = event.currentTarget;
    if (destructive && !await confirmRemoval(label, message || 'This changes catalog visibility. Continue?')) return;
    control.disabled = true;
    try { await action(); } catch (error) { fail(error); } finally { control.disabled = false; }
  } });
  const formOptions = { onUnauthorized: verify };
  const patchCard = async (card, patch, message) => { await admin.saveAdminData('cards', patch, card.id); success(message); await cards(); };
  async function cards() {
    const rows = await admin.listAdminData('cards');
    rows.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
    content.replaceChildren(intro('Manage cards', 'Draft and archived cards stay out of the public catalog. Paid cards remain unavailable during the MVP.'),
      button({ label: 'Create card', href: '/admin/card-edit/' }),
      table(['Card', 'Publication', 'Pricing', 'Availability', 'Featured', 'Actions'], rows.map(card => [
        el('a', { href: `/admin/card-edit/?id=${card.id}` }, card.title), card.status,
        card.pricing_type === 'paid' ? `${card.price == null ? 'Price unset' : new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(card.price)} · paid` : 'Free',
        card.is_available ? 'Available' : 'Unavailable', card.is_featured ? 'Yes' : 'No',
        el('div', { className: 'admin-actions' }, [
          button({ label: 'View / edit', href: `/admin/card-edit/?id=${card.id}`, variant: 'quiet' }),
          card.status !== 'published' && guarded('Publish', () => patchCard(card, { status: 'published' }, 'Card published.')),
          card.status === 'published' && guarded('Unpublish', () => patchCard(card, { status: 'draft' }, 'Card unpublished.'), { destructive: true }),
          card.status !== 'archived' && guarded('Archive', () => patchCard(card, { status: 'archived' }, 'Card archived.'), { destructive: true, message: 'Archive this card? Existing saved cards and snapshots are preserved.' }),
        ]),
      ])));
  }
  async function taxonomy(entity) {
    const rows = await admin.listAdminData(entity);
    rows.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    const editor = el('section', { className: 'surface-panel mt-4' });
    const edit = row => {
      const form = managedForm({ ...formOptions, fields: [
        { name: 'name', label: 'Name', required: true, value: row?.name || '' },
        { name: 'slug', label: 'Unique slug', required: true, value: row?.slug || '' },
        textarea('description', 'Description', row?.description || ''),
        { name: 'sort_order', label: 'Display order', type: 'number', required: true, min: 0, value: row?.sort_order ?? 0 },
        { name: 'is_active', label: 'Active', options: yesNo, value: String(row?.is_active ?? true) },
      ], onSave: async values => {
        if (row?.is_active && values.is_active === 'false' && !await confirmRemoval('Deactivate?', 'Associated catalog cards will no longer be publicly visible.')) return false;
        return admin.saveAdminData(entity, { ...values, sort_order: Number(values.sort_order), is_active: values.is_active === 'true' }, row?.id);
      }, success: async () => { success('Catalog grouping saved.'); await taxonomy(entity); } });
      editor.replaceChildren(el('h2', {}, row ? `Edit ${row.name}` : `Create ${entity === 'occasions' ? 'occasion' : 'category'}`), form.element);
    };
    content.replaceChildren(intro(entity === 'occasions' ? 'Manage occasions' : 'Manage categories', 'Deactivate rather than deleting catalog groupings used by saved cards.'),
      button({ label: entity === 'occasions' ? 'New occasion' : 'New category', onClick: () => { edit(null); editor.scrollIntoView({ block: 'start' }); } }),
      table(['Name', 'Slug', 'Order', 'State', 'Actions'], rows.map(row => [row.name, row.slug, row.sort_order, row.is_active ? 'Active' : 'Inactive', el('div', { className: 'admin-actions' }, [
        button({ label: `Edit ${row.name}`, variant: 'quiet', onClick: () => { edit(row); editor.scrollIntoView({ block: 'start' }); } }),
        guarded(row.is_active ? 'Deactivate' : 'Activate', async () => { await admin.saveAdminData(entity, { is_active: !row.is_active }, row.id); success('Visibility updated.'); await taxonomy(entity); }, { destructive: row.is_active, message: 'Associated catalog cards will be hidden. Continue?' }),
      ])])), editor);
    edit(null);
  }
  async function editCard() {
    const stagedAssets = assetManager?.hasPending() ? assetManager : null;
    if (!stagedAssets) assetManager?.destroy();
    const id = new URLSearchParams(location.search).get('id');
    const [card, categories, occasions, settings] = await Promise.all([id ? admin.getAdminCard(id) : null, admin.listAdminData('categories'), admin.listAdminData('occasions'), admin.assetSettings()]);
    const [templates, definitions, images] = card ? await Promise.all([admin.listAdminData('card_templates', id), admin.listAdminData('personalization_fields', id), admin.listAdminData('card_images', id)]) : [[], [], []];
    let savedId = card?.id;
    const fields = [
      { name: 'title', label: 'Card title', required: true, value: card?.title || '' },
      { name: 'slug', label: 'Unique slug', required: true, value: card?.slug || '' },
      textarea('description', 'Description', card?.description || ''),
      ...[['category_id', 'Category', categories], ['occasion_id', 'Occasion', occasions]].map(([name, label, rows]) => ({ name, label, value: card?.[name] || '', options: [option('', 'None'), ...rows.map(r => option(r.id, `${r.name}${r.is_active ? '' : ' (inactive)'}`))] })),
      { name: 'style', label: 'Visual style', value: card?.style || '' },
      { name: 'status', label: 'Publication', options: ['draft', 'published', 'archived'], value: card?.status || 'draft' },
      { name: 'pricing_type', label: 'Pricing type', options: ['free', 'paid'], value: card?.pricing_type || 'free' },
      { name: 'price', label: 'Price in EUR', type: 'number', min: 0, value: card?.price ?? '', hint: 'Required for paid cards. The currency is always EUR.' },
      { name: 'is_available', label: 'Available', options: yesNo, value: String(card?.is_available ?? false), hint: 'Paid cards remain unavailable until payment and entitlement support is implemented.' },
      { name: 'is_featured', label: 'Featured', options: yesNo, value: String(card?.is_featured ?? false) },
      { name: 'sort_order', label: 'Display order', type: 'number', min: 0, required: true, value: card?.sort_order ?? 0 },
    ];
    const form = managedForm({ ...formOptions, fields, submitLabel: 'Save card', onSave: async values => {
      if (values.pricing_type === 'paid' && values.price === '') { form.setErrors({ price: 'Enter the EUR price for a paid card.' }); throw new Error('A paid card needs a EUR price.'); }
      if (card && values.status !== card.status && ['draft', 'archived'].includes(values.status) && !await confirmRemoval('Change publication?', 'The card will no longer appear in the public catalog. Saved snapshots stay intact.')) return false;
      assetManager?.validatePending();
      const saved = await admin.saveAdminData('cards', { ...values, category_id: values.category_id || null, occasion_id: values.occasion_id || null, currency: 'EUR', price: values.pricing_type === 'free' ? null : Number(values.price),
        is_available: values.pricing_type === 'free' && values.is_available === 'true', is_featured: values.is_featured === 'true', sort_order: Number(values.sort_order) }, savedId);
      savedId = saved.id;
      assetManager?.bindCard(savedId);
      if (assetManager?.hasPending()) await assetManager.commit(savedId);
      return saved;
    }, success: async saved => {
      if (!id) { sessionStorage.setItem('cardly-admin-flash', 'Card created. Configure its template, fields and artwork below.'); location.assign(`/admin/card-edit/?id=${saved.id}`); }
      else { success('Card saved.'); await editCard(); }
    } });
    form.element.querySelector('[name="price"]').step = '.01';
    const pricing = form.element.querySelector('[name="pricing_type"]');
    const availability = form.element.querySelector('[name="is_available"]');
    const reflectPricing = () => { availability.disabled = pricing.value === 'paid'; if (availability.disabled) availability.value = 'false'; };
    pricing.addEventListener('change', reflectPricing); reflectPricing();
    content.replaceChildren(intro(card ? `Edit ${card.title}` : 'Create a card', 'Publication, pricing and availability are enforced by the database.'), el('section', { className: 'surface-panel' }, form.element));
    if (!card) { assetManager = stagedAssets || assetsEditor({ id: null }, [], settings); content.append(assetManager.element, el('p', { className: 'field-hint mt-3' }, 'Selected images upload when you save the card. Configure the template and personalization fields afterward.')); return; }

    assetManager = stagedAssets || assetsEditor(card, images, settings);
    content.append(templateEditor(card, templates[0]), fieldsEditor(card, definitions), assetManager.element);
  }
  function templateEditor(card, template) {
    const form = managedForm({ ...formOptions, fields: [
      { name: 'template_key', label: 'Unique template key', required: true, value: template?.template_key || '' },
      textarea('layout_config', 'Layout configuration (JSON)', JSON.stringify(template?.layout_config || { canvas: { width: 600, height: 800 }, regions: [], image_regions: [] }, null, 2), 'Define regions with field, x, y, width and height; image_regions may include a relative catalog storage_path and optional: true. Dynamic field keys must match supported personalization fields.'),
      textarea('style_config', 'Style configuration (JSON)', template?.style_config ? JSON.stringify(template.style_config, null, 2) : '', 'Optional JSON object. Empty means no separate style configuration.'),
    ], submitLabel: 'Save template revision', onSave: values => admin.saveAdminData('card_templates', { card_id: card.id, template_key: values.template_key, layout_config: json(values.layout_config), style_config: json(values.style_config, true) }, template?.id),
    success: async saved => { success(`Template saved at version ${saved.version}. Earlier versions remain intact.`); await editCard(); } });
    return section({ title: 'Card template', description: `Current version: ${template?.version || 'not configured'}. Configuration changes automatically create the next immutable version. Unchanged saves keep the current version.`, children: [el('section', { className: 'surface-panel' }, [form.element,
      el('p', { className: 'field-hint' }, 'Image regions use catalog assets; user-photo personalization is not enabled. Demo artwork uses its predefined design key. A future renderer must interpret the saved configuration snapshots.')])] });
  }
  function fieldsEditor(card, definitions) {
    const root = el('section', { className: 'page-section' });
    const editor = el('div', { className: 'surface-panel' });
    const ordered = [...definitions].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
    const edit = field => {
      const config = field?.config || {};
      const form = managedForm({ ...formOptions, fields: [
        { name: 'field_key', label: 'Field key', required: true, value: field?.field_key || '', maxLength: 64, hint: 'Lowercase letters, numbers and underscores; start with a letter. Unique within this card.' },
        { name: 'label', label: 'Field label', required: true, value: field?.label || '' },
        { name: 'field_type', label: 'Field type', options: ['text', 'textarea', 'number', 'select'], value: field?.field_type || 'text' },
        { name: 'placeholder', label: 'Placeholder', value: field?.placeholder || '' },
        { name: 'help_text', label: 'Field guidance', value: field?.help_text || '' },
        { name: 'is_required', label: 'Required', options: yesNo, value: String(field?.is_required ?? false) },
        { name: 'min_length', label: 'Minimum text length', type: 'number', min: 0, max: 10000, value: config.min_length ?? '' },
        { name: 'max_length', label: 'Maximum text length', type: 'number', min: 0, max: 10000, value: config.max_length ?? '' },
        { name: 'min', label: 'Minimum number', type: 'number', value: config.min ?? '' },
        { name: 'max', label: 'Maximum number', type: 'number', value: config.max ?? '' },
        textarea('options', 'Select options (one per line)', (config.options || []).join('\n'), 'Used only for select fields. Each line is one allowed value.'),
      ], submitLabel: field ? 'Update field' : 'Add field', onSave: values => {
        if (!/^[a-z][a-z0-9_]{0,63}$/.test(values.field_key)) throw new Error('Use a valid lowercase field key.');
        const settings = {};
        if (['text', 'textarea'].includes(values.field_type)) for (const key of ['min_length', 'max_length']) { if (values[key] !== '') settings[key] = Number(values[key]); }
        if (values.field_type === 'number') for (const key of ['min', 'max']) { if (values[key] !== '') settings[key] = Number(values[key]); }
        if (values.field_type === 'select') settings.options = values.options.split('\n').map(v => v.trim()).filter(Boolean);
        return admin.saveAdminData('personalization_fields', { card_id: card.id, field_key: values.field_key, label: values.label, field_type: values.field_type, placeholder: values.placeholder || null, help_text: values.help_text || null, is_required: values.is_required === 'true', config: settings, sort_order: field?.sort_order ?? ordered.length }, field?.id);
      }, success: async () => { success('Personalization field saved.'); await editCard(); } });
      editor.replaceChildren(el('h3', {}, field ? `Edit ${field.label}` : 'New personalization field'), form.element);
    };
    const move = async (index, direction) => {
      const ids = ordered.map(f => f.id);
      [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
      await admin.reorderFields(card.id, ids); success('Fields reordered.'); await editCard();
    };
    root.append(el('h2', {}, 'Personalization fields'), table(['Order', 'Label / key', 'Type', 'Actions'], ordered.map((f, i) => [f.sort_order, `${f.label} / ${f.field_key}${f.is_required ? ' (required)' : ''}`, f.field_type,
      el('div', { className: 'admin-actions' }, [button({ label: `Edit ${f.label}`, variant: 'quiet', onClick: () => edit(f) }), i > 0 && guarded(`Move ${f.label} up`, () => move(i, -1)), i < ordered.length - 1 && guarded(`Move ${f.label} down`, () => move(i, 1)),
        guarded(`Remove ${f.label}`, async () => { await admin.removeAdminData('personalization_fields', f.id); success('Field removed. Existing generation snapshots are preserved.'); await editCard(); }, { destructive: true, message: 'Remove this field from new personalization forms? Existing generation data stays unchanged.' })])])),
      button({ label: 'New personalization field', variant: 'quiet', onClick: () => edit(null) }), editor);
    edit(null); return root;
  }
  function assetsEditor(card, images, settings) {
    return createAssetManager({ cardId: card.id, images, settings,
      onBindCard: id => { card.id = id; },
      onUpload: (item, targetId) => admin.saveUploadedAsset(targetId, item),
      onUpdate: (asset, values) => admin.saveAssetMetadata(card.id, values, asset.id),
      onPrimary: asset => admin.saveAssetMetadata(card.id, { is_primary: true }, asset.id),
      onReorder: ids => admin.reorderAssets(card.id, ids),
      onConfigure: bytes => admin.assetSettings(bytes),
      onPreview: path => admin.assetPreview(path), onError: fail, onSuccess: success,
      onRemove: async asset => {
        if (!await confirmRemoval('Remove image?', 'Remove this catalog image? Files referenced by historical templates or generations will be retained.')) return false;
        await admin.removeAdminData('card_images', asset.id);
        try {
          const removed = await admin.deleteUnreferencedAsset(asset.storage_path);
          success(removed ? 'Image association and unreferenced file removed.' : 'Image removed from this card. Its file is retained for saved versions or static demo artwork.');
        } catch (error) { success('Image association removed. File cleanup needs a retry when authorization and the connection are available.'); if (error.code === '42501') verify(); }
        return true;
      },
    });
  }
  async function users() {
    const rows = await admin.listSupportData('users');
    content.replaceChildren(intro('Users and roles', 'Only basic account information is shown. Authentication secrets and password data are never returned.'),
      table(['Email', 'Display name', 'Role', 'Created', 'Actions'], rows.map(user => [user.email || 'No email', user.display_name || '—', user.role || 'user', new Date(user.created_at).toLocaleDateString(),
        user.id === context.user.id ? 'Your role cannot be changed here.' : guarded(user.role === 'admin' ? `Set ${user.email} to user` : `Make ${user.email} admin`, async () => { await admin.setUserRole(user.id, user.role === 'admin' ? 'user' : 'admin'); success('User role updated.'); await users(); }, { destructive: true, message: 'Change this account’s permissions? This takes effect for subsequent database requests.' }),
      ])));
  }
  async function generations() {
    const rows = await admin.listSupportData('generations');
    content.replaceChildren(intro('Generation metadata', 'Support view only: ownership, status and template references. Private messages, images, download paths and full snapshots are not exposed.'),
      table(['Generation', 'Owner ID', 'Card snapshot title', 'Template version', 'State', 'Created'], rows.map(row => [row.id, row.user_id, row.card_title, row.template_version, row.status, new Date(row.created_at).toLocaleString()])));
  }
  try {
    const flash = sessionStorage.getItem('cardly-admin-flash');
    if (flash) { success(flash); sessionStorage.removeItem('cardly-admin-flash'); }
    if (pageId === 'admin-cards') await cards();
    else if (pageId === 'admin-card-edit') await editCard();
    else if (pageId === 'admin-categories') await taxonomy(new URLSearchParams(location.search).get('type') === 'occasions' ? 'occasions' : 'categories');
    else if (pageId === 'admin-users') await users();
    else if (new URLSearchParams(location.search).get('view') === 'generations') await generations();
    else content.replaceChildren(intro('Administration workspace', 'Manage catalog content and permissions through authorized database operations.'), el('p', {}, 'Choose Cards to manage templates, fields and artwork; Categories or Occasions to manage discovery; Users and roles to manage access. Generation metadata provides a limited support view.'));
  } catch (error) { fail(error); if (content.querySelector('.page-loading')) content.replaceChildren(intro('Administration unavailable', 'Please retry when the connection is restored.')); }
  finally {
    // Keep the initial shell until the complete admin view is ready. A logout or
    // failed role recheck clears aria-busy, so it cannot restore privileged UI.
    if (main.getAttribute('aria-busy') === 'true') main.replaceChildren(nav(), feedback, content);
    finishPageLoading(main);
  }
}
