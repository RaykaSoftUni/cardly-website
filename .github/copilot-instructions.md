# Workspace instructions

These instructions apply to this directory and all its subdirectories. Read and
follow them whenever working in this workspace. More specific `AGENTS.md` files
may add instructions for their directories. System and developer instructions,
and the user's current explicit requests, take precedence.

## Working with the user

- Treat requests to build, change, or fix something as authorization to do the work.
- Continue through implementation and appropriate verification when possible.
- Make reasonable assumptions for routine, reversible choices. Ask when missing
  information materially affects the result or an action requires approval.
- Give concise progress updates during substantial work.
- Explain the outcome plainly, including verification and any remaining limits.
- Never claim that a check passed or an action completed without evidence.

## Working in this repository

- Inspect relevant files and existing conventions before making changes.
- Keep changes focused on the request; avoid unrelated refactors.
- Preserve user changes and existing behavior outside the requested scope.
- Prefer simple, maintainable solutions and existing dependencies.
- Do not add dependencies unless they provide a clear benefit for the task.
- Do not invent project commands or architecture. As the project develops,
  document confirmed setup, development, and verification commands in README.md.
- Update relevant documentation when setup or behavior changes.

## Verification

- Run checks appropriate to the change using the project's existing tooling.
- Add or update meaningful tests for changed behavior when suitable.
- Do not add tests that merely duplicate implementation details.
- Report checks that could not run and explain why.

## Boundaries

- Do not delete or overwrite unrelated work.
- Follow the milestone commit and push workflow below. Publish, deploy, or contact
  other people only when authorized.
- Never store secrets in source files, documentation, logs, or commits.
- Do not weaken security controls to make a task pass.
- Follow required tool approvals and workspace access restrictions.

## Maintaining these instructions

- Keep durable, workspace-specific preferences in this file when the user asks
  to establish or update them.
- Keep instructions concise and actionable; do not record temporary task status.
- Create nested AGENTS.md files only when a subdirectory needs distinct rules.

## Product and scope

- Cardly creates highly personalized digital greeting cards using recipient
  details, interests, relationships, occasions, and preferred tone.
- Implement only the current agreed milestone in docs/implementation-plan.md.
  The initial milestone is documentation only; do not implement application
  features until the user authorizes the next milestone.
- Start with birthdays while allowing additional occasions later.
- Support public catalog browsing, search, filters, card details and previews.
- Model free cards, paid available cards, paid unavailable cards, and drafts.
  Display applicable prices in EUR. Keep publication and availability explicit.
- Payment processing is outside the MVP. A paid card must not become usable just
  because its catalog status says available; require verified entitlement when
  payments are eventually implemented. Initially keep paid cards unavailable.
- Plan for registration, login, logout, persistent sessions, editable
  personalization, preview, downloadable images, saved user cards, and protected
  catalog administration. Optional features require explicit milestone scope.

## Required technology and architecture

- Use HTML, CSS, vanilla JavaScript ES modules, Bootstrap, Node.js, npm, and Vite.
- Do not use TypeScript, React, or Vue.
- Build a genuine multi-page application with separate HTML entry files and
  shared components, services, and utilities. Do not replace it with SPA routing.
- Keep HTML entry files in the top-level pages/ directory, including pages/admin/.
  Keep page JavaScript modules in src/pages/ and generated output in dist/.
- Use Supabase Database, Auth, and Storage; target Render Static Site hosting.
- Enforce access control and card integrity in the database, including user
  ownership, administrator permissions, publication, availability, and pricing.
- Commit SQL migrations and keep them synchronized with remote migration history.
  Inspect migration state before applying changes; never fabricate history.
- Never invent credentials, project identifiers, or deployment URLs. Never expose
  privileged keys in browser code. Only intended public client configuration may
  be included in the frontend; enforce its permissions through database policies.
- Keep AI credentials and privileged operations on a trusted server boundary,
  such as a Supabase Edge Function. AI output must remain editable.
- Render user content safely, validate inputs, and use accessible, responsive
  interfaces across desktop, tablet, and mobile.
- Verify version-specific APIs against official documentation when implementing.

## Milestone completion workflow

- Run relevant checks and the build when available; report results honestly.
- Review the diff and stage only the milestone's changes, preserving unrelated work.
- After a successful milestone, commit its changes and push to the configured
  remote if available. This workflow is authorized by the project brief.
- Never force-push, backdate commits, or manufacture Git history.
- If Git, a remote, credentials, or tooling are unavailable, report the limitation.
  Do not invent a remote or initialize a repository merely to simulate completion.
- Keep AGENTS.md and .github/copilot-instructions.md consistent when updating
  these project instructions.
