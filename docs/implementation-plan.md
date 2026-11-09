# Cardly implementation plan

## Product direction

Cardly helps people create digital greeting cards that reflect a recipient's
name, age, interests, personality, relationship to the sender, occasion, and
preferred tone. Begin with birthday cards and reusable designs, then extend to
other occasions. Visitors can browse without an account.

The required stack is HTML, CSS, vanilla JavaScript ES modules, Bootstrap,
Node.js, npm, Vite, Supabase Database/Auth/Storage, and Render Static Site hosting.
Use separate HTML entry files with shared components, services, and utilities.
Do not use TypeScript, React, Vue, or SPA routing.

## Milestone 0 — Project instructions and planning (completed)

Deliver AGENTS.md, matching .github/copilot-instructions.md, and this plan.
Inspect the workspace, preserve existing files, and review the documentation.
Do not implement application features, install dependencies, or provision services.
Completion: all three documents exist and agree on scope, stack, and workflow.

## Milestone 1 — Multi-page foundation (completed)

Current authorized scope: the 17 HTML entries below, separate JavaScript page
modules, shared navigation, Bootstrap styling, npm/Vite development and production
commands, a lockfile, environment example, ignored generated files, and the planned
source/migration/script directories. Verify every built entry and nested routes
through production preview. These placeholders do not implement authentication,
catalog data, editing, sharing, or admin permissions.

| Entry file (relative to pages/) | Purpose |
| --- | --- |
| index.html | Homepage with featured cards and categories |
| cards/index.html | Browse all greeting cards |
| card/index.html | Card details and personalization entry; accepts `?id=123` |
| categories/index.html | Browse categories |
| category/index.html | Cards within a category; accepts `?id=123` |
| login/index.html | User login |
| register/index.html | User registration |
| my-cards/index.html | Saved and created cards |
| card-editor/index.html | Personalization and optional AI content; accepts `?id=123` |
| card-preview/index.html | Personalized preview; accepts `?id=123` |
| card-share/index.html | Completed card sharing; accepts `?id=123` |
| account/index.html | User profile and account |
| admin/index.html | Admin dashboard |
| admin/cards/index.html | Card management |
| admin/card-edit/index.html | Create/edit templates; accepts `?id=123` for editing |
| admin/categories/index.html | Category management |
| admin/users/index.html | User management |

Query parameters will be handled when their corresponding features are implemented.
The sharing page shell is authorized here; public share links and user management
operations still require explicit feature scope and database authorization rules.

Implemented npm/Vite with Bootstrap and shared CSS/ES modules, separate page
entries/modules, navigation, placeholder content, environment configuration example,
and generated-file exclusions. README.md documents confirmed development, build,
preview, and verification commands. No backend or product workflows are implemented.

Completion: all entries build and load directly; shared navigation works on mobile
and desktop. No invented Supabase or hosting configuration is required to build.

Verification: Vite 8.3.6 built all 17 HTML entries using Node 22.23.4. Production
preview HTTP checks passed for directory routes, explicit HTML URLs, query strings,
all 19 generated assets, and unknown-route 404 behavior. Responsive navigation uses
Bootstrap wrapping and ordinary links; browser visual/accessibility review remains
to be performed. The workspace has no Git repository, so commit and push were
unavailable.

## Milestone 1A — Shared design system (completed)

Authorized scope: reusable visual components and clearly labelled sample screens.
Implemented semantic design tokens, Bootstrap and Bootstrap Icons, responsive public
navigation/footer, section layouts, template previews, listings/category cards,
buttons/badges, price/availability presentation, personalization and admin form
patterns, validation, skeletons, empty states, a confirmation dialog, and one
top-right toast container directly beneath document.body.

The sample catalogue filters supplied fixture data locally. The sample editor
updates preview text without persistence. Public navigation is Home, Cards, Login,
and Register. Authenticated navigation is prepared through injected state/actions;
admin navigation is never displayed before role checking exists. Backend access,
AI, payments, sharing, uploads, downloads, and catalog administration are not
implemented. See docs/design-system.md for interfaces and integration boundaries.

Verification: all 17 production HTML entries build; production preview route and
asset checks pass. Eleven Chrome browser tests pass, including all 17 pages at
1440px and 375px, local filters, safe text rendering, form validation, dialog
keyboard/focus handling, body-level toast placement, and reduced motion. Six page
compositions pass automated WCAG A/AA accessibility scans. Desktop and mobile
homepage screenshots were visually reviewed. Full manual assistive-technology
review remains outstanding. No Git repository is configured for commit/push.

