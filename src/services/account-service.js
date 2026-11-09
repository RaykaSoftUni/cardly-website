import { privateImageBlob, uploadUserImage, removeUserImage, validateUserImage } from './user-files.js';
import { supabaseClient as client, authCallbackError } from './supabase-client.js';

export const passwordRequirements = 'Use 8–128 characters. Additional password strength requirements may apply.';
export const recoveryFailed = authCallbackError;

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
async function loadProfile(id) {
  const result = await client.from('profiles').select('display_name,avatar_path').eq('id', id).single();
  if (result.error && ['42703','PGRST204'].includes(result.error.code)) {
    // Keep the existing account page usable before the upload migration is applied.
    const legacy = await client.from('profiles').select('display_name').eq('id', id).single();
    if (legacy.data) legacy.data.avatar_path = null;
    return legacy;
  }
  return result;
}
export async function loadAccount() {
  const user = await currentUser();
  if (!user) return null;
  const [profile, role] = await Promise.all([
    loadProfile(user.id),
    client.from('user_roles').select('role').eq('user_id', user.id).single(),
  ]);
  return { user, profile: checked(profile), role: checked(role).role };
}
export async function saveProfile(displayName) {
  const name = displayName.trim();
  if (!name || [...name].length > 80 || /[\u0000-\u001f\u007f]/u.test(name)) throw invalid('Enter a display name of 1–80 characters without control characters.');
  const user = await requireUser();
  return checked(await client.from('profiles').update({ display_name: name }).eq('id', user.id).select('display_name').single());
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
export async function avatarPreview(path) {
  if(!path)return null;
  return URL.createObjectURL(await privateImageBlob(path));
}
export async function avatarsAvailable() {
  try { const { data, error } = await client.rpc('account_avatar_available'); return !error && data === true; }
  catch { return false; }
}
export const validateAvatar=validateUserImage;
export const saveAvatar=file=>uploadUserImage(file,{purpose:'avatar'});
export const removeAvatar=()=>removeUserImage({purpose:'avatar'});
