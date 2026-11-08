import { supabaseClient } from './supabase-client.js';
const catalogEntities = new Set(['cards', 'categories', 'occasions', 'card_templates', 'personalization_fields', 'card_images']);
export async function adminContext() {
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) return { user: null, isAdmin: false };
  const { data, error: roleError } = await supabaseClient.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
  if (roleError) throw roleError;
  return { user, isAdmin: data?.role === 'admin' };
}
export async function requireAdmin() {
  const context = await adminContext();
  if (!context.isAdmin) throw Object.assign(new Error('Administrator access is required.'), { code: '42501' });
  return context;
}
async function call(name, args) {
  await requireAdmin();
  const { data, error } = await supabaseClient.rpc(name, args);
  if (error) throw error;
  return data;
}
export async function listAdminData(entity, cardId) {
  if (!catalogEntities.has(entity)) throw new Error('Unsupported catalog entity.');
  await requireAdmin();
  const rows = [];
  for (let start = 0; ; start += 100) {
    let query = supabaseClient.from(entity).select('*').order('id').range(start, start + 99);
    if (cardId) query = query.eq('card_id', cardId);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data);
    if (data.length < 100) return rows;
  }
}
export async function getAdminCard(id) {
  await requireAdmin();
  const { data, error } = await supabaseClient.from('cards').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}
export const saveAdminData = (entity, data, id = null) => call('admin_save_card_data', { p_entity: entity, p_data: data, p_id: id });
export const removeAdminData = (entity, id) => call('admin_remove_configuration', { p_entity: entity, p_id: id });
export const reorderFields = (cardId, ids) => call('admin_reorder_fields', { p_card_id: cardId, p_field_ids: ids });
export const setUserRole = (id, role) => call('admin_set_user_role', { p_user_id: id, p_role: role });
export async function listSupportData(kind) {
  const operation = kind === 'users' ? 'admin_list_users' : 'admin_generated_metadata';
  const rows = [];
  for (let offset = 0; ; offset += 100) {
    const data = await call(operation, { p_limit: 100, p_offset: offset });
    rows.push(...data);
    if (data.length < 100) return rows;
  }
}
export function adminError(error) {
  if (error.code === '23505') return 'That slug, template key, or field key is already in use. Choose a unique value.';
  if (error.code === '42501') return 'Your administrator authorization is no longer valid. Sign in again.';
  return error.message || 'The operation could not be completed. Your input has been kept.';
}
export async function uploadCardAsset(cardId, file) {
  await requireAdmin();
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024 || file.size === 0) {
    throw new Error('Choose a PNG, JPEG or WebP image up to 5 MiB.');
  }
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const png = bytes.slice(0, 8).join() === '137,80,78,71,13,10,26,10';
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!({ 'image/png': png, 'image/jpeg': jpeg, 'image/webp': webp })[file.type]) throw new Error('The image contents do not match its file type.');
  const image = await createImageBitmap(file);
  const tooLarge = image.width * image.height > 40000000;
  image.close();
  if (tooLarge) throw new Error('Use an image with at most 40 million pixels.');
  const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[file.type];
  const path = `cards/${cardId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabaseClient.storage.from('card-assets').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}
export async function deleteUnreferencedAsset(path) {
  if (path.startsWith('demo-cards/')) return false;
  if (!await call('admin_asset_deletable', { p_path: path })) return false;
  const { error } = await supabaseClient.storage.from('card-assets').remove([path]);
  if (error) throw error;
  // Storage can report success even when RLS filtered the object. Verify absence.
  const slash = path.lastIndexOf('/');
  const { data, error: listError } = await supabaseClient.storage.from('card-assets').list(path.slice(0, slash), { search: path.slice(slash + 1) });
  if (listError) throw listError;
  return !data.some(file => file.name === path.slice(slash + 1));
}
export async function assetPreview(path) {
  if (/^demo-cards\/[a-z0-9-]+-(thumb|preview)\.svg$/.test(path)) return `/${path}`;
  const { data, error } = await supabaseClient.storage.from('card-assets').download(path);
  if (error) throw error;
  return URL.createObjectURL(data);
}
export async function logoutAdmin() { await supabaseClient.auth.signOut(); }
export function watchAdminLogout(onLogout) {
  return supabaseClient.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') onLogout(); }).data.subscription;
}
