import { el } from '../utils/dom.js';
import { button, section } from '../components/ui.js';
import { createForm } from '../components/forms/fields.js';
import { createHeader } from '../components/layout/header.js';
import { confirmDialog } from '../components/feedback/confirm-dialog.js';
import { finishPageLoading, pageLoadError } from '../components/feedback/page-loading.js';
import { loadAccount, currentUser, saveProfile, changePassword, requestPasswordReset, logout, watchSignOut, accountError, passwordRequirements, recoveryFailed, avatarPreview, avatarsAvailable, validateAvatar, saveAvatar, removeAvatar } from '../services/account-service.js';

const intro = (title, description) => el('div', { className: 'page-intro' }, [el('p', { className: 'eyebrow' }, 'Made for you'), el('h1', {}, title), el('p', { className: 'muted' }, description)]);
const status = () => el('p', { role: 'status', 'aria-live': 'polite', className: 'account-feedback' });
function passwordForm({ reset = false } = {}) {
  const feedback = status();
  const form = createForm({ fields: [
    { name: 'password', label: 'New password', type: 'password', required: true, minLength: 8, hint: passwordRequirements },
    { name: 'confirmation', label: 'Confirm new password', type: 'password', required: true },
  ], submitLabel: reset ? 'Reset password' : 'Change password', onSubmit: async values => {
    feedback.textContent = '';
    try {
      await changePassword(values.password, values.confirmation);
      form.reset();
      feedback.textContent = 'Your password has been changed.';
      if (reset) { form.element.hidden = true; feedback.append(' ', button({ label: 'Go to My Cards', href: '/my-cards/' })); }
    } catch (error) {
      const message = accountError(error);
      form.setError(message);
      if (values.password !== values.confirmation) form.setErrors({ confirmation: 'The passwords do not match.' });
    }
  } });
  form.element.querySelectorAll('input').forEach(input => { input.autocomplete = 'new-password'; input.maxLength = 128; });
  window.addEventListener('pagehide', () => form.element.querySelectorAll('input').forEach(input => { input.value = ''; }), { once: true });
  return el('div', {}, [form.element, feedback]);
}
async function avatarSection(profile) {
  let savedPath = profile.avatar_url;
  let savedURL = null;
  let selectionURL = null;
  let generation = 0;
  const image = el('img', { className: 'account-avatar', alt: 'Your profile image', width: 96, height: 96, hidden: true });
  const fallback = el('div', { className: 'account-avatar avatar-fallback', role: 'img', 'aria-label': 'Default profile image' }, '☺');
  if (!await avatarsAvailable()) return section({ title: 'Profile image', children: [fallback, el('p', { className: 'muted' }, 'Profile image uploads are currently unavailable.')] });
  const feedback = status();
  const cleanup = () => { if (savedURL) URL.revokeObjectURL(savedURL); if (selectionURL) URL.revokeObjectURL(selectionURL); };
  window.addEventListener('pagehide', cleanup, { once: true });
  function display(url) { if (url) image.src = url; else image.removeAttribute('src'); image.hidden = !url; fallback.hidden = Boolean(url); }
  image.addEventListener('error', () => display(null));
  async function refresh() {
    if (savedURL) URL.revokeObjectURL(savedURL);
    savedURL = null;
    try { savedURL = await avatarPreview(savedPath); } catch { feedback.textContent = 'Your saved profile image could not be loaded.'; }
    display(savedURL);
    remove.disabled = !savedPath;
  }
  const remove = button({ label: 'Remove profile image', variant: 'outline-primary', disabled: !savedPath, onClick: async () => {
    if (!await confirmDialog({ title: 'Remove profile image?', message: 'Your account will use the default image.', confirmLabel: 'Remove image', destructive: true })) return;
    remove.disabled = true;
    form.element.querySelectorAll('input,button').forEach(control => { control.disabled = true; });
    try {
      const result = await removeAvatar(); savedPath = null; generation++;
      form.reset(); if (selectionURL) URL.revokeObjectURL(selectionURL); selectionURL = null;
      await refresh(); feedback.textContent = result.cleanupFailed ? 'Profile image removed. The previous file could not be cleaned up.' : 'Profile image removed.';
    } catch (error) { form.setError(accountError(error)); }
    finally { remove.disabled = !savedPath; form.element.querySelectorAll('input,button').forEach(control => { control.disabled = false; }); }
  } });
  const form = createForm({ fields: [{ name: 'avatar', label: 'Profile image', type: 'file', required: true, accept: 'image/jpeg,image/png,image/webp', hint: 'JPEG, PNG or WebP · up to 2 MiB · 16 million pixels.' }], submitLabel: 'Save profile image', onChange: async ({ avatar }) => {
    const attempt = ++generation;
    if (selectionURL) URL.revokeObjectURL(selectionURL); selectionURL = null;
    if (!avatar) { display(savedURL); return; }
    try {
      await validateAvatar(avatar);
      if (attempt !== generation) return;
      selectionURL = URL.createObjectURL(avatar); display(selectionURL); form.setError('');
    } catch (error) { if (attempt === generation) { display(savedURL); form.setError(accountError(error)); } }
  }, onSubmit: async ({ avatar }) => {
    feedback.textContent = '';
    remove.disabled = true;
    form.element.elements.avatar.disabled = true;
    try {
      const result = await saveAvatar(avatar); savedPath = result.path; generation++;
      form.reset(); if (selectionURL) URL.revokeObjectURL(selectionURL); selectionURL = null;
      await refresh(); feedback.textContent = result.cleanupFailed ? 'Profile image saved. The previous file could not be cleaned up.' : 'Profile image saved.';
    } catch (error) { form.setError(accountError(error)); }
    finally { remove.disabled = !savedPath; form.element.elements.avatar.disabled = false; }
  } });
  await refresh();
  return section({ title: 'Profile image', children: [el('div', { className: 'account-avatar-row' }, [image, fallback, el('div', {}, [form.element, remove, feedback])])] });
}
async function account(main) {
  const account = await loadAccount();
  if (!account) {
    document.querySelector('header').replaceWith(createHeader({ pageId: 'account' }));
    main.replaceChildren(intro('Sign in to your account', 'Your profile and security settings are available after signing in.'), button({ label: 'Sign in', href: '/login/?next=/account/' }));
    return;
  }
  const { user, profile, role } = account;
  const feedback = status();
  const signOut = async () => { try { await logout(); location.assign('/'); } catch (error) { feedback.textContent = accountError(error); } };
  document.querySelector('header').replaceWith(createHeader({ pageId: 'account', authenticated: true, isAdmin: role === 'admin', onLogout: signOut }));
  let active = true;
  const stop = watchSignOut(() => { active = false; main.replaceChildren(intro('You have been signed out', 'Sign in again to manage your account.'), button({ label: 'Sign in', href: '/login/?next=/account/' })); document.querySelector('header').replaceWith(createHeader({ pageId: 'account' })); });
  window.addEventListener('pagehide', stop, { once: true });
  const profileFeedback = status();
  const form = createForm({ fields: [{ name: 'displayName', label: 'Display name', required: true, maxLength: 80, value: profile.display_name || '', hint: 'The name you would like to use on Cardly. Up to 80 characters.' }], submitLabel: 'Save profile', onSubmit: async values => {
    profileFeedback.textContent = '';
    try { const updated = await saveProfile(values.displayName); form.element.elements.displayName.value = updated.display_name; profileFeedback.textContent = 'Your profile has been updated.'; }
    catch (error) { form.setError(accountError(error)); }
  } });
  form.element.elements.displayName.autocomplete = 'nickname';
  const metadata = el('dl', { className: 'account-metadata' }, [el('dt', {}, 'Email address'), el('dd', {}, user.email || 'No email address'), el('dt', {}, 'Account created'), el('dd', {}, user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'Not available'), el('dt', {}, 'Role'), el('dd', {}, role === 'admin' ? 'Admin' : 'User')]);
  const avatar = await avatarSection(profile);
  if (!active) return;
  main.replaceChildren(intro('Your account', 'A little space for your profile and account security.'), el('div', { className: 'account-layout' }, [
    el('div', { className: 'surface-panel' }, [section({ title: 'Profile', children: [form.element, profileFeedback] }), avatar]),
    el('div', { className: 'surface-panel' }, [section({ title: 'Login & Security', children: [metadata, el('p', { className: 'muted' }, 'Your sign-in email address is read-only here.'), user.new_email ? el('p', { role: 'status' }, `Email change to ${user.new_email} is pending confirmation. Follow the verification emails before using the new address.`) : null, el('h3', {}, 'Change password'), passwordForm(), button({ label: 'Forgot password?', href: '/forgot-password/', variant: 'quiet' })] })]),
  ]), section({ title: 'Account Actions', children: [el('div', { className: 'action-row' }, [button({ label: 'My Cards & Saved Drafts', href: '/my-cards/' }), button({ label: 'Log out of this account', variant: 'outline-primary', onClick: signOut })]), feedback] }));
}
async function forgot(main) {
  document.querySelector('header').replaceWith(createHeader({ pageId: 'forgot-password' }));
  const feedback = status();
  const form = createForm({ fields: [{ name: 'email', label: 'Email address', type: 'email', required: true, maxLength: 254 }], submitLabel: 'Send reset email', onSubmit: async ({ email }) => {
    feedback.textContent = '';
    try { await requestPasswordReset(email); form.setError(''); feedback.textContent = 'If an account exists for that address, you will receive a password reset email. Check your inbox and spam folder.'; }
    catch (error) { form.setError(accountError(error)); }
  } });
  form.element.elements.email.autocomplete = 'email';
  main.replaceChildren(intro('Forgot your password?', 'We’ll send a link to help you set a new password.'), el('section', { className: 'auth-panel surface-panel', 'aria-label': 'Password recovery' }, [form.element, feedback, button({ label: 'Back to sign in', href: '/login/', variant: 'quiet' })]));
}
export async function renderAccountPage(main, pageId) {
  try {
    if (pageId === 'account') await account(main);
    else if (pageId === 'forgot-password') await forgot(main);
    else {
      // The SDK consumes the recovery URL and validates its session with Auth.
      const user = recoveryFailed ? null : await currentUser();
      document.querySelector('header').replaceWith(createHeader({ pageId }));
      main.replaceChildren(intro('Reset your password', user ? 'Choose a new password for your account.' : 'This recovery link is missing, expired or already used. Request a new email to continue.'), user ? el('section', { className: 'auth-panel surface-panel', 'aria-label': 'Reset password' }, passwordForm({ reset: true })) : button({ label: 'Request a new reset email', href: '/forgot-password/' }));
    }
  } catch { document.querySelector('header').replaceWith(createHeader({ pageId })); pageLoadError(main, 'Your account could not be loaded. Check your connection, then refresh to try again.'); }
  finally { finishPageLoading(main); }
}
