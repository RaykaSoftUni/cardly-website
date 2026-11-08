# Fictional demo collection

The seed milestone applies two verified remote migrations:

- `20261107152507_catalog_browsing_filters`: adds safe public design identifiers,
  pricing filters and literal keyword search to the catalog RPC.
- `20261107152510_fictional_demo_catalog`: 12 fictional cards, six categories,
  four occasions, one template per card and varying personalization definitions.

Twelve designs are now published, one draft and one archived. Eight published cards are
available and free. Three published paid cards cost EUR 3.20, 4.50 and 4.80 and
remain unavailable. A fourth unavailable published card is free. Catalog seed
inserts preserve existing records with the same slugs. The two additional cat
cards are catalogue content added through existing authenticated admin RPCs;
no schema or migration history was changed. Never edit applied migration history.

## Designs and artwork

| Design | Composition | Fields beyond name/message/sender |
| --- | --- | --- |
| A very happy birthday | Left-aligned large typography and ruled signature | Headline |
| Tiny space explorer | Illustrated planet/rings with greeting below | Age, interests |
| The wild confetti club | Floating balloons/confetti and a large age region | Age |
| A beautiful new chapter | Botanical side branches and restrained typography | Relationship, tone |
| Older, wiser, allegedly | Oversized bold headline and age sticker | Age, humour style |
| A thousand little thanks | Double decorative frame and central message | — |
| The good news edition | Editorial headline, strong sidebar and spacing | Headline |
| You are pure sunshine | Side illustration and narrow message column | — |
| The memories ahead | Landscape illustration with a text overlay | — |
| A brilliant thing | Layered paper shapes and central message panel | Headline |
| Disco whiskers | Charcoal headphone cat, mint DJ deck and lavender/peach dance floor | Headline |
| Cake & catnaps | Ginger cat on an iced cake, daisies and a warm gingham frame | Headline |

Original SVG artwork is committed under `public/demo-cards/`, including thumbnail
and larger preview variants. It is intentionally local static demo media, not an
external URL or a claim that files were uploaded to Supabase Storage. Only
published cards have public artwork files. Their `card_images.storage_path` values
use the reserved `demo-cards/` prefix, resolved by the demo artwork component to
local static URLs. Other media continues to use the existing Storage architecture;
private user outputs must never use the static directory. A missing demo asset
falls back to the same design's SVG renderer.

`src/data/card-designs.js` contains twelve trusted renderer implementations. The
server returns only an allowlisted design key, not internal template JSON. The
older projection names ten designs; `publicDesignKey()` can also identify a known
local design from its matching public `demo-<key>` slug and exact reserved demo
asset path. Unknown keys, arbitrary slugs and arbitrary paths cannot select a
renderer. This avoids exposing private configuration or requiring a schema change
for new local artwork. Each
template snapshot records that key and supported dynamic-region names. Typography,
composition, illustration and decoration vary by design. The landscape is original
demo illustration, not a user photo. Uploaded-photo fields remain unsupported.

`npm run demo:artwork` recreates the static assets from the public renderer and
`supabase/seed/catalog.json`. Treat renderer keys as versioned contracts; introduce
a new key and template version before changing historical rendering behavior.

