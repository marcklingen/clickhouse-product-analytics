---
title: Publishing Packages
description: Dry-run and publish the SDK and React packages to npm.
---

# Publishing Packages

The repository is private at the npm root, but the SDK and React workspaces are publishable public packages:

- `@clickhouse-product-analytics/sdk`
- `@clickhouse-product-analytics/react`

Both packages are ESM-only. A separate bundling step is not required for normal npm usage because modern application bundlers consume the `exports` map and bundle the package into the host application. Add a bundled artifact only if you want direct `<script>` tag or legacy CommonJS support.

## Dry Run

Run the full release dry-run before publishing:

```bash
npm run release:dry-run
```

This command checks package/runtime version alignment, runs typecheck, tests, package builds, generated reference docs, `npm pack --dry-run`, and `npm publish --dry-run` for both public packages.

## Version and Release

Release It is configured for versioning and tagging:

```bash
npm run release -- --dry-run
npm run release
```

Run the release from a clean working tree after the intended files are committed. The release hook updates both package versions, keeps `@clickhouse-product-analytics/react` aligned with the same SDK dependency version, and updates the SDK runtime version exported from `packages/sdk/src/version.ts`.

The Release It config creates the local commit and tag but keeps `git push` and npm publishing disabled. Review the version bump, then push the release commit and tag explicitly:

```bash
git push origin main
git push origin v<version>
```

After the pushed commit and tag are visible, publish explicitly:

```bash
npm publish --workspace @clickhouse-product-analytics/sdk --access public
npm publish --workspace @clickhouse-product-analytics/react --access public
```

Use a prerelease version and npm dist tag for unstable releases:

```bash
npm publish --workspace @clickhouse-product-analytics/sdk --access public --tag next
npm publish --workspace @clickhouse-product-analytics/react --access public --tag next
```

## Registry Prerequisites

Before the first publish, verify that the npm account can publish the `@clickhouse-product-analytics` scope or rename the packages to a scope you control:

```bash
npm whoami
npm access ls-packages @clickhouse-product-analytics
```

If the npm account requires two-factor authentication for publishing, add `--otp <code>` to each `npm publish` command. If you publish from GitHub Actions later, decide whether to require npm provenance and use an npm token/OIDC setup that matches that policy; local CLI publishes do not attach GitHub provenance.

## Package Contents

Each public package includes:

- `dist`: compiled ESM JavaScript, declarations, and source maps.
- `src`: TypeScript source for source-map debugging.
- `README.md`
- `LICENSE`
- `THIRD_PARTY_NOTICES.md`
- `package.json`

The ingest service package is marked private because it is deployed as a container rather than published as an npm library.
