# Cardly

Repository: [RaykaSoftUni/cardly-website](https://github.com/RaykaSoftUni/cardly-website).

Multi-page greeting card application foundation. The 17 pages currently contain
a shared design system with clearly labelled sample cards, local filters and a
live sample text editor. Authentication, persistence, AI, uploads, payments, exports,
sharing, and administrator operations are not connected. See
[the design system guide](docs/design-system.md) for component interfaces.

## Requirements and setup

Use Node.js 22.12 or later in the Node 22 line, or Node 24+. `.nvmrc` selects
Node 22. The initial build was verified using Node 22 and Vite 8.3.6.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. No environment variables are required for
placeholders. To use the shared Supabase client, copy `.env.example` to `.env.local`
and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` using the intended
project's URL and modern `sb_publishable_` key. Restart Vite after changes. These
values are public browser configuration; never use secret keys, service_role keys
or database passwords. Missing configuration throws a clear error when the client
is imported. Import `{ supabaseClient }` from `src/services/supabase-client.js` in
future data services. Sample pages do not yet import it or perform backend calls.
See [the access model](docs/access-model.md) for the inspected project reference,
migration state and authorization rules. The database foundation is applied:
12 application tables with RLS and two private Storage buckets. See
[database operations](docs/database.md) for permissions, admin provisioning and
rollback-only SQL verification. Frontend pages still use sample data.
The [generation API](docs/generation-api.md) documents public catalogue/detail,
validated private drafts, transactional generation jobs and admin RPCs. Rendering
jobs require a trusted worker; no image renderer is deployed by the SQL workflow.

## Production verification

```sh
npm run build
npm run verify:preview
npm run preview
```

The build verifies that every intended HTML entry exists in `dist` with its
correct title and bundled module. `verify:preview` starts a temporary production
preview on `127.0.0.1:4173`, checks each directory route, explicit HTML URL,
query-string URL, and generated asset against the files in `dist`, checks unknown
routes return 404, then stops the server. Keep port 4173 free for this check.
These are HTTP checks; they do not replace browser accessibility or visual review.

`preview` serves the production build for manual review. Open `/admin/cards/`,
`/admin/card-edit/?id=123`, and the other links to review nested navigation.
Committed SQL migrations are in `supabase/migrations/`.

## Structure

- `pages/` contains all 17 HTML entries, including `pages/index.html` and
  nested public pages; `pages/admin/` contains the admin HTML entries.
- `dist/` contains generated production files and is a sibling of `pages/`,
  `docs/`, `src/`, `scripts/`, and `supabase/`.
- `src/pages/` contains one module per page and a shared entry manifest.
- `src/components/` contains modular layouts, cards, forms and feedback components.
- `src/styles/` contains shared styles, alongside Bootstrap's imported CSS.
- `src/services/` contains the shared Supabase client; `src/utils/` contains
  safe DOM helpers.
- `supabase/migrations/` is reserved for committed database migrations.
- `supabase/tests/authorization.sql` verifies database and Storage authorization
  with transactional fixtures that roll back.
- `supabase/tests/workflow.sql` verifies public projections, personalization,
  version snapshots, generation state transitions and admin operations.
- `scripts/` contains build and production preview verification.
- `docs/implementation-plan.md` describes milestones and the complete page list.

Vite uses `pages/` as its HTML root, keeps environment files at the project root,
and resolves `/src` module references to the shared top-level `src/` directory.
Vite 8 uses `build.rolldownOptions.input` for all HTML entries and writes to the
top-level `dist/` directory. The output directory is cleaned on each build. `appType: 'mpa'`
disables SPA fallback. Navigation uses normal anchor links without click
interception or a client-side router. Query parameters select explicitly labelled
sample cards and occasion filters. Render hosting should serve the generated files directly, without an
SPA rewrite to the homepage. Source organization does not add a `/pages/` prefix
to public URLs: `/`, `/cards/`, and `/admin/cards/` still load directly.

## Browser UI checks

After building, install a Playwright browser and run the UI checks:

```sh
npx playwright install chromium
npm run test:ui
```

Alternatively, set `CARDLY_CHROME_PATH` to an existing Chrome executable. The checks
start their own production preview on port 4174; keep that port free. Playwright
reports, screenshots and traces are ignored by Git.
