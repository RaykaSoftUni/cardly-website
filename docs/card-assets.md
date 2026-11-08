# Card Images & Assets

The Create/Edit Card screen now includes **Images & Assets**, backed by the private
Supabase `card-assets` bucket and the card's `card_images` metadata records.

## Using the manager

- Drag images into the drop area or use the keyboard-accessible file picker.
- Select up to 20 files per batch. Each appears immediately as a local preview.
- Choose Thumbnail, Preview image, Background, Hero illustration or Decorative
  asset for each file, and enter its own meaningful alt text.
- Optionally mark a selected image as the primary catalogue preview. Existing
  images have a **Use as primary preview** action. The primary image has a badge,
  stronger border and larger preview; secondary images retain their own order.
- Upload the batch, or, on a new card, save the card to upload its staged files.
- Move secondary images up/down, edit metadata, replace an image, or remove it
  after confirmation. Replacements also preview locally before uploading.

New-card files remain in memory until the card has been saved and has a real UUID.
A failed upload keeps its description/selection available for correction. Retrying
reuses an already-created card instead of creating duplicates. Successful uploads
are removed from the pending queue, so later retries do not re-upload them.
Selections survive saves in other sections of the same editor. Navigating away or
reloading ends the in-memory file selection.

Catalogue/detail pages use the explicit primary image even when its asset type is
Hero illustration. Without a primary, they fall back to a suitable thumbnail or
preview, then the existing safe design placeholder. Broken images also fall back.

## Validation, settings and storage

**Upload settings** configures the bucket's maximum size for all catalogue assets.
The default is 5 MiB; the UI accepts 1–20 MiB. The checked server operation accepts
1 KiB–20 MiB, subject to the project's own Storage limit. New uploads re-read the
current limit. Lowering it does not delete existing objects.

Storage enforces the byte limit and PNG/JPEG/WebP MIME allowlist. The browser
service additionally verifies file signatures, decoding and a 40-million-pixel
limit. Invalid files do not reach upload. SVG is intentionally not an uploaded
format; previously committed SVG demo artwork is still supported as local media.

Each upload uses `cards/<card-uuid>/<random-uuid>.<extension>`, never the original
filename. Postgres stores only card association, path, type, alt text, order and
`is_primary`. No image binaries are written to application tables. Primary/public
preview alt text is constrained in the database; the asset RPC and UI require alt
text for every managed image type.

Only authenticated admins may change asset metadata, primary selection, order or
bucket limits. RLS and Storage policies still reject regular-user mutations,
independently of UI visibility. No Service Role key is used in the browser.

## Replacement and cleanup

Replacements upload a fresh object, save its association, then attempt to remove
the old file only if unreferenced. Failed associations attempt cleanup of the new
object. Removing an image deletes the association and then an eligible object.
Existing reference checks retain objects used by any current/historical template,
other image association or generated snapshot. Static demo artwork is not deleted
from source. Cleanup may require an operator retry if authorization or network
access is lost during the multi-request operation.

A previously downloaded response may remain cached after an object is deleted;
cleanup verification uses the Storage object listing rather than assuming a
cached download immediately fails. Normal image replacement uses a new path, so
new catalogue metadata cannot accidentally point to an old cached replacement.

## Database contract and verification

Completed checks include the full 30-test browser/live API run and a focused
15-test admin run covering the additional partial-upload/editability case. The
production build and all 17 route/asset checks also pass.

Migration `20261108124321_card_asset_manager` was applied successfully and its
version/name were confirmed through MCP immediately afterward. It adds:

- Hero asset type and `is_primary`, with at most one primary per card enforced by
  a partial unique index. Existing preview records receive deterministic primary
  assignments.
- `admin_save_card_asset(p_card_id,p_asset,p_id)`, which locks the parent card,
  validates metadata/ownership and atomically switches the primary image.
- `admin_reorder_assets(p_card_id,p_asset_ids)`, which accepts each card asset
  exactly once and rejects duplicate, missing or foreign IDs.
- `admin_asset_settings(p_max_bytes)`, which reads or changes the bucket limit
  after checking the protected admin role.
- Safe public projections that mark and prioritize the selected primary image.

Browser checks cover multiple selection, drag/drop, immediate previews, per-image
alt text, create-card staging, retry without duplication, size/type rejection,
primary selection, ordering, replacement, cancellation/removal, preserved staging,
public fallback and accessibility. Live API checks exercise real Storage and RPCs,
including hero assets, unique-primary constraints, normal-user denial, private
assets, public primary projections and cleanup of isolated test records/files.

`supabase/tests/assets.sql` adds rollback-only SQL checks. **It could not be run in
this session:** after the successful migration, Supabase MCP began returning
`OAuth token refresh failed: Failed to parse server response`, including after the
user reconnected it. Follow-up migration checksum/SQL-suite verification remains
pending a working MCP session. This does not affect the application's separate
Auth/API connection, used successfully for the live integration tests.