The two original cat illustrations are defined in `src/data/cat-artwork.js`.
Their CSS animations finish after 4.2 seconds; the editor provides Replay animation.
Reduced-motion users receive SVGs with animation styles omitted, and the replay
button is hidden. Static asset files also include a reduced-motion media query.
See [the reduced-motion technique](https://www.w3.org/WAI/WCAG22/Techniques/css/C39).
Editable recipient, headline, message and sender text is escaped and wrapped by
the existing renderer. These are browser SVG animations; final animated exports
and AI generation are not introduced.

To add these two fixtures to another configured development catalogue, run
`npm run demo:artwork`, then supply `CARDLY_ADMIN_EMAIL` and
`CARDLY_ADMIN_PASSWORD` through the environment and run `npm run demo:seed-cats`.
No privileged key is needed: the script verifies the authenticated database role
and uses the same checked admin RPCs as the application. It reads real taxonomy
IDs, creates drafts, configures templates/fields/assets, then publishes them free
and available. Reruns preserve matching published entries; conflicts fail without
overwriting existing content. Rebuild/redeploy the frontend alongside content
updates so the renderer and local files are available. The two records and an
idempotent second run were verified against the connected project.
Text is XML-escaped and wrapped conservatively; long text truncates with an
ellipsis inside its region. The full input remains in the form and saved data.

## Demo identities

After the catalog migration, run `supabase/seed/demo-accounts.sql` through the
trusted SQL Editor or Supabase MCP `execute_sql`. It has been applied to the
connected project. It creates these fictional email identities:

| Email | Database role |
| --- | --- |
| `alex.demo@example.test` | user |
| `sam.demo@example.test` | user |
| `admin.demo@example.test` | admin |

Each account has a profile, one owned draft, one favorite and one generation job
with immutable title/template/personalization/pricing snapshots. Generated text
explicitly labels placeholder behavior. The jobs remain `processing`, with no
fabricated image paths or completed exports. Ownership policies isolate all three
accounts, including the admin's personal records.

No emails were sent. The seed initially left passwords unset; they were subsequently
configured at the user's request through trusted administration, and login was
verified. Credentials are not recorded in this guide or the repository.
The account seed is optional environment data, separate from schema migrations.
Re-running preserves saved examples and explicitly restores the listed demo roles.
It refuses to modify an existing non-demo account with one of those email addresses.
Do not use demo identities as production administrators.

To enable interactive testing, create an ignored `.env.demo.local` containing:

```dotenv
VITE_SUPABASE_URL=<the verified project URL>
SUPABASE_SERVICE_ROLE_KEY=<server-only project credential>
CARDLY_DEMO_ALEX_PASSWORD=<unique password, at least 16 characters>
CARDLY_DEMO_SAM_PASSWORD=<different password, at least 16 characters>
CARDLY_DEMO_ADMIN_PASSWORD=<different password, at least 16 characters>
```

Then run `npm run demo:configure-accounts`. The trusted Node script uses the
official Auth admin API, verifies the demo marker, configures passwords and never
prints credentials. Keep this file ignored and restrict its filesystem access.
Never put the service key or passwords in `VITE_` variables, browser modules or
commits. The setup script remains an optional way to reset these passwords;
the initial passwords were configured separately through trusted administration.

## Connected pages

Home, catalog, occasion listings, detail, editor, login and My Cards now load real
Supabase data. The genuine multi-page navigation is preserved. Catalog filtering
supports occasion/category/style, free/paid and availability, plus literal search
against title, description, style and public taxonomy. Search is limited to 200
characters; filters remain in the URL across detail/editor navigation and back.
Empty and loading/error states are explicit. Unavailable paid cards have a View
Card action and EUR price, with no working purchase action.

The editor derives controls and field guidance from public server definitions.
It validates required fields and lengths inline, keeps input after errors and
refreshes the design-specific preview as values change. Values also remain in the
current browser tab's session storage for reloads. Previewing needs no login;
saving calls the authenticated draft RPC. Before generation, the latest form data
is saved and revalidated server-side. A success creates a labelled demo job, not an
image download. My Cards shows only owned drafts and snapshot-based previews.

Password login/logout and [protected administration](administration.md) are connected.
Registration and profile screens remain placeholders. Admin navigation is shown
only after a verified role check; database authorization remains authoritative.
No final renderer, payments, AI provider or user-photo pipeline is
introduced by this milestone.

## Verification

Run the rollback-only `supabase/tests/authorization.sql`, `workflow.sql` and
`seed.sql` through trusted SQL execution. The workflow test uses isolated fixtures
and can run alongside the seeded catalog. Seed checks verify role assignment,
catalog counts, paid blocking and private ownership for the actual demo users.

Browser regression tests mock RPC responses from the same seed manifest for
reproducibility, while exercising real local assets and page code. Enable the
read-only live public-catalog smoke test with `CARDLY_LIVE_SMOKE=1 npm run test:ui`.
It checks actual Supabase public visibility and loaded artwork. Authentication
with configured demo passwords and final image rendering are not verified by that
read-only test; SQL suites cover the ownership boundary.

Verified for this milestone: all 17 production HTML entries and route checks,
13 Chrome tests including the live smoke test, the three SQL suites, matching
local/remote migration checksums, and desktop/mobile screenshot review.
