# Access model

This document defines the role model and its database enforcement. The schema,
RLS and Storage foundation are implemented; frontend product workflows still
require their own milestones. See [database operations](database.md) for the exact
permissions, migration history, verification and administrator provisioning.
The [generation API](generation-api.md) now implements validated RPCs and immutable
template history. Public catalog access uses safe RPC projections; internal
template/field tables are admin-only. Draft/favorite writes must use the RPCs.

## Project inspection

On 2026-11-07 the configured Supabase MCP returned:

- Project reference: `netqiilhvhvmwhefsmxq`.
- Project URL: `https://netqiilhvhvmwhefsmxq.supabase.co`.
- Application tables: none reported by `list_tables`.
- Remote migrations: none reported by `list_migrations`.
- Local migrations: none; `supabase/migrations/` contains only `.gitkeep`.

The requested project name is `cardly-website`. The configured MCP exposes the
project URL but no project-name lookup; the display name could not be independently
confirmed. No schema or migration history has been fabricated or modified.

The empty-project inspection above records the connection milestone's starting
state. The subsequent schema milestone applied `20261107135537_catalog_authorization`
and `20261107135932_catalog_read_policies`, creating 11 RLS-protected application
tables and two private Storage buckets. Local SQL matches remote history.

## Visitor

A visitor is unauthenticated. Visitors may browse, search and filter published
public card templates, categories and occasions; view public preview images and
card details; see free, paid and unavailable states and applicable EUR prices;
and preview personalization forms for eligible available cards.

Visitors cannot save personalized cards, read profiles or private generated cards,
drafts or favorites, manage card records, view unpublished or archived templates,
or access administration.

## User

A user is registered and signed in through Supabase Authentication and has visitor
permissions. Users may read and update permitted fields of their own profile;
personalize eligible available templates; create and save drafts under their own
account; read their own saved cards, generated cards and favorites; update editable
drafts; delete or archive their own drafts where supported; download generated cards
when the template permits; and access their own account area.

Users cannot read other users' profiles or private cards, modify others' records,
manage catalog templates, publish/unpublish cards, change prices or availability,
assign roles, or access administration without a verified Admin role.
Favorites and other optional workflows remain subject to explicit milestone scope.

## Admin

An admin is an authenticated user with an explicitly assigned, server-controlled
administrative role. Admins have user permissions where applicable and may:

- Create, read and update templates, including unpublished and archived templates.
- Publish, unpublish, archive and restore templates.
- Manage titles, descriptions, metadata, categories and occasions.
- Manage preview images and related assets.
- Set free/paid status, EUR pricing and availability.
- Configure supported personalization fields, display order and featured state.
- Review generated-card records when required for administration.
- Perform supported user administration and access data necessary for support.

Catalog administration is enforced by RLS. User administration and review of
private records require trusted server operations and are not granted to admin
browser clients. Scope sensitive record access to an administrative need.

## Database enforcement

Use Supabase Auth for identity and enable Row Level Security on application
tables. Hidden navigation and disabled buttons are presentation, not authorization.
Verify anonymous, owner, other-user and admin access with direct requests when
implementing policies; deny access unless an explicit policy permits it.

Potential user-owned tables include `profiles`, `saved_cards`, `card_drafts`,
`generated_cards` and `favorites`. Each record should have a `user_id` referencing
the authenticated Supabase user. Normal ownership checks use:

```sql
auth.uid() = user_id
```

Policies must restrict reads to the owner, require inserts for the current user,
and reject updates to ownership fields. Use column privileges, constraints or
trusted functions where RLS alone cannot restrict permitted profile fields or
ownership changes. Visitors cannot access private records. Users may update only
approved profile fields, never their role or other authorization attributes.

Potential public catalog tables include `cards`, `categories`, `occasions`,
`card_images` and `personalization_options`. Anonymous reads may return only
published records intended for public access. Related images/options must also
respect the parent template's publication state. Unpublished, archived and
internal templates must not leak through related records or public assets.

Publication is separate from availability and pricing. Published unavailable
cards may display details and EUR prices, but cannot be used for generation.
Keep paid cards unavailable initially. A future paid-available status must still
require verified entitlement before use; status alone never grants access.

Storage authorization must distinguish public catalog previews from private user
uploads and exports. Do not put private or unpublished assets in a public bucket.

## Trusted roles and operations

Keep the initial roles Visitor, User and Admin. Verify admin privileges against a
trusted source such as a protected role field, server-issued custom claims, or
another server-controlled role store. Never trust client state or user-editable
metadata for role assignment. The database independently verifies admin privileges
for every privileged operation, even when the UI hides admin navigation.

Use trusted server boundaries for privileged operations and AI credentials. Never
expose secret keys, service_role keys or database passwords in browser code or
`VITE_` variables. Service Role access bypasses RLS and belongs only on a trusted
server. The browser uses a publishable key with Auth and RLS.

## Application connection

`src/services/supabase-client.js` exports one `supabaseClient` per page's module
graph using `@supabase/supabase-js` 2.119.0. It reads `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY`, reports missing variable names without values,
and accepts modern `sb_publishable_` keys only. Initialization follows the
[official JavaScript client documentation](https://supabase.com/docs/reference/javascript/initializing).

The ignored `.env.local` holds the MCP-provided public URL and publishable key.
Other environments must configure these separately. The client is ready for
future service imports; existing sample pages do not yet call Supabase. Application
data access must use this client and database authorization, independently of the
privileged MCP development tools. No live product workflow is authorized here.
