# Private user file Storage

Status: **deployed and enabled on the remote project** on 9 November 2026.
The authenticated live two-user/admin test passes, including actual upload,
replacement/removal, private read/signing isolation and photo-card PNG export.
The remote rollback-only user-files SQL authorization suite also passes.
Both Edge Functions are deployed and the photo card is published. Scheduled
background cleanup remains unconfigured; upload/removal performs immediate cleanup
and failed attempts remain queued.

Migration `20261109203511` is an empty migration recorded after a local preparation
command failed; it is preserved to match actual remote history. The schema is in
`20261109203554_private_user_file_storage.sql`. No migration history was rewritten.
The acceptance review below records the earlier, pre-deployment state.

### Acceptance review — 9 November 2026

Local verification is complete; remote acceptance remains pending. The configured
Supabase Auth, catalogue RPC and Storage endpoints each returned HTTP 200 using
the public client configuration. Reachability does not establish migration state,
deployed function behavior or authenticated file isolation.

The production build and all 21 generated page checks passed. All six SQL suites
listed below passed again in the isolated PGlite environment. Deno checked both
Edge Function entrypoints, and all three decoder/image-validation tests passed.
The full browser suite reports **63 passed, six skipped**. Four authenticated live
tests were skipped without credentials; two public live smoke tests require the
explicit `CARDLY_LIVE_SMOKE=1` opt-in and were not enabled in this run.

Remote work is deferred at the user's request. The remaining blockers are a
connected Supabase operator session to inspect migration history, apply the
proposal, deploy functions, seed the photo card and configure scheduled cleanup;
and the three dedicated demo-account passwords in ignored local configuration
to run live cross-user/admin acceptance. No remote migration, deployment or
capability enablement was performed during this review.

## Storage and authorization

`card-assets` keeps its existing admin-only writes and published-card reads.
Ordinary users never upload private images into this bucket. The separate private
`user-uploads` bucket stores canonical PNGs at server-generated paths:

- `<auth.uid()>/avatar/<upload-uuid>.png`
- `<auth.uid()>/drafts/<owned-draft-uuid>/<upload-uuid>.png`

The user-files Edge Function verifies the JWT with Auth `getUser`. Its caller-scoped
RPC derives identity using `auth.uid()`, verifies an owned, active draft and a usable
photo-capable template, and allocates a new reservation. The browser cannot choose
a destination path or finalize an upload. The function validates JPEG/PNG/WebP
signatures and dimensions, decodes the actual image with pinned ImageScript 3.13.1,
then re-encodes it as PNG without passing source metadata to the encoder.

Inputs default to 5 MiB, 16 million pixels and 8000 px per side. Canonical PNG
outputs are limited to 10 MiB. The request body is bounded before multipart parsing.
Trusted operators configure the input limit (1 KiB–10 MiB) with
`select public.set_user_file_upload_limit(5242880);`. Browser validation, displayed
hints and Edge Function body/file checks read the same authenticated
`user_file_upload_settings()` RPC. This setting is separate from admin asset limits.
The function uploads with server-only credentials and finalizes through a trusted
RPC. The RPC requires the Storage object and verified metadata before atomically
updating `profiles.avatar_path` or `card_drafts.uploaded_image_path`.
The proposal adds `avatar_path` and revokes browser writes to legacy `avatar_url`.
Existing `avatar_url` data remains untouched for operator review; it is not copied
into the validated registry. Before rollout, Account falls back to loading the
display name if the new column is absent, keeping profile/password controls usable.

`user_uploads` records have owner-only SELECT RLS and no browser writes. Storage
policies permit reading only the owner's validated files and deleting only the
owner's retired, unreferenced files. There are no browser INSERT/UPDATE policies:
all binary uploads use the authenticated, validating Edge Function; replacement
uses a fresh object rather than overwriting. Admin browser clients have no blanket
access to private user files. Profile references are checked against the validated
registry; draft image paths have no direct user-update grant. Manually placing an
image path in personalization JSON is rejected by SQL.

The frontend downloads private bytes through authenticated Storage access and uses
local object/data URLs. It does not expose unrestricted public URLs or mint signed
URLs. Storage SELECT policies also govern signed URL requests made directly by a
client, so users cannot sign another user's file.

## Account and card UI

Account supports selected-image preview, upload, replacement, removal, validation
messages and an uploading status. Existing profile/password sections work while
uploads are disabled. Source MIME types are JPEG/PNG/WebP; stored output is PNG.

The photo seed adds **A birthday worth keeping**, with a `photo-keepsake` renderer,
600 × 800 canvas, `photo_upload: true` and an optional `recipient_photo` image field
with empty config. Other designs do not acquire upload controls. New compatible
cards can be configured through the existing admin template/field editors.

