# Fumadocs Migration PRD

## Goal

Move the documentation site from the current Jekyll/GitHub Pages Markdown setup to a Fumadocs-powered static Next.js site, while preserving GitHub Pages production publishing and PR preview behavior.

This should be implemented as one coherent PR-sized migration. Do not split the work across separate PRs, because app routing, content locations, generated reference output, OpenAPI reference pages, CI, E2E assertions, and Pages deployment all depend on each other.

## Current State

- Public docs are plain Markdown under `docs/`.
- GitHub Pages builds `docs/` with Jekyll via `.github/workflows/pages.yml`.
- PR previews are deployed under `pr-preview/pr-<number>/` on the `gh-pages` branch and commented back on the PR.
- TypeDoc generates SDK/React Markdown reference docs into `docs/reference/sdk`.
- `scripts/e2e.mjs`, `README.md`, `.github/workflows/ci.yml`, and `docs/verification.md` contain Jekyll-era docs assumptions.
- The HTTP API reference is currently handwritten in `docs/reference/http-api.md`.

## Decisions To Implement

### Fumadocs Implementation Baseline

Follow the official Fumadocs Next.js manual installation pattern rather than inventing a custom docs architecture. The implementation should include:

- `apps/docs/source.config.ts` using `defineDocs` from `fumadocs-mdx/config`.
- `apps/docs/next.config.mjs` using `createMDX` from `fumadocs-mdx/next`.
- `apps/docs/lib/source.ts` using `loader` from `fumadocs-core/source`.
- `apps/docs/app/layout.tsx` wrapping the app in `RootProvider` from `fumadocs-ui/provider/next`.
- A root optional catch-all docs route, preferably `apps/docs/app/[[...slug]]/page.tsx`, because the approved route map puts the docs overview at `/` rather than under `/docs`.
- A shared docs layout component only if it removes real duplication. Do not add a custom `SidebarProvider`; Fumadocs `DocsLayout` already owns the sidebar provider in current Fumadocs UI.
- Centralized MDX overrides in `apps/docs/mdx-components.tsx`.
- CSS imports matching current Fumadocs UI guidance, including `fumadocs-ui/css/preset.css` and `fumadocs-ui/css/neutral.css`.
- OpenAPI styling from `fumadocs-openapi/css/preset.css` when the OpenAPI reference is enabled.

Official references for implementers:

- Fumadocs Next.js manual installation: <https://www.fumadocs.dev/docs/manual-installation/next>
- Fumadocs MDX setup: <https://www.fumadocs.dev/docs/mdx>
- Fumadocs MDX with Next.js: <https://www.fumadocs.dev/docs/mdx/next>
- Fumadocs loader/source API: <https://www.fumadocs.dev/docs/headless/source-api>
- Fumadocs navigation and page tree: <https://www.fumadocs.dev/docs/navigation>
- Fumadocs file conventions and `.meta` files: <https://www.fumadocs.dev/docs/headless/page-conventions>
- Fumadocs static build: <https://www.fumadocs.dev/docs/deploying/static>
- Fumadocs OpenAPI integration: <https://www.fumadocs.dev/docs/integrations/openapi>
- Fumadocs OpenAPI server helpers: <https://fumadocs.dev/docs/ui/openapi/server>
- Fumadocs Orama/static search: <https://www.fumadocs.dev/docs/search/orama>
- Fumadocs link validation: <https://www.fumadocs.dev/docs/integrations/validate-links>
- Next.js `basePath`: <https://nextjs.org/docs/pages/api-reference/config/next-config-js/basePath>
- Next.js static exports: <https://nextjs.org/docs/app/guides/static-exports>
- TypeDoc Markdown plugin: <https://typedoc-plugin-markdown.org/docs>

### Hosting And Deployment

