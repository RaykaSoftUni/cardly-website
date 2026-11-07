# Database and Storage foundation

The foundation below records milestone 2. The subsequent
[generation API](generation-api.md) adds a third migration, immutable template
history (a twelfth RLS-protected table), RPC-only public projections and validated
draft/favorite writes. Its access contract supersedes the direct catalog read and
draft-write permissions described in the original foundation below.

Applied to Supabase reference `netqiilhvhvmwhefsmxq` on 2026-11-07 through the
configured Supabase MCP. Preflight inspection found no application tables or remote
migrations. The committed migration versions were taken from the remote history
after successful application, not invented locally:

- `20261107135537_catalog_authorization.sql`: tables, indexes, constraints, triggers,
  grants, RLS and buckets.
- `20261107135932_catalog_read_policies.sql`: combine catalog read conditions to
  avoid overlapping permissive SELECT policies; keep admin write policies separate.

Before future migrations, inspect both local SQL and remote migration history.
Apply new DDL with Supabase migration tooling, then confirm version and SQL agree.
Do not rerun these SQL files against this already-migrated project or edit applied
migrations. No CLI, psql or Docker executable was available in this workspace;
verification used the connected remote database with rollback-only test fixtures.

## Tables and integrity

Created `profiles`, `user_roles`, `occasions`, `categories`, `cards`, `card_images`,
`card_templates`, `personalization_fields`, `card_drafts`, `generated_cards` and
`favorites`. The optional `ai_generations` table is deferred until AI is selected.
Favorites and PDF path columns are schema preparation, not implemented UI features.

UUID primary keys default to `gen_random_uuid()` where appropriate. Required
relationships are non-null; timestamps are non-null with automatic `updated_at`
triggers. Foreign-key indexes support catalog and owner queries. Slugs, per-card
field keys, per-card templates and favorite pairs enforce their stated uniqueness.
JSON configuration and personalization payloads require objects; template versions
must be positive. Status/type values are constrained, sort order is nonnegative,
prices cannot be negative or NaN, and currency is EUR. Free prices are null or zero;
paid prices may be null or nonnegative, but paid cards must remain unavailable.

Profiles use `id = auth.users.id`; other owned records use `user_id`. Signup
automatically creates a profile and a `user` role; existing users were backfilled.
No role is read from signup metadata. Changing record identity, owner or template
on drafts/generated cards is rejected, including through privileged writes.
Creating generated records requires a usable free template; a source draft must
belong to the same user and card. Deleting a source draft preserves generated
records with a null source reference. Retaining template versions for reopening
historical exports is now implemented by the generation API's version history and
snapshots; actual image rendering remains a separate trusted worker.

## Enforced access

| Data | Visitor | User | Admin browser |
| --- | --- | --- | --- |
| Occasions/categories | Active only | Active only | Manage all |
| Cards | Published, active taxonomy | Same as visitor | Manage all |
| Images/templates/fields | Published parent with active taxonomy | Same as visitor | Manage all |
| Profiles | None | Read own; update display name/avatar only | Own profile only |
| Roles | None | Read own only | Read own only |
| Drafts | None | Read/delete own; create/edit personalization for usable free cards | Same ownership rules |
| Generated records | None | Read own only | Read own only |
| Favorites | None | Read/delete own; insert for publicly visible cards | Same ownership rules |

Published unavailable cards remain visible with prices; public visibility never
grants generation eligibility. Admins may manage catalog metadata but cannot assign
roles from the browser or directly access other users' private records. Generated
text/image fields and generated-card records are written only by trusted server
operations, which must authenticate requests and validate paths and output. Uploading
a file alone does not create a verified generation record or entitlement.

Functions in the unexposed `private` schema perform role/publication checks with
fixed empty search paths. Only the required checks are executable by browser roles;
trigger functions are not directly executable. Explicit grants restrict profile
and draft updates to permitted columns. RLS independently enforces row ownership.

## Storage

`card-assets` is private so Storage cannot bypass publication checks through a
public URL. Admins manage objects. Anonymous/authenticated SELECT is allowed only
when the exact object path occurs in `card_images` for a publicly visible card.
Use the authenticated Storage download endpoint for reads (the public client key
is sufficient for anonymous published assets); do not use `getPublicUrl()`.
Background and decorative assets also need a matching `card_images` row.

`user-generated-cards` is private. Users may upload, read, update and delete objects
under `<auth.uid()>/<filename>`. Updates cannot move objects into another user's
prefix. Admin browser clients have no blanket access. Use short-lived signed URLs
where needed; signed URLs remain bearer credentials until expiry. Store object
paths in database records, never image binaries. A trusted generation service must
validate that stored output paths belong to the record's owner. Publication changes
cannot revoke already-downloaded files or existing signed URLs instantly.

## Administrator provisioning

Create the account through normal Supabase Auth first. An authorized operator may
then run the following in the Supabase SQL Editor, replacing the placeholder with
the verified user's UUID. Never expose this operation in a browser client:

```sql
update public.user_roles
set role = 'admin'
where user_id = '<verified-auth-user-uuid>'::uuid
returning user_id, role;
```

Expect exactly one row. Revoke access by setting `role = 'user'`. No production
administrator was assigned during this milestone. Role checks read the protected
database role row rather than user-editable metadata.

## Verification

Run `supabase/tests/authorization.sql` and `supabase/tests/workflow.sql` as a trusted database operator through SQL
Editor or MCP `execute_sql`. It simulates `anon` and `authenticated` database roles
with user claims and uses exceptions to assert expected failures. It creates only
transactional fixtures and ends with `ROLLBACK`; a failure must abort/roll back the
transaction. Never remove the rollback when running against a live project.

Passed against the connected project: signup provisioning, anonymous publication,
active taxonomy, parent visibility, profile editing/privacy, role escalation denial,
draft ownership/editing, generated-record isolation and server-only writes, source
draft ownership, favorite uniqueness, admin archive access, Storage visibility and
write restrictions, owner-prefix transfer rejection, EUR/free/paid pricing,
nonnegative sort order, unique personalization fields and source-draft deletion.
All fixtures rolled back. Catalog empty-state behavior remains sample-only in the UI.

All 17 frontend entries build. The Supabase security advisor returned no findings;
performance warnings for overlapping catalog read policies were resolved. Remaining
[unused-index notices](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
are informational for the newly created empty tables; retain the requested indexes.
Database tests exercise real RLS and Storage object policies, but do not upload real
image bytes or exercise Auth emails, signed URL HTTP downloads, or frontend flows.

Implementation references: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Storage access](https://supabase.com/docs/guides/storage/security/access-control),
and [Auth profile triggers](https://supabase.com/docs/guides/auth/managing-user-data).
