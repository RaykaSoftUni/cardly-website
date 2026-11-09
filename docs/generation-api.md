# Database personalization and generation API

Applied migration: `20261107144909_personalization_generation_workflow`, on the
existing Supabase project `netqiilhvhvmwhefsmxq`. Preflight confirmed the two earlier
migrations and empty application tables. The migration adds immutable template
history, snapshots, draft archival, card style and database RPCs. No frontend pages,
AI provider, payment system, image renderer or user-photo upload pipeline is added.

Call these operations through `supabaseClient.rpc(name, parameters)`. The JWT
supplies identity; private RPCs take no caller-selected owner or role. Database
functions are atomic transactions. On error, Supabase returns an error and all
changes made by the operation roll back. Render user text through `textContent`,
never as HTML, including future AI output.

## Public operations

| Operation | Parameters | Result |
| --- | --- | --- |
| `get_card_catalogue` | Optional `p_occasion` UUID, `p_category` UUID, `p_style` string, `p_available` boolean, `p_limit` (default 24), `p_offset` (default 0) | Array of public card projections |
| `get_card_detail` | `p_card_id` UUID | Public card plus field definitions, or null |
| `quote_card` | `p_card_id`, optional `p_expected_price` | Server quote and `requote_required`, or null |

Pagination limits are 1–100; offsets are nonnegative. Style is an optional catalog
string, independent of private template styling. Filters match exact values and
combine with AND. Results are ordered by display order and UUID. Only published
cards with active assigned categories/occasions appear, even when an admin calls
the public RPCs. Published unavailable paid cards can display their EUR price.
`available_for_purchase` is always false. `can_generate` in a quote requires an
available free card. Null free prices are quoted as zero; unknown paid prices
do not enable purchases.

The public projection includes title, slug, description, style, availability,
pricing/currency, public category/occasion identity and thumbnail/preview asset
metadata. Asset paths here refer only to permitted published `card-assets` objects.
No user Storage paths, template layout/style JSON, timestamps or admin fields are
included. Detail configuration explicitly selects only public field settings.
Direct anonymous SELECT on catalog tables is revoked; regular authenticated users
cannot read internal configuration through table endpoints either. Admins retain
RLS-protected catalog table access. Background/decorative paths are not included in
public detail; trusted rendering uses the stored template snapshot.

## User operations

| Operation | Parameters | Result |
| --- | --- | --- |
| `create_card_draft` | `p_card_id`, `p_personalization_data` object | The newly created owned draft |
| `update_card_draft` | `p_draft_id`, `p_personalization_data` object | Updated owned, nonarchived draft |
| `generate_card` | `p_draft_id`, optional `p_expected_price` | Processing generation or re-quote result |
| `delete_card_draft` | `p_draft_id`, `p_archive` (default true) | True on successful archive/delete |
| `get_generated_cards` | Optional `p_id`, `p_limit` (24), `p_offset` (0) | Only the caller's generated records |
| `set_card_favorite` | `p_card_id`, `p_favorite` (default true) | Requested favorite state |

Updates replace the complete personalization object, rather than merging it.
Owners can read drafts/favorites through their existing RLS-protected tables.
Archived drafts remain readable for the owner, but cannot be edited or generated.
Archiving/deleting works even when a template later becomes unavailable. Hard
deletion clears a generation's source reference without deleting its snapshots.
Favorites insertion is idempotent, requires a public card, and derives the owner.
Removal only removes the caller's entry. Publicly visible paid cards may be
favorited; they still cannot be personalized or generated.

Direct client writes to drafts/favorites are revoked so RPC validation cannot be
bypassed. Generated-card writes remain trusted-only. RLS still protects direct
reads. Profile editing remains limited to the caller's display name/avatar fields.

Validation contract:

- Authentication is required for all private operations (`42501` on failure).
- Missing/inaccessible draft IDs produce the same `P0002` error.
- Unknown personalization keys are rejected, including `user_id`, prices, prompts
  and template configuration. Missing/null required fields are rejected at draft
  creation/update and again at generation. Optional absent/null values are allowed.
- Text/textarea require JSON strings. Default maximum length is 1,000 characters;
  admin `min_length`/`max_length` may specify integers from 0 to 10,000. Required
  text must not be empty or only ordinary spaces. Total object size is at most
  65,536 bytes in Postgres's JSON text representation.
- Number fields require JSON numbers and enforce configured `min`/`max` bounds.
- Select fields require a string from `config.options` (1–100 nonempty strings).
- Unknown configuration keys, incompatible bounds, invalid field keys and image
  fields are rejected by an admin-write trigger. Field keys use lowercase letters,
  digits/underscores, start with a letter, and have at most 64 characters.
- Image personalization is explicitly unsupported. The API does not treat a
  client-supplied Storage path or MIME label as verified photo content. A later
  trusted upload service must inspect file contents, enforce field-specific type
  and size limits, assign unique owner paths and clean up temporary uploads.