- Keep GitHub Pages as the hosting target.
- Replace the Jekyll build with a Fumadocs/Next static export.
- Keep production deployment to the root of `gh-pages`.
- Preserve PR preview behavior:
  - deploy same-repository PR previews under `pr-preview/pr-<number>/`;
  - upsert the bot preview comment;
  - do not publish previews for draft PRs;
  - clean up previews on close, merge, draft conversion, or when the PR no longer changes docs;
  - preserve same-repository-only preview semantics.
- The workflow should build the Fumadocs static site once for production and once for preview with the correct base path.
- Use environment-driven base paths so the same docs app can build for:
  - production GitHub Pages path: `/<repo-name>`;
  - preview GitHub Pages path: `/<repo-name>/pr-preview/pr-<number>`;
  - local development path: no base path.
- Prefer configuring `basePath` and `assetPrefix` in `apps/docs/next.config.mjs` from environment variables such as `NEXT_PUBLIC_DOCS_BASE_PATH` or `DOCS_BASE_PATH`.
- `basePath` is build-time inlined by Next.js. Production and preview outputs must be built separately with their own base path; do not build once and rewrite URLs later.
- Use `output: 'export'` in the docs app Next config and publish the static export directory, not the `.next` runtime output.
- Set `images.unoptimized: true` if the docs app uses `next/image`, or avoid `next/image` entirely in v1.
- Do not use request-dependent route handlers, redirects, rewrites, headers, cookies, or other Next server features that are unsupported by static export.
- Do not keep the existing post-build `sed` link rewrite as the preview strategy. Keep a small post-build validation step instead.
- Include `trailingSlash: true` unless the implementation proves GitHub Pages and Fumadocs static export work cleanly without it.
- Add an early smoke step before the full migration: scaffold one minimal `content/docs/index.mdx`, build `apps/docs`, and confirm static export works with no base path, with `/<repo-name>`, and with `/<repo-name>/pr-preview/pr-123`.
- The Pages workflow should install once, run TypeDoc once, then build production and preview static exports separately with distinct base-path environment variables.

### Repository Shape

- Add a dedicated docs app at `apps/docs`.
- Make `apps/docs` a normal npm workspace with its own `package.json`.
- Keep docs-site dependencies scoped to the docs app, while using the root `package-lock.json`.
- Use the same major versions already present where compatible: Next 16 and React 19.
- Add Fumadocs dependencies needed for MDX docs, UI, OpenAPI rendering, and syntax highlighting.
- Keep docs build separate from product package build:
  - `npm run build` should not become a docs-site build.
  - Add explicit root scripts such as `docs:dev`, `docs:build`, `docs:preview`, `docs:reference`, and, if supported by the chosen Fumadocs tooling, `docs:validate`.
  - Do not add docs build to root `verify` unless there is a separate explicit docs verification script.
- Do not add `apps/*` broadly to the root workspace list unless the repo intentionally wants every future app to become a workspace. Prefer adding `apps/docs` explicitly.
- Root `package.json` must explicitly include `apps/docs` in `workspaces`; otherwise workspace commands and lockfile behavior will be brittle.
- The docs app should have its own `tsconfig.json` with Next/Fumadocs-appropriate module resolution rather than joining the root `tsc -b` project references.
- Add an explicit docs app typecheck command, for example `npm run docs:typecheck`, because Fumadocs OpenAPI virtual pages change the source page type and should be checked independently of product package typechecking.

### Content Source

