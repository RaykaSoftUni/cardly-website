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

## Milestone 2 — Supabase schema and authorization

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

## Milestone 3 — Public catalog

Implement browsing, keyword search, category/occasion filters, preview images,
card details, EUR prices, availability labels, and clear personalization actions.
Show empty, loading, and error states. Drafts remain inaccessible publicly.
Unavailable paid cards show their price and cannot start final generation.

Completion: validate search/filter combinations, direct detail links, unpublished
records, and free versus unavailable paid behavior on mobile and desktop.

## Milestone 4 — Authentication and account access

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

## Milestone 7 — Protected catalog administration

Implement create/edit/archive, publish/unpublish, availability, free/paid settings,
EUR pricing, preview uploads/replacement, category/occasion assignment, title,
description, order, and template/personalization configuration. Prefer archival
when deletion would invalidate saved cards. Validate configuration before publishing.

Completion: verify the complete admin workflow and database rejection of regular
user attempts. Public catalog visibility must follow publication changes. Paid
purchase functionality remains disabled for the MVP.

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