Uploading a card photo first saves an owned draft, preserving the other form
fields on failure. It stores the draft ID in the editor URL. Reopening that URL
loads the owned draft through RLS. The selected photo previews separately before
upload; the validated uploaded photo appears in the card and 1500 × 2000 PNG.
Photo crop uses centered cover within a fixed frame. A failed private read blocks
export instead of silently omitting the saved image.

## Replacement, deletion and cleanup

Upload and validate the replacement before changing any database reference.
Reference changes retire unreferenced old files and enqueue them. The Edge Function
attempts cleanup after upload/removal; failure leaves a durable queue for retry.
Pending reservations older than one hour also become eligible for cleanup.

A generation copies its source draft's private image path into an immutable
column. Files referenced by generations are retained when a photo is replaced or
a draft is archived/deleted. Removing the last reference queues the file. Deleting
a generation also queues its server-rendered output image when present.

`user-file-cleanup` is a service-role-only worker. It checks references, calls
Storage's remove API and confirms database cleanup only after the object metadata
is absent. Never delete rows in `storage.objects` to remove binary files. Run this
worker regularly through an operator-managed schedule; no schedule is deployed yet.
Failures remain queued. Ordinary users can trigger cleanup of their own queue
through the authenticated upload endpoint's `cleanup` action.

There is no account-deletion UI. An authorized operator must disable the account,
remove owned files in `user-generated-cards` through Storage API (Supabase can
refuse Auth deletion while Storage objects are owned by that user), then delete
the Auth account. Registry cascades enqueue private upload paths; the cleanup
worker removes those bytes after the references disappear. Verify both private
buckets are empty under the deleted user's prefix and retry queued failures.
Do not delete the cleanup queue as part of the account cascade.

## Remote rollout

Completed on 9 November 2026: inspected migration history, empty legacy avatar
references and existing private buckets; applied the committed schema migration;
deployed both functions with JWT verification; seeded the photo card; enabled
the capability. Do not reapply either superseded pending proposal. The historical
empty migration is intentionally preserved to match the remote ledger.

To disable uploads through trusted operator SQL:
`select public.enable_user_file_storage(false);`.
The input limit is configured with `public.set_user_file_upload_limit(bytes)`.
Scheduled background cleanup remains a follow-up operational task. Immediate
cleanup is exercised by the live upload/replacement/removal test; failures stay
queued for retry through the authenticated cleanup action or service worker.

Verification after rollout: production build and all 21 production route/asset
checks pass; eight upload UI, FAQ, Pricing and live catalogue browser checks pass;
the separate real two-user/admin upload test passes. The remote rollback-only
user-files SQL suite passes.

## Verification

The pending proposal plus all current migrations and the photo seed were applied
to an isolated PGlite PostgreSQL engine with test Auth/Storage schemas. The existing
`authorization.sql`, `workflow.sql`, `admin.sql`, `assets.sql`, `account.sql` and the new
`user-files.sql` passed. This exercises SQL grants, RLS, triggers and transactions;
it does **not** verify Supabase Auth, binary uploads, signed URL HTTP authorization,
cloud worker limits or the remote migration state.

Browser tests mock backend responses to cover avatar/photo upload, replacement,
removal, failure preservation, private photo rendering, production PNG inclusion,
responsive layout and accessibility. Live tests are separate and must not be
reported as passed when skipped.

Provide these passwords through the ignored local operator environment, never
source or chat: `CARDLY_DEMO_ALEX_PASSWORD`, `CARDLY_DEMO_SAM_PASSWORD`,
`CARDLY_DEMO_ADMIN_PASSWORD`. The dedicated seeded accounts must have empty avatars
so the test does not overwrite existing personal files. Trace/screenshot recording
is disabled for the live test. It cleans its own files and temporary admin fixture.

```sh
node --env-file=.env.demo.local node_modules/@playwright/test/cli.js test tests/live-user-files.spec.js
```

Use Node 22.12+ and configure a Playwright browser as described in README. This test
requires the deployed functions, enabled capability and photo-card seed. It covers
two non-admin users, real uploads/replacement/removal, direct private reads/signing,
forged paths/ownership, role escalation, restricted admin operations, public admin
asset visibility and an authenticated photo-card PNG export. It passed against the live service on 9 November 2026.

With Deno installed, validate the server code and decoder independently:

```sh
deno check supabase/functions/user-file-upload/index.js supabase/functions/user-file-cleanup/index.js
deno test supabase/functions/tests/image-validation.test.js
```

References: [Storage access control](https://supabase.com/docs/guides/storage/security/access-control),
[Storage deletion](https://supabase.com/docs/guides/storage/management/delete-objects),
[Auth getUser](https://supabase.com/docs/reference/javascript/auth-getuser),
[ImageScript](https://imagescript.dev/).

Additional verification: the seeded-collection SQL audit reaches the existing demo
draft ownership assertion and fails there (Demo draft ownership failed). This
audit was not reported as passing; live upload ownership/isolation checks pass.
