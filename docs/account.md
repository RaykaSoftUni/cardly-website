# Account and password recovery

Current private-file implementation: see [user file Storage](user-file-storage.md).
It supersedes the older pending `avatars` bucket proposal below with validated
Edge Function uploads into `user-uploads`. Remote rollout is still pending.
New uploads use `profiles.avatar_path` and `<user-id>/avatar/<upload-id>.png`.
The configurable input limit defaults to 5 MiB; saved images are privately fetched
with the authenticated session and displayed through revocable local object URLs.

`/account/` requires a verified Supabase Auth user. Guests receive a sign-in link
that returns to Account after login. A user can edit their display name, view their
Auth email, creation date and database role, change their password, open My Cards
and Saved Drafts, and log out of the current session. Email is read-only in this
milestone; any already-pending Auth email change is labelled as pending.

Profile reads and updates derive the user ID from `auth.getUser()` in
`src/services/account-service.js`. URL parameters and form data never select the
account being edited. Existing `profiles` RLS restricts SELECT/UPDATE to
`auth.uid()`, and authenticated clients have UPDATE grants only for `display_name`
and `avatar_url`. Identity, creation timestamps and roles cannot be edited.
Role display uses `user_roles`, not editable Auth user metadata. Visual page code
orchestrates shared forms; Auth, database and Storage operations live in the service.

Display names require 1–80 characters after trimming and no control characters.
Passwords require 8–128 characters, matching confirmation, and any additional
server-configured requirements. Updates use
[Supabase Auth updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser).
Passwords are never written to application tables or storage, logged, or included
in URLs. Password fields clear after success. Form errors preserve entered values.

## Recovery setup

Login links to `/forgot-password/`. It calls
[resetPasswordForEmail](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)
with the current origin's `/reset-password/` as `redirectTo`. Feedback avoids
confirming whether an account exists. The reset page lets the SDK consume the
recovery callback, validates the resulting session with Auth, rejects explicit
callback errors even if a different session exists, and updates the password
through Auth. Missing/expired sessions offer a new reset email.

In Supabase Authentication → URL Configuration, allow the actual application
origins with `/reset-password/`, including `http://127.0.0.1:5173/reset-password/`
and `http://localhost:5173/reset-password/` when used locally. Add the actual
production URL when deployed. Configure an appropriate email sender/SMTP and
confirm the recovery template retains its confirmation URL. These Auth dashboard
settings and real email delivery have **not** been verified by this milestone;
tests mock sending email and exercise the SDK's recovery callback instead.
No actual recovery emails are sent by the automated checks.

## Avatar rollout — pending database access

**Not applied remotely:** `supabase/pending/account_management.sql` contains the
additional display-name/path constraints, a private `avatars` bucket, owner-only
Storage policies, and `account_avatar_available()` capability. The management
connector continues to fail OAuth refresh, including after reconnection. The file
has no invented migration-history version and is deliberately outside the applied
migration directory. Existing database profile ownership protections remain active.

Before applying, inspect real migration history, current profiles (including empty
or untrimmed names and legacy avatar URLs), buckets and Storage policies. Resolve
incompatible existing values explicitly rather than dropping them. Apply the SQL
through the migration tool, save the returned real version under
`supabase/migrations/`, remove the pending copy, then run
`supabase/tests/account.sql` and existing authorization checks. Until then, Account
shows its default avatar and “Profile image uploads are currently unavailable.”
The profile and password sections remain usable.

After migration, users can preview, upload, replace and confirm removal of their
own avatar. Paths are `<auth.uid()>/<random UUID>.png|jpg|webp` in `avatars`;
`profiles.avatar_url` stores only this path, never a public URL. Files are private
and downloaded with the user's session. JPEG, PNG and WebP are supported, up to
2 MiB (enforced by Storage) and 16 million decoded pixels (client validation).
Client checks include file signatures and successful decoding. Storage policies
restrict reads, inserts and deletes by user prefix, with no overwrite policy or
admin exemption. SQL constrains the saved path to the profile owner's UUID.
See [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

New uploads use unique names. A failed profile update attempts to delete its new
file; successful replacement/removal attempts to delete the old file using the
Storage API. Cleanup failures are reported separately from profile-save success.
A lost connection or closed tab can still leave an unused owned file; no background
cleanup job is introduced. Other users' avatars cannot be downloaded or changed.
Previously generated card/template snapshots are unaffected.

## Verification

`tests/account.spec.js` exercises guest protection, permitted updates, validation
and preserved input, password rejection/success, recovery callbacks and expired
links, avatar preview/upload/replacement/removal, unavailable avatar rollout,
logout, and mobile/desktop accessibility with mocked services.

`CARDLY_USER_TEST_PASSWORD` enables `tests/live-account.spec.js`. It checks real
profile isolation and immutable columns, saves a temporary display name through
the Account UI, verifies persistence, logs out, and restores the original name in
`finally`. Traces/screenshots are disabled for real sessions. It does not change
passwords, send emails or expose tokens. The SQL suite additionally checks the
new avatar policies and constraints after the pending migration is applied.

Verified for this change: production build and all 19 routes/assets passed;
all 49 browser checks passed, including live account ownership, existing live
admin/Storage checks, loading behavior and accessibility. The new SQL suite could
not run because the management connector is unavailable. Avatar behavior was
verified with mocked Storage, not against a remotely provisioned avatar bucket.

Phone numbers, preferences, email editing and account deletion are outside this
milestone. The existing registration placeholder is unchanged.