- Move curated documentation from `docs/` to `content/docs/`.
- Convert curated docs pages to `.mdx`.
- Do not preserve current URL paths for compatibility. Treat this as a greenfield route design because the site is not published yet.
- Use Fumadocs metadata/page-tree files as needed to express the information architecture.
- Keep the first screen as a practical docs overview, not a branded marketing landing page.
- Because `content/docs` lives outside `apps/docs`, configure `defineDocs` with an explicit relative content directory, for example `defineDocs({ dir: '../../content/docs' })`, or choose the equivalent official configuration that resolves correctly when the docs workspace builds from `apps/docs`.
- Keep generated and curated content clearly separated. Curated MDX pages should be authored intentionally; generated TypeDoc Markdown should remain under the generated subtree only.
- Use `.meta.json` files to express sidebar ordering and section labels. Do not depend on filename sorting for the approved IA.
- Treat `content/docs/index.mdx` as the overview source for `/`.
- Use Fumadocs link validation or an equivalent build-time link check if available; broken internal links should fail docs validation.
- If using the documented Fumadocs link validation path, implement it with `next-validate-link`, `source.getPages()`, heading hashes from `page.data.toc`, and the correct catch-all route key for this app. The official example uses `docs/[[...slug]]`; this repo should adapt that to the actual root catch-all route.

### Route Map

Use this clean route map:

- `/` overview
- `/start/sending-events`
- `/start/identifying-users`
- `/start/react`
- `/operate/architecture`
- `/operate/clickhouse-schema`
- `/operate/deployment`
- `/operate/railway`
- `/operate/helm`
- `/operate/verification`
- `/reference/api`
- `/reference/openapi`
- `/reference/sdk`
- `/reference/react`
- `/project/publishing`
- `/project/agent-skill`
- `/project/sdk-stability`

GitHub Pages may serve the app under the repository base path in production and under an additional PR preview prefix for previews. The internal docs IA should still use the route map above.

Implementation detail:

- Configure the Fumadocs source loader so page URLs resolve to the approved root-relative route map. Because the docs route is not `/docs`, avoid blindly copying examples with `baseUrl: '/docs'`.
- If the current loader supports `baseUrl: '/'` or `baseUrl: ''`, use that. If not, define an explicit URL mapping function so `index.mdx` resolves to `/` and nested docs resolve to `/<section>/<slug>`.
- The Next catch-all route should use Fumadocs `source.generateParams()` for static path generation, and `source.getPage(slug)` for page lookup.
- Export `dynamicParams = false` from the catch-all route unless the implementation proves it is unnecessary for static export.
- Configure `generateMetadata` from page data so frontmatter titles/descriptions populate page metadata.
- In `source.getPage(slug)`, treat missing `slug` as `[]` so the overview page resolves consistently.
- Ensure the static export includes a 404/not-found behavior acceptable for GitHub Pages. If the Fumadocs route uses `notFound()`, verify the exported output still behaves correctly under Pages.

### Navigation

Use these public sections:

- Start: overview, sending events, identifying users, React usage.
- Operate: architecture, ClickHouse schema, deployment, Railway, Helm, verification.
- Reference: OpenAPI API reference, downloadable OpenAPI spec, generated SDK reference, generated React reference.
- Project: publishing packages, coding agent skill, SDK stability review.

Keep `publishing`, `agent-skill`, and `sdk-stability` public under `Project`.

### OpenAPI Reference