- Validation uses `22023` errors; database constraints can also return their normal
  SQLSTATE codes. Messages identify invalid fields without returning private data.

## Generation and immutable history

`generate_card` locks the source draft, requires ownership and rechecks the current
card and taxonomy, availability, free pricing, field rules and current template.
A supplied expected price is only a comparison value. A mismatch returns:

```json
{"status":"requote_required","quote":{"price":0,"currency":"EUR","requote_required":true,"available_for_purchase":false}}
```

The quote contains additional card/pricing fields. A re-quote creates no generation
record. Matching a paid price never authorizes generation. All paid cards remain
blocked by the existing database availability constraint and eligibility checks.

Success returns `{"status":"processing","generated_card":{...}}`. The row
contains the server-derived owner, source draft, validated data, card snapshot
(ID/title/slug/pricing type/EUR price), current template ID/version, and a complete
render configuration snapshot. Generated text stays null because AI/text synthesis
is not implemented. Each explicit successful call creates a new job; callers must
not automatically retry a generation after an ambiguous network response. Rate
limits and idempotency keys are future workflow improvements.

Template layout/style/key edits automatically increment the current version and
insert an immutable `card_template_versions` row. Browser clients cannot set
versions or alter history. Drafts record their version at save time; generation
resolves the latest version and captures it independently. Catalog edits do not
rewrite earlier generation snapshots. Parent-card locks serialize generation with
template/field mutations; taxonomy rows are locked while eligibility is checked.
Database deadlock/serialization errors abort the operation and must be handled by
the caller without assuming a successful generation.

## Trusted renderer boundary

The database prepares jobs; it does not render pixels or pretend an image exists.
A trusted renderer must read a processing record, use **its saved template and
personalization snapshots**, render safely, and upload the result to a unique
`<user_id>/<generation_id>/<random>.png` or `.jpg` path. It must not fetch current
catalog configuration to render an older job. Use immutable asset paths for
template revisions and retain assets needed by historical renders.

Only `service_role` (and trusted database operators) may call:

```text
finish_card_generation(p_generation_id, p_output_image_path, p_error)
```

Pass the uploaded image path on success, or a sanitized `p_error` on failure.
Completion requires an existing object in `user-generated-cards` under the job
owner's prefix; failure stores up to 1,000 characters and marks the row `failed`.
Only processing jobs may transition. Users cannot complete jobs or substitute
snapshots. Outputs in this bucket are restricted by Storage to PNG/JPEG and 10 MiB.
The renderer must also validate the actual bytes it produces; SQL cannot inspect
image bytes. Use signed URLs or authenticated downloads for owned outputs. This
milestone does not deploy a renderer, so production jobs remain processing until
one invokes the completion/failure API. Worker scheduling, retry and orphan-output
cleanup are part of implementing that renderer. PDF, AI and photo inputs remain off.

## Admin operations

`admin_save_card_data(p_entity, p_data, p_id default null)` requires a verified
database Admin role. A null ID inserts; an ID applies a partial patch. Valid
entities are `cards`, `categories`, `occasions`, `card_images`, `card_templates` and
`personalization_fields`. The migration lists editable columns explicitly. IDs,
timestamps, role tables, template versions and arbitrary table/column names are
rejected. Table constraints, field-config validation and version triggers apply.
Pass card `status` to publish/unpublish/archive, and patch pricing/availability
together when changing a card to paid. Generated record ownership never grants
catalog editing privileges.

Admins may also use their existing RLS-protected catalog DML for supported
configuration removal. Historical template records prevent deleting a referenced
template; archive cards instead. No administrator was provisioned by this change.

## Verification and advisories

Both `supabase/tests/authorization.sql` and `supabase/tests/workflow.sql` passed
through MCP `execute_sql`, with fixtures rolled back. Tests simulate anonymous,
owner, other-user, admin and service roles; verify publication and filters,
projection privacy, validation and bypass denial, re-quotes and atomic failure,
snapshots, version preservation, latest-version generation, archival/deletion,
worker success/failure and Storage ownership. They verify database behavior, not
real binary uploads, browser integration or rendered image quality.

The advisor flags the intentionally exposed `SECURITY DEFINER` RPCs for
[anonymous](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
and [authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
execution. These are reviewed entry points: fixed empty search paths, explicit
execute grants, public projection allowlists, server-derived identity and admin
checks. Internal helpers are not directly executable by clients except the narrow
RLS predicates. These notices remain; they are not a claim that the advisor is
clear. Remaining performance findings are informational unused indexes.

Reference: [Supabase database function security](https://supabase.com/docs/guides/database/functions).

## Browser PNG export

The separate [browser exporter](card-export.md) now generates local PNG files for
supported free designs and owned free snapshots. It neither uploads outputs nor
invokes `finish_card_generation`. Processing database jobs keep their existing
status. A local download is not evidence of trusted worker completion.
