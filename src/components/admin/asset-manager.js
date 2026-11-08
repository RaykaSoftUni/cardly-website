import { el, uniqueId } from '../../utils/dom.js';
import { button, badge } from '../ui.js';
import { createField, createForm } from '../forms/fields.js';
const types = Object.entries({ thumbnail: 'Thumbnail', preview: 'Preview image', background: 'Background', hero: 'Hero illustration', decorative: 'Decorative asset' }).map(([value, label]) => ({ value, label }));
export function createAssetManager({ cardId, images = [], settings, onUpload, onUpdate, onRemove, onPrimary, onReorder, onConfigure, onPreview, onError, onSuccess, onBindCard }) {
  let records = [...images], queue = [], replacement = null, active = true, busy = false;
  const urls = new Set();
  const root = el('section', { className: 'page-section asset-manager', 'aria-label': 'Images & Assets' });
  const controls = el('fieldset', { className: 'asset-controls' }, el('legend', { className: 'visually-hidden' }, 'Card artwork'));
  const feedback = el('p', { role: 'status', 'aria-live': 'polite' });
  const gallery = el('div', { className: 'admin-assets-grid' });
  const selected = el('div', { className: 'admin-assets-grid asset-selection' });
  const inputId = uniqueId('asset-files');
  const picker = el('input', { id: inputId, type: 'file', multiple: true, accept: 'image/png,image/jpeg,image/webp', className: 'form-control' });
  const hint = el('p', { className: 'field-hint' });
  const drop = el('div', { className: 'asset-drop-zone' }, [el('p', {}, 'Drop images here, or choose files from your device.'), el('label', { for: inputId, className: 'form-label' }, 'Image files'), picker, hint]);
  const setHint = () => { hint.textContent = `JPEG, PNG or WebP · maximum ${settings.max_bytes / 1048576} MiB per file · up to 20 files per batch.`; };
  const revoke = url => { URL.revokeObjectURL(url); urls.delete(url); };
  const report = error => { feedback.textContent = error.message; onError?.(error); };
  const act = (label, action, disabled = false) => button({ label, disabled, variant: 'outline-primary', onClick: async event => {
    const control = event.currentTarget;
    control.disabled = true;
    try { await action(); } catch (error) { report(error); } finally { if (active) control.disabled = disabled; }
  } });
  const sorted = () => [...records].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  function showGallery() {
    const rows = sorted();
    if (!rows.length) { gallery.replaceChildren(el('div', { className: 'asset-placeholder', role: 'img', 'aria-label': 'No card preview image yet' }, 'No preview image yet. Add artwork below.')); return; }
    gallery.replaceChildren(...rows.map((asset, index) => {
      const img = el('img', { className: 'admin-asset-preview', alt: asset.alt_text || 'Card asset' });
      onPreview(asset.storage_path).then(url => { if (!active) { if (url.startsWith('blob:')) URL.revokeObjectURL(url); return; } if (url.startsWith('blob:')) urls.add(url); img.src = url; }).catch(() => img.replaceWith(el('p', {}, 'Image preview unavailable.')));
      const metadata = el('details', {}, el('summary', {}, `Edit ${asset.image_type} image details`));
      const form = createForm({ fields: [
        { name: 'image_type', label: 'Asset type', options: types, value: asset.image_type },
        { name: 'alt_text', label: 'Image description / alt text', required: true, value: asset.alt_text || '' },
      ], submitLabel: 'Save image details', onSubmit: async values => {
        try { const saved = await onUpdate(asset, values); records = records.map(r => r.id === saved.id ? saved : r); showGallery(); onSuccess?.('Image details saved.'); }
        catch (error) { form.setError(error.message); onError?.(error); }
      } });
      metadata.append(form.element);
      const move = async direction => {
        const order = rows.map(r => r.id);
        [order[index], order[index + direction]] = [order[index + direction], order[index]];
        await onReorder(order);
        records.forEach(r => { r.sort_order = order.indexOf(r.id); }); showGallery(); onSuccess?.('Images reordered.');
      };
      return el('article', { className: `surface-panel asset-tile ${asset.is_primary ? 'asset-primary' : ''}` }, [
        asset.is_primary && badge('Primary catalogue preview', 'premium'), img,
        el('p', {}, `${asset.image_type} · ${asset.alt_text}`),
        el('div', { className: 'admin-actions' }, [
          !asset.is_primary && act('Use as primary preview', async () => { const saved = await onPrimary(asset); records.forEach(r => { r.is_primary = r.id === saved.id; }); showGallery(); onSuccess?.('Primary catalogue preview updated.'); }),
          act(`Replace ${asset.image_type} image`, () => { replacement = asset; picker.multiple = false; feedback.textContent = `Choose a replacement for ${asset.alt_text}.`; picker.click(); }),
          act(`Remove ${asset.image_type} image`, async () => { if (await onRemove(asset)) { records = records.filter(r => r.id !== asset.id); showGallery(); } }),
          !asset.is_primary && index > (rows[0].is_primary ? 1 : 0) && act('Move image up', () => move(-1)),
          !asset.is_primary && index < rows.length - 1 && act('Move image down', () => move(1)),
        ]), metadata,
      ]);
    }));
  }
  function clearItem(item) { queue = queue.filter(r => r !== item); item.element.remove(); revoke(item.url); }
  function addFiles(files) {
    if (busy) return;
    files = [...files];
    if ((replacement && files.length !== 1) || queue.length + files.length > 20) { report(new Error('Choose one replacement, or at most 20 files in a batch.')); return; }
    for (const file of files) {
      const old = replacement;
      if (old && queue.some(item => item.replaceId === old.id)) { report(new Error('A replacement for that image is already queued.')); continue; }
      const item = { file, replaceId: old?.id, oldPath: old?.storage_path, url: URL.createObjectURL(file) };
      urls.add(item.url);
      const image = el('img', { className: 'admin-asset-preview', src: item.url, alt: `Selected file preview: ${file.name}` });
      image.addEventListener('error', () => image.replaceWith(el('p', {}, 'This file cannot be previewed. Choose a supported image.')), { once: true });
      item.type = createField({ name: 'image_type', label: 'Selected image type', options: types, value: old?.image_type || 'preview' });
      item.alt = createField({ name: 'alt_text', label: 'Selected image alt text', required: true, value: old?.alt_text || '', hint: 'Describe the artwork meaningfully. The filename is not used as alt text.' });
      const radioId = uniqueId('primary-asset');
      item.primary = el('input', { type: 'radio', id: radioId, name: `primary-${inputId}` });
      item.primary.checked = Boolean(old?.is_primary || (!records.some(r => r.is_primary) && !queue.length));
      if (item.primary.checked) queue.forEach(r => { r.primary.checked = false; });
      item.element = el('article', { className: 'surface-panel selected-asset' }, [image, el('p', {}, file.name), item.type.element, item.alt.element,
        el('label', { className: 'check-label', for: radioId }, [item.primary, 'Use as primary catalogue preview']),
        act('Discard selected image', () => clearItem(item)),
      ]);
      queue.push(item); selected.append(item.element);
    }
    replacement = null; picker.multiple = true; picker.value = '';
    feedback.textContent = cardId ? 'Review the selected previews and alt text, then upload.' : 'Images are staged. They will upload when you save the card.';
  }
  picker.addEventListener('change', () => addFiles(picker.files));
  picker.addEventListener('cancel', () => { replacement = null; picker.multiple = true; });
  drop.addEventListener('dragover', event => { event.preventDefault(); if (!busy) drop.classList.add('is-dragging'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-dragging'));
  drop.addEventListener('drop', event => { event.preventDefault(); drop.classList.remove('is-dragging'); addFiles(event.dataTransfer.files); });
  async function commit(targetCardId) {
    if (busy) throw new Error('Images are already uploading.');
    const invalid = queue.filter(item => !item.alt.validate() || !item.type.validate());
    if (invalid.length) { invalid[0].alt.input.focus(); throw new Error('Add meaningful alt text for each selected image.'); }
    busy = true; controls.disabled = true;
    try {
      for (const item of [...queue]) {
        const saved = await onUpload({ file: item.file, replaceId: item.replaceId, oldPath: item.oldPath, image_type: item.type.input.value, alt_text: item.alt.input.value.trim(), is_primary: item.primary.checked, sort_order: item.replaceId ? records.find(r => r.id === item.replaceId)?.sort_order ?? 0 : Math.max(-1, ...records.map(r => r.sort_order)) + 1 }, targetCardId);
        if (saved.is_primary) records.forEach(r => { r.is_primary = false; });
        records = records.filter(r => r.id !== saved.id); records.push(saved); clearItem(item);
        feedback.textContent = saved.cleanupPending ? 'Image saved. An older file needs cleanup when the connection is restored.' : 'Image saved.';
      }
      showGallery(); onSuccess?.(feedback.textContent || 'Images saved.');
    } finally { busy = false; controls.disabled = false; showGallery(); }
  }
  const limitForm = createForm({ fields: [{ name: 'max_mib', label: 'Maximum upload size (MiB)', type: 'number', min: 1, max: 20, required: true, value: settings.max_bytes / 1048576 }], submitLabel: 'Save upload limit', onSubmit: async values => {
    try { settings = await onConfigure(Number(values.max_mib) * 1048576); setHint(); onSuccess?.('Upload limit updated for all catalog assets.'); }
    catch (error) { limitForm.setError(error.message); onError?.(error); }
  } });
  controls.append(gallery, drop, selected);
  const uploadButton = button({ label: 'Upload selected images', onClick: () => commit(cardId).catch(report) });
  uploadButton.hidden = !cardId;
  controls.append(uploadButton);
  const limits = el('details', {}, [el('summary', {}, 'Upload settings'), limitForm.element]);
  root.append(el('h2', {}, 'Images & Assets'), el('p', { className: 'muted' }, 'Choose a primary catalogue image and add secondary artwork. Replacements preserve files referenced by saved versions.'), controls, feedback, limits);
  setHint(); showGallery();
  return { element: root, commit, bindCard(id) { cardId = id; uploadButton.hidden = false; onBindCard?.(id); }, hasPending: () => queue.length > 0, validatePending() { if (queue.some(item => !item.alt.validate() || !item.type.validate())) throw new Error('Add meaningful alt text for each selected image.'); }, destroy() { active = false; urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); } };
}