## Milestone 1B — Page source organization (completed)

All 17 HTML entry files are under the top-level pages/ directory, including
pages/index.html, pages/cards/index.html and pages/admin/. JavaScript page modules
remain in src/pages/. Vite uses pages/ as its HTML root with a /src alias for shared
modules, environment files at the project root, and production output at the
top-level dist/. The existing public URLs and normal document navigation remain
the same. Build verification reads source documents from pages/.

Verification: the production build, all production preview route/asset checks,
and all 11 browser regression tests pass. Development serving was checked for
all 17 HTML routes and page modules, with browser rendering checks for the home,
catalogue, editor and nested admin pages. Git commit/push remains unavailable
because the workspace is not a Git repository.

## Milestone 1C — Repository setup

Repository setup: the workspace is now initialized on the initial-setup branch
with origin at https://github.com/RaykaSoftUni/cardly-website.git. Earlier notes
about Git being unavailable describe the state at those milestones.

## Milestone 1D — Supabase connection and access model (completed)

Authorized scope: inspect the configured Supabase project, add the shared client
using public Vite configuration, and document Visitor/User/Admin access in
docs/access-model.md. The MCP reports reference `netqiilhvhvmwhefsmxq`, no
application tables and no migrations. Local migration history is empty. The
project display name is not exposed by the configured MCP tools.

No schema, policies, authentication screens or application data workflows are
implemented here. Milestone 2 remains a separate authorization step.

Verification: all 17 production entries build; production preview checks pass for
routes, explicit HTML URLs, query strings, 21 assets and 404 behavior. Direct client
module checks pass for configuration, shared-instance identity, missing-variable
errors and rejection of non-publishable keys. No database writes were performed.

## Milestone 2 — Supabase schema and authorization (completed)

The explicit schema request authorized 11 application tables, RLS, indexes,
constraints, provisioning/update triggers and the two Storage buckets. Applied
remote migrations `20261107135537_catalog_authorization` and
`20261107135932_catalog_read_policies`; committed SQL matches remote versions.
See docs/database.md for exact permissions, provisioning and operational limits.
Optional AI logging is deferred; no frontend authentication, catalog integration,
favorites UI, PDF generation or payment functionality was implemented.

Verification: rollback-only direct database tests pass for anonymous, owner,
other-user and administrator permissions, Storage object access, ownership and
catalog integrity. All 11 tables have RLS enabled and both buckets are private.
All 17 HTML entries build. Security advisor has no findings; overlapping-policy
warnings were resolved, leaving informational unused-index notices on empty tables.
Real file-transfer and frontend authentication tests belong to their later features.

Define committed SQL migrations for profiles/roles, card templates, categories,
occasions, catalog cards, and user-owned card drafts/generated records. Model
publication separately from commercial status. Include EUR prices, preview image
paths, display order, template configuration, and personalization field definitions.

Enforce valid states and prices with database constraints. Public queries expose
only published cards. Owners access only their records; administrators manage
the catalog. Users cannot grant themselves administrator privileges. Configure
Storage policies for public catalog previews and private user uploads/exports.
Keep paid cards unavailable during the MVP; entitlement is a future payment concern.

Inspect local/remote migration history before applying migrations to an authorized
Supabase project. Document administrator provisioning without embedding secrets.

Completion: verify anonymous, owner, other-user, and administrator permissions,
including direct database/storage requests and invalid card states. Migration
files and any applied remote history agree.

## Milestone 2A — Server-side personalization and generation (completed)

The explicit backend workflow request authorized database RPCs for public catalog
and detail projections, price quotes, owned draft create/update/archive/delete,
generation jobs, owned retrieval, favorites and admin catalog changes. Applied
`20261107144909_personalization_generation_workflow`; local SQL matches the remote
history. Added immutable template versions, automatic version increments and
card/template snapshots, strict field validation and locked eligibility checks.
Direct client writes cannot bypass draft/favorite validation. Internal templates
and field records are admin-only; public RPCs return safe projections.

Verification: rollback-only authorization and workflow suites pass against the
remote database, including role boundaries, changed eligibility/configuration,
snapshot preservation and worker success/failure. All 17 frontend entries build.
Security advisor notices for deliberately callable definer RPCs are documented
with their controls in docs/generation-api.md; unused indexes are informational.

This completes the SQL workflow, not the later UI or rendering features. Generation
creates processing jobs; a trusted renderer must upload actual images and invoke
the service-only completion API. No renderer, AI, payments or user-photo pipeline
is implemented. Image field configuration/values are rejected until trusted upload
validation exists. The frontend continues using samples. See docs/generation-api.md.