- Add a committed manual OpenAPI spec at `openapi/clickhouse-product-analytics.openapi.yaml`.
- The OpenAPI spec is the source of truth for the formal API reference.
- Publish the same spec as a static downloadable artifact in the built docs site, preferably `/openapi.yaml`.
- Use Fumadocs OpenAPI virtual pages at build time rather than committing generated MDX endpoint files.
- Do not preserve the old handwritten `docs/reference/http-api.md` as a standalone reference page.
- Move tutorial/context material from the old HTTP API reference into curated guide content where appropriate.
- The formal reference must come from the OpenAPI-powered section.
- The OpenAPI-powered route should be explicitly wired into the Fumadocs source using the documented OpenAPI integration, not represented by committed generated endpoint MDX files.
- The implementation should keep the OpenAPI object/spec loading centralized, for example in `apps/docs/lib/openapi.ts`, so the API pages and `/openapi.yaml` copy step cannot silently diverge.
- If the Fumadocs OpenAPI integration requires generated virtual source entries, keep those entries deterministic and derived from `openapi/clickhouse-product-analytics.openapi.yaml`.
- If `fumadocs-openapi` does not cleanly support the approved single `/reference/api` landing plus endpoint children in static export, prefer `/reference/api` as the API reference landing and place operation pages underneath `/reference/api/<operation-or-path-slug>`.
- Let Fumadocs/OpenAPI generate endpoint child slugs where possible. Do not hand-design every operation route as long as `/reference/api` remains the stable API reference landing page.
- `/reference/openapi` should be a curated page that links to or embeds download instructions for `/openapi.yaml`; it should not duplicate the full API reference.
- Configure the OpenAPI server instance with `createOpenAPI` from `fumadocs-openapi/server` and the committed YAML spec as input.
- Create `apps/docs/lib/openapi.ts` with the OpenAPI loader/server setup. The input should point to `../../openapi/clickhouse-product-analytics.openapi.yaml` from the docs app, or the equivalent resolved absolute path.
- Configure virtual OpenAPI pages with `openapiSource()` and `openapiPlugin()` in `apps/docs/lib/source.ts`, following the documented multi-source loader pattern.
- Add an `APIPage` component using `createAPIPage` from `fumadocs-openapi/ui`.
- The page renderer must branch on OpenAPI pages. If `page.type === 'openapi'`, render a full-width Fumadocs `DocsPage` with `APIPage {...page.data.getAPIPageProps()}`. Normal MDX pages should continue through the standard Fumadocs MDX render path.
- After adding virtual OpenAPI pages, run a TypeScript check for the docs app because the page type union changes.
- Add `openapi-types` and `json-schema-typed` as docs-app dev dependencies if API page customization or strict OpenAPI typing needs them.
- Do not configure `openapi.createProxy()` or any request-dependent proxy route for GitHub Pages static export. If the OpenAPI playground UI is retained, it must call the configured API origin directly and work without a Next server.
- Disable the interactive OpenAPI playground/try-it UI for v1. The API reference should be read-only until there is an explicit stable public API origin and a safe static-site playground design.

The OpenAPI spec must mirror the implemented API exactly:

- include all route aliases;
- represent single event object, batch object, and raw event array request bodies;
- include permissive parsing behavior and passthrough properties;
- describe `event` and `distinct_id` as required for successful ingestion, but do not mark them as hard schema-required if the service accepts and drops events without them;
- include `api_key` and `token` authentication alternatives;
- include accepted content types, form-encoded base64 payload support, compression headers, and `compression=gzip-js`;
- include CORS/origin behavior;
- include success, dropped-event, and documented error status semantics;
- avoid making the spec stricter or cleaner than the service unless the service implementation changes in the same PR.

The repo-level `AGENTS.md` already states that API implementation changes must update the OpenAPI spec and Fumadocs reference in the same change. Preserve that rule.

### SDK And React Reference

- Keep TypeDoc as the SDK/React reference generator for this migration.
- Do not switch to a different API-docs generator in this PR.
- Move TypeDoc output from `docs/reference/sdk` to `content/docs/reference/sdk-generated`.
- Keep generated TypeDoc output committed and checked by CI.
- Add curated reference landing pages:
  - `/reference/sdk`
  - `/reference/react`
