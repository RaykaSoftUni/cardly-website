# Protected administration

Open `/admin/` after signing in with a verified database admin account. The signed-in
navigation shows Admin only after the protected role check. Visitors receive a
sign-in link that returns to their requested admin page; regular users receive an
access-denied page without management controls.

| URL | Functions |
| --- | --- |
| `/admin/` | Dashboard and navigation |
| `/admin/cards/` | List all cards; create/edit, publish/unpublish/archive |
| `/admin/card-edit/?id=<uuid>` | Catalog settings, template revisions, fields and assets |
| `/admin/card-edit/` | Create a draft before configuring its template |
| `/admin/categories/` | Manage categories and active state |
| `/admin/categories/?type=occasions` | Manage occasions and active state |
| `/admin/users/` | Basic account information and authorized role changes |
| `/admin/?view=generations` | Generation metadata for support |

The genuine multi-page application remains unchanged: normal links select HTML
pages, with query parameters selecting a record or management view.

## Catalog and configuration

Card forms manage title, unique slug, description, taxonomy, style, publication,
free/paid status, EUR price, availability, featured state and display order. Paid
cards remain unavailable under the database constraint. Required text is checked
in both forms and database constraints. Available published cards must already
have a template: save as a draft, configure the template, then publish. Unavailable
marketing entries may be published without offering personalization.

Template JSON forms explain dynamic text and optional catalog-image regions.
Region arrays and numeric coordinates are validated server-side. Key uniqueness
and positive versions remain enforced. A change to layout, styles or template key
creates the next immutable version; unchanged saves retain the version. Existing
generation snapshots cannot be edited by administration.

Personalization controls support text, textarea, number and select fields, with
key/label/type, placeholder/guidance, requiredness, length/range constraints and
select options. Fields can be moved or removed; the server verifies the complete
ordering contains each field from that card exactly once. Keys are unique per
card. Image regions use catalog assets; user-photo personalization remains off.

Category/occasion forms manage unique slug, name, description, order and active
state. Deactivation hides affected public cards without deleting historical
references. Destructive actions and role changes require confirmation; errors
preserve entered values and report the failure.

## Authorization and private data

`src/services/admin-service.js` verifies the user with Auth `getUser()` and reads
the protected `user_roles` row. It checks again before mutations. Logout clears
admin controls, window focus rechecks permissions, and rejected operations recheck
access. Visual components receive data/handlers, not database clients. Client flags
and editable user metadata never grant authority.

Existing catalog RLS independently protects direct database operations. New RPCs
use fixed empty search paths, explicit grants and a trusted admin-role check:

- `admin_list_users(p_limit,p_offset)`: ID, email, display name, creation date and
  role only; no hashes, passwords, Auth tokens or recovery metadata.
- `admin_generated_metadata(p_limit,p_offset)`: record/owner/card/template IDs,
  template version, catalog snapshot title/pricing type/currency, status and dates.
  No personalization, generated text, output paths, errors or full snapshots.
- `admin_set_user_role(p_user_id,p_role)`: user/admin only; self-role changes are
  forbidden. Role edits serialize and authorization is rechecked after locking,
  preserving an admin when two administrators try to demote one another.
- `admin_remove_configuration(p_entity,p_id)`: allowlisted field/image associations.
- `admin_reorder_fields(p_card_id,p_field_ids)`: atomic, complete per-card ordering.
- `admin_asset_deletable(p_path)`: checked admin-only reference lookup; Storage RLS
  independently verifies deletion eligibility.

No browser receives Service Role credentials or direct Auth-table grants. Even
admins cannot directly update `user_roles`; they use the checked RPC to change
another account's role. Private drafts/generated cards remain owner-only.

## Assets and historical versions

The private `card-assets` bucket enforces PNG/JPEG/WebP and a 5 MiB limit on the
server. The admin service also checks signatures, browser decoding and a 40-million-
pixel limit. SQL does not inspect image bytes. SVG uploads are excluded; original
static SVG demo artwork remains a separate existing source.

Uploads use unique `cards/<card-id>/<uuid>.<extension>` paths without upsert. Only
paths and metadata are saved in Postgres. Alt text is required by the UI, and public
thumbnail/preview alt text cannot be blank in the database. Public pages now load
permitted Storage previews as well as local demo artwork.

Replacement uploads a new object and changes the association, retaining older
paths. Removal deletes the association and uses the Storage API for unreferenced
files. Files referenced by other image records, current/historical templates or
generation snapshots are retained. JSON reference checks are conservative. Future
generation snapshots include the image manifest; earlier snapshots are untouched.
Image mutations lock the parent card during snapshot capture.

Old replacements are intentionally retained for review by a trusted operator. An
upload whose association fails is cleaned up when possible; if authorization or
network access is lost, an operator may need to remove the unassociated object.
Static demo files are not deleted from the repository by an admin UI action.

## Migrations and verification

Applied remote versions match committed SQL checksums exactly:

1. `20261108094019_protected_admin_management`
2. `20261108094606_admin_ordering_validation`
3. `20261108095034_admin_asset_retention`
4. `20261108100015_available_card_template_integrity`

All four SQL suites pass (`authorization.sql`, `workflow.sql`, `seed.sql`,
`admin.sql`). They exercise real role/ownership enforcement, metadata privacy,
configuration constraints, ordering, publication, snapshots and retention
predicates; fixtures roll back. Supabase's protection against raw Storage-table
deletion remains enabled. Binary upload/deletion tests use the actual Storage API.

All 23 browser tests pass, including authorized and denied admin sessions, duplicate
slug errors with retained values, templates, fields, taxonomy, role dialogs,
file validation, revocation and WCAG checks. Authenticated live tests verify demo
admin login and real upload/replacement/privacy/removal; temporary cards/files are
cleaned up. Production build and all 17 route checks pass. Desktop/mobile admin
layouts were checked. Test credentials are read from explicit environment values
(`CARDLY_ADMIN_TEST_PASSWORD`, `CARDLY_USER_TEST_PASSWORD`), never committed. Traces
and automatic failure screenshots are disabled for real-auth tests.

The advisor flags intentionally exposed definer RPCs for
[anonymous](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
and [authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
roles. Their public projection/admin-check boundaries are tested; these notices
remain. It also reports existing
[disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
No Auth password policy was changed in this milestone.

Final rendering, AI, payment entitlement and user-photo uploads remain separate.
The demo renderer still uses its predefined design keys; arbitrary configured
regions are saved/versioned for the future trusted renderer. This milestone adds
administration, not a new rendering engine.