## Milestone 2B — Fictional seed collection and connected previews (completed)

Authorized by the seed/browsing/personalization request. Applied migrations
`20261107152507_catalog_browsing_filters` and `20261107152510_fictional_demo_catalog`.
Implemented 12 fictional designs (10 published, one draft, one archived), six
categories, four occasions, differing field schemas, original local SVG artwork,
server-side search/pricing filters and distinct live SVG compositions. Connected
public browsing/detail/editor and owned draft/generation views, plus password
login/logout. Demo account seed provisions two users and one explicitly assigned
admin with private examples and no shared passwords. See docs/demo-collection.md.

Generation remains a labelled processing job with snapshots, not an image export.
No photo pipeline, AI, payments, registration UI or admin UI is introduced. Local
demo previews are static application assets; private outputs remain in Storage.
Interactive demo login requires trusted password configuration documented in the
guide. Later milestones below retain work outside this explicit request.

Verification: the production build and route/asset checks pass for all 17 entries.
Thirteen Chrome tests pass, including the live public Supabase smoke test and
automated accessibility checks. Desktop/mobile catalog and editor screenshots
were reviewed. Authorization, workflow and actual demo ownership SQL checks pass.
Local SQL checksums match remote migration history. Demo password login remains
untested until an operator configures the unset passwords.

## Milestone 3 — Public catalog

Implement browsing, keyword search, category/occasion filters, preview images,
card details, EUR prices, availability labels, and clear personalization actions.
Show empty, loading, and error states. Drafts remain inaccessible publicly.
Unavailable paid cards show their price and cannot start final generation.

Completion: validate search/filter combinations, direct detail links, unpublished
records, and free versus unavailable paid behavior on mobile and desktop.

## Milestone 4 — Authentication and account access

### Authorized account implementation (November 8, 2026)

Added authenticated `/account/`, editable own display name, read-only Auth email,
creation date and protected role, password change, current-session logout and
My Cards shortcut. Login links to new `/forgot-password/` and `/reset-password/`
HTML entries. Profile ownership and restricted update grants use the existing
database policies; password operations use Auth only. Email editing, phone,
preferences, deletion and registration remain outside this request.

Avatar upload/preview/replacement/removal is implemented behind a database capability
check. Additional server validation and private avatar Storage protections are
prepared in `supabase/pending/account_management.sql`, **not applied** because the
management connector still fails OAuth refresh after reconnection. No migration
version has been fabricated. Real email delivery/redirect configuration also needs
operator verification. See [Account setup and rollout](account.md).

Implement registration, login, logout, basic validation, session restoration, and
protected user/admin page behavior with Supabase Auth. Support confirmation and
redirect behavior according to the actual project configuration. Guests retain
catalog/detail access and may preview; require login to save or finalize a card.
Database policies remain authoritative even if client navigation is bypassed.

Completion: verify invalid inputs, authentication errors, refresh/session behavior,
logout, and direct access to protected data and pages.

## Milestone 5 — Template personalization and live preview

Support template-configured recipient name/age, sender, occasion, relationship,
interests, personality, tone, and custom message. Render dynamic headline, greeting,
sender, image region, and permitted background variations. Keep text editable and
update the preview from form changes. Start with deterministic template content.
Include optional image uploads only if explicitly selected for this milestone.

Completion: validate required/optional fields, long text, safe rendering, keyboard
use, and preview layout at different screen sizes. Preview and export must share
the same template rules.

## Milestone 6 — Final image export and saved cards

Generate a downloadable PNG or JPG for eligible free cards. Require an authenticated
user for final generation and saving. Store private user-owned records and any
artifacts with appropriate Storage policies. Provide a personal list and reopening
of saved cards/drafts. Persist sufficient template/version information to reopen
older cards consistently. Handle missing assets and export failures clearly.

Completion: inspect downloaded image quality, text wrapping and image behavior;
verify unauthorized access and unavailable paid cards remain blocked. Check that
reopened cards preserve their personalization. PDF, favorites, duplication, and
recently viewed history are optional follow-up scope.

## Milestone 7 — Protected catalog administration (completed)

Authorized by the explicit admin-management request. Connected all existing admin
HTML entries to verified Auth/database roles, catalog forms/actions, automatic
template revisions, field management/reordering, categories/occasions, private
Storage asset operations, basic user/role administration and metadata-only support.
The database independently rejects unauthorized operations and self-role changes.
New assets use immutable paths, and referenced historical files/snapshots survive
configuration changes. Paid cards remain unavailable. See docs/administration.md.

