# Shared design system

Cardly uses warm ivory surfaces, plum actions, lilac/peach/sage card artwork,
editorial serif headlines and readable system sans-serif body text. Decoration
stays within template previews. Bootstrap 5 supplies foundational controls and
layout utilities; Bootstrap Icons is the only icon library. Fonts are local system
fonts; there are no third-party image or font requests.

## Tokens and layout

All HTML entries now link `src/styles/entry.css` directly in the head; it imports
Bootstrap, icons and the shared styles before the first content paint. The initial
HTML has a branded header and accessible loading shell instead of placeholder
feature copy. `feedback/page-loading.js` shares that shell with asynchronous page
renderers, sets/clears `aria-busy`, and keeps failed loads recoverable. Header roles
resolve before navigation is shown. Content remains at full contrast rather than
fading text, and reduced motion disables skeleton shimmer. Normal document
navigation and protected admin checks are preserved.

`src/styles/tokens.css` defines semantic colours, font families and sizes, spacing,
border width, radii, shadows, page width and UI motion. `main.css` implements the
shared layouts, controls, breakpoints, focus indicators and reduced-motion rules.
Use `.page-container`, `.page-section`, `.section-heading`, `.surface-panel`,
`.action-row`, `.card-grid` and `.editor-layout` for consistent composition.
`section()` in `components/ui.js` creates a reusable titled section.

## Component interfaces

Components accept a plain options object, return DOM nodes (or an object containing
`element` plus methods), and use text nodes for all caller-provided text. They do
not import Supabase, auth clients, AI providers, payments or storage. Page modules
connect their data/actions to these interfaces. Only explicitly labelled fixture
data lives in `src/data/sample-cards.js`.

| Component | Interface and integration contract |
| --- | --- |
| `layout/header.js` | `createHeader({pageId, authenticated, onLogout})`; current pages pass public state only. Authenticated links are prepared, including Saved Cards at `/my-cards/?view=saved`. Logout requires an injected callback. Future admin link metadata is exported but never rendered. Add role checking before enabling admin navigation. |
| `layout/footer.js` | `createFooter()`; public links and clear preview designation. |
| `ui.js` | `button({label, variant, href, onClick, disabled, type, iconName})`, `badge(label, tone)`, `section(options)` and decorative `icon(name)`. Buttons use visible text labels. |
| `cards/preview.js` | `createCardPreview({variant, recipient, headline, greeting, sender, imageUrl, imageAlt, sample})` returns `{element, update(textValues)}`. Accepts text/media independently of how it was generated. Images need meaningful caller-provided alt text, or an empty alt for decorative content. |
| `cards/listing.js` | `createCardListing({card, onPersonalize, canPersonalize})`, `priceAndAvailability(card)` and `createCategoryCard({label, description, iconName, href})`. Fixture IDs are passed through normal page URLs. Paid examples have disabled actions and text availability labels. A future authorized controller may inject `canPersonalize` and an action for entitled premium users; presentation state never grants access. No purchase action exists. |
| `cards/catalog.js` | `createCatalog({cards, initialFilters})` filters supplied data by keyword, occasion, category and style. Announces result counts and renders an empty state. This is local sample browsing, not database integration. |
| `forms/fields.js` | `createField(options)` returns `{element, input, name, validate, setError}`; `createForm({fields, onSubmit, onChange, submitLabel, description})` returns `{element, values, reset, setErrors}`. Stable labels, hints, required markers, linked error text, validation summary and first-invalid-field focus are built in. The caller supplies persistence, server validation and business rules. |
| `forms/personalization.js` | `createPersonalizationForm({onSubmit, onChange})`; includes recipient, age, sender, relationship, hobbies, tone, message and optional image. Image selection is local only; no file is uploaded. |
| `forms/admin-card.js` | `createAdminCardForm({onSubmit, onPublish, onUnpublish, onArchive})`; presents title/description, occasion, category, style, publication, availability, free/paid status, EUR price, image selection and configured personalization fields. Callbacks receive form values; actions without callbacks are disabled. No role or database logic lives here. |
| `feedback/states.js` | `emptyState({title, description, action})` and `loadingSkeleton({count, label})`; accessible status descriptions and reduced-motion support. |
| `feedback/confirm-dialog.js` | `await confirmDialog({title, message, confirmLabel, destructive})` returns a boolean. Uses a native modal dialog with explicit Tab wrapping, safe initial focus on Cancel, Escape cancellation and focus restoration. The caller performs the confirmed action. |
| `feedback/toast.js` | `mountToastContainer()` is idempotent and appends exactly one top-right container directly to `document.body`. `showToast({message, tone})` returns a dismiss callback; notifications announce through status/alert text and have a visible dismissal control without forced timeouts. |

Example of wiring a preview without coupling it to a service:

```js
const preview = createCardPreview({ headline: 'A day just for you', sample: true });
const form = createPersonalizationForm({
  onChange: ({ recipient, greeting, sender }) => preview.update({ recipient, greeting, sender }),
  onSubmit: () => showToast({ message: 'Sample preview updated. Nothing saved.' }),
});
container.append(form.element, preview.element);
```

## Current UI demonstrations

- `/` demonstrates the shared header/footer, hero preview, occasion cards and listings.
- `/cards/` demonstrates local sample search and filters, free cards, EUR-priced
  unavailable paid cards, badges and empty search results.
- `/card-editor/?id=sample-lilac` demonstrates form validation, live text updates,
  an explicit preview update status, and a confirmation dialog for resetting inputs.
- `/admin/card-edit/` is a directly reachable UI pattern with disabled persistence
  actions. It contains no administrator data. Admin navigation is hidden everywhere.
- `/admin/cards/` includes a clearly labelled loading skeleton demonstration.
- Auth, account, saved-card and sharing pages clearly identify their unimplemented
  functionality. No credentials, data, uploads, payments, downloads or sharing links
  are processed or persisted.

The existing multi-page architecture remains: normal anchors load separate HTML
files under the top-level `pages/` directory (admin entries in `pages/admin/`),
and each has its own ES module in `src/pages/`. Vite builds these into top-level
`dist/` with the same public routes. No SPA router or history interception exists.
Future rich/animated previews can replace the preview renderer while preserving
its content interface. Export, sharing, AI and entitlement services belong outside
visual components and require their own authorized milestones.

## Verification

`npm run build` validates all HTML entries; `npm run verify:preview` checks production
HTTP routes and assets. `npm run test:ui` exercises actual browser navigation,
responsive layouts, safe text rendering, filters, form validation, dialog focus,
toast placement, reduced motion and automated accessibility scans. Automated checks
complement manual visual and assistive-technology review; they do not establish
complete WCAG compliance.