- Link from those curated landing pages into the generated TypeDoc subtree.
- Do not try to make every generated TypeDoc page feel hand-designed in this migration.
- Verify that generated Markdown can be consumed by the chosen Fumadocs MDX/source pipeline. If raw TypeDoc Markdown lacks frontmatter or metadata needed by Fumadocs, add the smallest deterministic post-generation normalization step rather than manually editing generated files.
- The generated subtree must be clearly labeled as generated in nav metadata or landing-page copy.
- If TypeDoc emits package names or paths that do not map cleanly to `/reference/sdk/generated` and `/reference/react/generated`, keep the raw generated routes under `/reference/generated/...` and link to them from curated SDK/React landing pages. Do not block the migration on perfect generated reference route aesthetics.
- If generated TypeDoc Markdown cannot pass Fumadocs validation without frontmatter, add a script that post-processes generated files immediately after TypeDoc. The script should be deterministic, committed, and covered by the generated-docs diff check.
- Prefer TypeDoc Markdown plugin output settings that fit Fumadocs, such as `fileExtension: ".mdx"` and `entryFileName: "index"`, if they are supported by the installed plugin version. If keeping TypeDoc defaults such as `.md` and `README.md`, document why and add tests that prove the generated routes are correct.
- Try TypeDoc plugin output options first. Add deterministic post-processing only if those options cannot produce valid Fumadocs-readable generated docs.
- Add `.meta.json` files or deterministic generated metadata for the generated reference subtree where Fumadocs needs page-tree ordering. Do not assume TypeDoc's own navigation output becomes Fumadocs navigation automatically.

### Search

- Include search in v1.
- Implement static/local search for the GitHub Pages static export.
- Do not add hosted search or third-party search infrastructure in this PR.
- Use the documented Fumadocs Orama/static search setup and generate the search index as part of `docs:build`.
- Confirm search works under GitHub Pages `basePath` and PR preview prefixes before enabling it.
- Do not use the default server-backed search route in a static export unless it is configured for static mode. Fumadocs documents that static sites should statically store search indexes and compute search in the browser.
- Search must run fully client-side against statically generated indexes. Do not introduce a server route or hosted search service.
- Search should cover curated docs, OpenAPI reference pages where practical, and generated SDK/React reference pages where practical. If generated reference indexing creates excessive noise, keep generated reference pages searchable by title/heading at minimum and document any limitation in the PR.

### Workflow Triggering

Update the Pages workflow docs-change matcher to include the new docs surface:

- `apps/docs/**`
- `content/docs/**`
- `openapi/**`
- `typedoc.json`
- `package.json`
- `package-lock.json`
- `.github/workflows/pages.yml`
- `README.md` only if it still contains docs deployment instructions after the migration

Do not trigger the Pages workflow for every package source change. API changes must update `openapi/**`; SDK/React reference changes must update generated reference output.

### Documentation Updates

Update all Jekyll-era docs references:

- `README.md`
- `docs/verification.md` content after it moves to MDX
- `scripts/e2e.mjs`
- `.github/workflows/ci.yml`
- `.github/workflows/pages.yml`
- references to `docs/_config.yml`
- references to `actions/jekyll-build-pages`
- references to `docs/reference/sdk`
- references to the old handwritten HTTP API reference page

Delete `docs/_config.yml` when it is no longer used.

## Implementation Plan

1. Add `apps/docs` as a Fumadocs/Next app.
2. Add root scripts for docs development, docs build, and reference generation.
3. Configure static export and GitHub Pages base path handling for production and PR previews.
4. Move curated docs into `content/docs` and convert them to MDX.
5. Create Fumadocs navigation metadata for Start, Operate, Reference, and Project.
6. Add `openapi/clickhouse-product-analytics.openapi.yaml`.
7. Wire `fumadocs-openapi` virtual pages into the docs source.
8. Copy/publish the OpenAPI spec as `/openapi.yaml` in the static output.
9. Update TypeDoc to emit generated SDK/React docs into `content/docs/reference/sdk-generated`.
10. Add curated SDK and React reference landing pages.
11. Rewrite `.github/workflows/pages.yml` from Jekyll build steps to Fumadocs static export steps while preserving preview deployment and cleanup semantics.
12. Update `.github/workflows/ci.yml` generated-docs checks for the new TypeDoc output path.
13. Update `scripts/e2e.mjs` docs assertions for the new file structure, OpenAPI spec, Fumadocs app, and Pages workflow.
14. Update README and docs content to describe the new docs system.
15. Remove obsolete Jekyll config and stale links.

## Acceptance Criteria