Applied four migrations beginning with `20261108094019_protected_admin_management`
and ending with `20261108100015_available_card_template_integrity`; local SQL
checksums match remote history. All four SQL suites, 23 browser tests, production
build and 17 route checks pass. Live tests exercised actual admin login and Storage
upload/replacement/privacy/deletion with temporary fixtures cleaned up. Advisor
notices for intentional definer RPCs and existing disabled leaked-password
protection are documented. No Auth password policy was changed.

Implement create/edit/archive, publish/unpublish, availability, free/paid settings,
EUR pricing, preview uploads/replacement, category/occasion assignment, title,
description, order, and template/personalization configuration. Prefer archival
when deletion would invalidate saved cards. Validate configuration before publishing.

Completion: verify the complete admin workflow and database rejection of regular
user attempts. Public catalog visibility must follow publication changes. Paid
purchase functionality remains disabled for the MVP.

## Milestone 7A — Card Images & Assets (implemented; SQL verification pending)

Authorized by the explicit image-management request. Implemented a reusable
Create/Edit asset section with drag/drop, immediate local previews, batch upload,
per-image type/alt text, primary selection, secondary ordering, replacement and
confirmed removal. New cards stage files until a real card ID exists; retrying an
upload does not create duplicate cards. The service cleans unreferenced replaced
or failed-association uploads while retaining historical dependencies.

Applied `20261108124321_card_asset_manager`: hero assets, unique primary metadata,
atomic selection/order operations, configurable bucket limits and safe public
primary projections. Browser and live API verification is recorded in
docs/card-assets.md. The standalone SQL suite and follow-up remote checksum check
are pending because MCP OAuth refresh failed after migration application, including
after reconnection. No privileged credentials or new dependencies were introduced.

## Milestone 7B — Stable page loading (completed)

Authorized by the request to remove jumping during page navigation. All 17 HTML
entries load shared styles from the head and start with the same branded/loading
shell. Removed the flash of old placeholder copy, reserved scrollbar space and
icon widths, kept loading footers below the first viewport, and deferred navigation
until session/role resolution. Catalog and admin views replace their loading shell
only when their initial content is ready. Reduced motion and accessible busy/error
states are supported; no content fade reduces text contrast.

Verification: all 37 browser tests pass, including JavaScript delayed while CSS
loads normally, delayed data, desktop/mobile header geometry, scrollbar alignment, ordinary
document navigation, admin gating, failed-load recovery and reduced motion. The
production build, all 17 production route checks and a real development-server
catalog/CSS check pass. No database/schema or authorization changes were made.

## Milestone 7C — Browser favicon (completed)

Added the requested multi-resolution Cardly `.ico` favicon, using the existing
plum envelope/heart identity, with an editable SVG source. All 17 HTML entries link
the shared icon. Production build, ICO format/size checks, copied asset equality
and all entry links were verified. No application behavior or database changed.

## Milestone 7D — Two original animated cat birthday designs

Added Disco whiskers (a headphone-wearing DJ cat) and Cake & catnaps (a sleeping
ginger cat on an iced cake). Both use original SVG artwork, distinct palettes and
compositions, editable name/headline/message/sender, and 4.2-second animations.
The editor can replay animation; reduced-motion rendering omits animation styles.
The two free, available entries were added to the connected catalogue through
existing authorized admin RPCs, preserving existing records. Templates and asset
metadata use the established demo-media convention. No schema/migration history
was changed, and no previously generated snapshots were rewritten. The collection
now has 14 cards, 12 published. See [demo collection](demo-collection.md) for the
repeatable seed command and public design resolution for the older projection.

Verification: build, all 19 production routes/assets and all 56 browser checks
passed, including real catalogue records, guest personalization, animation pixel
changes, still reduced-motion previews and mobile accessibility. The authenticated
seed's second run preserved both entries. SQL seed assertions were updated for
the 14-card collection but could not run through the unavailable management
connector; actual content was verified through the public/admin application APIs.

## Milestone 8 — Optional AI greeting generation

Implement only if selected for the MVP. Through a trusted server boundary, use
recipient details to generate a headline, short greeting, personalized message,
and optionally an image prompt. Keep all output editable before export. Protect
credentials, validate output, and enforce authentication, usage limits, and error
handling. Choose a provider/model only when this milestone is authorized.

Completion: verify editable output, safe rendering, provider errors and limits,
and absence of secrets in the built frontend. Deterministic personalization must
continue working when AI is unavailable.

## Milestone 9 — Release verification and Render deployment

