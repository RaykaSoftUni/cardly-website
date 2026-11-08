import { supabaseClient as client, authCallbackError } from './supabase-client.js';

export const passwordRequirements = 'Use 8–128 characters. Additional password strength requirements may apply.';
export const recoveryFailed = authCallbackError;
export const avatarLimit = 2 * 1024 * 1024;
const formats = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export function accountError(error) {
  if (error?.code === 'validation') return error.message;
  if (['weak_password', 'same_password'].includes(error?.code)) return 'Choose a different, stronger password. ' + passwordRequirements;
  if (['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error?.code) || error?.status === 429) return 'Too many requests. Please wait a few minutes and try again.';
  if (['reauthentication_needed', 'reauthentication_not_valid'].includes(error?.code)) return 'Please sign in again before changing your password, or request a password reset email.';
  return 'This update could not be completed. Check your connection and try again. If your session expired, sign in again.';
}
function invalid(message) { return Object.assign(new Error(message), { code: 'validation' }); }
function checked(result) { if (result.error) throw result.error; return result.data; }
export async function currentUser() {
  const { data, error } = await client.auth.getUser();
  if (error && !['AuthSessionMissingError'].includes(error.name) && error.status !== 401 && error.status !== 403) throw error;
  return error ? null : data.user;
}
async function requireUser() {
  const user = await currentUser();
  if (!user) throw invalid('Your session has expired. Please sign in again.');
  return user;
}
export async function loadAccount() {
  const user = await currentUser();
  if (!user) return null;
  const [profile, role] = await Promise.all([
    client.from('profiles').select('display_name,avatar_url').eq('id', user.id).single(),
    client.from('user_roles').select('role').eq('user_id', user.id).single(),
  ]);
  return { user, profile: checked(profile), role: checked(role).role };
}
export async function saveProfile(displayName) {
  const name = displayName.trim();
  if (!name || [...name].length > 80 || /[\u0000-\u001f\u007f]/u.test(name)) throw invalid('Enter a display name of 1–80 characters without control characters.');
  const user = await requireUser();
  return checked(await client.from('profiles').update({ display_name: name }).eq('id', user.id).select('display_name,avatar_url').single());
}
export function validatePassword(password, confirmation) {
  if (password.length < 8 || password.length > 128 || !password.trim()) throw invalid(passwordRequirements);
  if (password !== confirmation) throw invalid('The passwords do not match.');
}
export async function changePassword(password, confirmation) {
  validatePassword(password, confirmation);
  await requireUser();
  checked(await client.auth.updateUser({ password }));
}
export async function requestPasswordReset(email) {
  const value = email.trim();
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw invalid('Enter a valid email address.');
  checked(await client.auth.resetPasswordForEmail(value, { redirectTo: new URL('/reset-password/', location.origin).href }));
}
export async function logout() { checked(await client.auth.signOut({ scope: 'local' })); }
export function watchSignOut(callback) {
  const { data } = client.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') queueMicrotask(callback); });
  return () => data.subscription.unsubscribe();
}
function ownedAvatar(path, user) {
  return typeof path === 'string' && new RegExp(`^${user.id}/[a-f0-9-]{36}\\.(png|jpg|webp)$`).test(path);
}
export async function avatarPreview(path) {
  if (!path) return null;
  const user = await requireUser();
  if (!ownedAvatar(path, user)) return null;
  return URL.createObjectURL(checked(await client.storage.from('avatars').download(path)));
}
export async function avatarsAvailable() {
  // The capability appears only after the private bucket/policies are migrated.
  // Existing profile and password management remain usable during rollout.
  try { const { data, error } = await client.rpc('account_avatar_available'); return !error && data === true; }
  catch { return false; }
}
export async function validateAvatar(file) {
  if (!file || !formats[file.type]) throw invalid('Choose a JPEG, PNG or WebP image.');
  if (!file.size || file.size > avatarLimit) throw invalid('Choose an image no larger than 2 MiB.');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const signature = file.type === 'image/png' ? [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b)
    : file.type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
  if (!signature) throw invalid('The image contents do not match its format.');
  let bitmap;
  try { bitmap = await createImageBitmap(file); if (bitmap.width * bitmap.height > 16000000) throw new Error(); }
  catch { throw invalid('Choose a valid image with at most 16 million pixels.'); }
  finally { bitmap?.close(); }
}
export async function saveAvatar(file) {
  await validateAvatar(file);
  const user = await requireUser();
  const { avatar_url: oldPath } = checked(await client.from('profiles').select('avatar_url').eq('id', user.id).single());
  const path = `${user.id}/${crypto.randomUUID()}.${formats[file.type]}`;
  checked(await client.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: false }));
  const result = await client.from('profiles').update({ avatar_url: path }).eq('id', user.id).select('avatar_url').single();
  if (result.error) {
    const cleanup = await client.storage.from('avatars').remove([path]);
    if (cleanup.error) throw invalid('Your profile image was not updated. An unused upload could not be removed; please try again later.');
    throw result.error;
  }
  const cleanup = oldPath && ownedAvatar(oldPath, user) ? await client.storage.from('avatars').remove([oldPath]) : null;
  return { path, cleanupFailed: Boolean(cleanup?.error) };
}
export async function removeAvatar() {
  const user = await requireUser();
  const { avatar_url: path } = checked(await client.from('profiles').select('avatar_url').eq('id', user.id).single());
  checked(await client.from('profiles').update({ avatar_url: null }).eq('id', user.id).select('avatar_url').single());
  const cleanup = path && ownedAvatar(path, user) ? await client.storage.from('avatars').remove([path]) : null;
  return { cleanupFailed: Boolean(cleanup?.error) };
}