- `apps/docs` builds a static Fumadocs site.
- Curated docs render from `content/docs` as MDX.
- The docs overview is useful as a docs entry point and is not a marketing landing page.
- The public IA matches the approved route map.
- The API reference is rendered from the committed OpenAPI spec through Fumadocs virtual OpenAPI pages.
- `/openapi.yaml` is present in the static output and matches the committed spec.
- TypeDoc-generated SDK/React reference output is committed under `content/docs/reference/sdk-generated`.
- Curated SDK and React reference landing pages exist.
- Root product build and verification remain separate from docs build.
- GitHub Pages production deploy still publishes from `main`.
- PR previews still deploy under `pr-preview/pr-<number>/`, post/update comments, and clean up with the existing semantics.
- CI checks generated TypeDoc output at the new path.
- E2E assertions no longer depend on Jekyll and verify the new docs wiring.

## Suggested Tests

Run the implementation through these checks before opening the PR:

```bash
npm install
npm run docs:reference
git diff --exit-code content/docs/reference/sdk-generated
npm run docs:typecheck
npm run docs:build
npm run docs:validate
npm run verify
npm run verify:e2e
```

If `docs:validate` is not implemented because the chosen Fumadocs/link-check setup is not stable enough, document that in the PR and keep `docs:typecheck` plus `docs:build` as required gates.

`docs:typecheck` and `docs:build` are required. Link validation is desirable, but it should not block the migration if it proves unstable with Fumadocs virtual OpenAPI pages or generated TypeDoc output.

Add a local static-site smoke check after `docs:build`:

- serve the exported docs output locally;
- verify the overview page loads;
- verify `/start/sending-events`, `/start/react`, `/operate/deployment`, `/reference/api`, `/reference/sdk`, `/reference/react`, and `/project/sdk-stability`;
- verify static assets load correctly under the normal GitHub Pages base path;
- verify static assets load correctly under a simulated preview prefix such as `/clickhouse-product-analytics/pr-preview/pr-123/`;
- verify `/openapi.yaml` downloads and matches `openapi/clickhouse-product-analytics.openapi.yaml`;
- verify an OpenAPI endpoint page renders from the virtual source;
- verify generated TypeDoc pages are reachable from the SDK and React landing pages.

Add or update automated checks where practical:

- E2E assertion that `.github/workflows/pages.yml` no longer uses `actions/jekyll-build-pages`.
- E2E assertion that `.github/workflows/pages.yml` does not rewrite built Next assets with `sed` for previews.
- E2E assertion that the workflow still contains preview deployment, preview comment, and cleanup behavior.
- E2E assertion that docs-change detection includes `apps/docs/**`, `content/docs/**`, and `openapi/**`.
- E2E assertion that production and preview docs builds pass distinct build-time base paths into the docs app.
- E2E assertion that `typedoc.json` emits into `content/docs/reference/sdk-generated`.
- E2E assertion that the committed OpenAPI spec includes every implemented public route alias.
- API parity assertion that the OpenAPI spec documents accepted JSON, `text/plain` JSON, `application/x-www-form-urlencoded` base64 `data`, `content-encoding: gzip`, `content-encoding: deflate`, `content-encoding: br`, and `compression=gzip-js`.
- API parity assertion that a batch with one valid event and one missing `distinct_id` returns `200`, ingests the valid event, and reports `dropped: 1`.
- API parity assertion that single event, batch object, raw array, top-level key, per-event key, `token`, and mixed-key `400` behavior are represented in tests and docs.
- API parity assertion that malformed JSON, invalid base64, invalid timestamp, too many events, and inflated body over `MAX_BATCH_BYTES` return documented status codes and `{ status: "error", error }`.
- E2E assertion that `AGENTS.md` keeps the API/spec sync rule.

Optional browser QA:

- run the docs dev server;
- inspect desktop and mobile layouts;
- check sidebar navigation, code blocks, API reference rendering, and generated TypeDoc pages;
- confirm there are no broken internal links in the approved route map.