Review accessibility, responsive layouts, authorization, safe content rendering,
loading/error states, and the complete browse-to-export flow. Run relevant checks
and a production build. Configure Render using the actual repository and verified
Vite output, preserving separate HTML routes. Configure actual Supabase Auth URLs
and permitted origins. Document confirmed deployment and recovery procedures.
Publish only when authorized; do not invent deployment URLs.

Completion: direct page URLs and assets work in the deployed site, authentication
redirects work, and user/admin/storage policies hold against the deployed client.

## Scope and workflow

Authorize each next milestone before implementation. Resolve decisions such as
design direction, image upload scope, AI inclusion, and service configuration
when they become relevant. Do not silently expand MVP scope.

Real payments, physical ordering, printing/shipping, subscriptions, social login,
multilingual generation, animations/video, scheduled/email delivery, public share
links, AI illustrations, gift cards, and corporate accounts are future extensions.
Paid availability requires a later payment and entitlement milestone.

After each successful milestone, run relevant checks and the build when available,
review the diff, commit only milestone changes, and push if a remote is configured.
Never force-push, backdate commits, or manufacture history. Report unavailable
checks, Git setup, remote access, and external configuration honestly.

At initial inspection, this workspace contained only AGENTS.md and was not a Git
repository. There were no application commands, build tooling, or configured remote
to verify. Repository setup is a future explicit action, not part of milestone 0.

## Public FAQ — completed

The explicit FAQ request authorizes `/faq/`, its separate HTML/module entry,
shared footer link, ten topic groups and accessible button disclosures. Topic
fragments support direct navigation and keyboard focus. Answers distinguish
current browsing, guest personalization, private drafts and demo jobs from future
AI, uploads, payments, final downloads and sharing. The page requires neither
sign-in nor a Supabase request. No backend or payment behavior changed.

Verification: all 20 production HTML entries build; production preview checks
pass for routes, explicit HTML URLs, query strings, 30 assets and 404 behavior.
All 15 FAQ/shared-design browser checks pass, covering keyboard Enter/Space,
expanded/hidden state, fragment navigation, mobile overflow, backend-independent
public access and automated WCAG A/AA checks with answers expanded.

## Public Pricing — completed

The explicit Pricing request authorizes `/pricing/` and top navigation links for
visitors and authenticated users. Shared surfaces, badges, buttons and typography
present free and premium options side by side on desktop and stacked on mobile.
Free cards link to available free catalogue results; premium designs link to the
paid catalogue. No starting price is invented: premium EUR prices remain per-card
in the catalogue. Paid personalization and purchases are unavailable. AI, uploads,
final rendering, downloads and sharing are clearly labelled as future features;
no checkout, payment flow or entitlement behavior was added.

Verification: all 21 HTML entries build; production checks pass for all routes,
explicit HTML URLs, query strings, 31 assets and 404 behavior. All 15 existing FAQ
and shared-design browser checks pass. Both pricing browser checks pass, covering
backend-independent access, active navigation, free/paid filter links, mobile menu,
375/768/1440px overflow and automated WCAG A/AA scans. One initial test selector
required correction to use the availability dropdown's accessible role.

## High-resolution browser PNG export — completed

The explicit download/export request authorizes PNG generation for supported free
personalized designs, including private saved generation snapshots. The editor
rechecks current availability before local generation. The shared SVG renderer
produces a fixed 1500 × 2000 PNG (3:4) without capturing UI or resizing a preview
bitmap. Long text wraps and shrinks rather than being truncated; signatures stay
in their bottom text region. Animated artwork exports as a deterministic still.
Download Card appears only after successful generation and is invalidated on edits.
Filenames contain a sanitized public design title and no private identity/message.

Saved snapshots use their stored design key and personalization. This local export
does not complete server jobs, upload outputs, or change database authorization.
Unknown/custom layouts, incompatible aspect ratios and photo-dependent layouts
require compatible rendering before export. AI imagery, uploads, JPG/PDF formats
and a trusted server worker remain outside this implementation. See
[card export](card-export.md) for the supported boundary and renderer-version limit.
FAQ and Pricing content now reflect the implemented PNG downloads.

Verification: all 21 entries build and production route/asset checks pass. All 27
affected browser checks pass, including real PNG downloads and header dimensions,
all 12 renderers, full long-text bounds, repeated deterministic encoding, failed
encoding recovery, paid/unavailable rejection, owned snapshot export, responsive
layout, reduced motion and accessibility. A downloaded personalized space card was
visually inspected. The reduced-motion screenshot test now scrolls the image into
view before taking either sample to avoid scroll-position rasterization changes.
