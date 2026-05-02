# ClickHouse Product Analytics SDK

Browser SDK for ClickHouse Product Analytics. It captures pageviews, custom events, identity calls, sessions, optional autocapture, and batched delivery to the ingest service.

## Install

```bash
npm install @clickhouse-product-analytics/sdk
```

## Use

```ts
import analytics from '@clickhouse-product-analytics/sdk'

analytics.init({
  apiHost: 'https://analytics.example.com',
  capturePageview: 'history_change'
})

analytics.capture('signup_started', { plan: 'pro' })
analytics.identify('user_123', { email: 'user@example.com' })
await analytics.flush()
```

## Package Format

This package is ESM-only. The TypeScript build emits standards-based JavaScript modules and declaration files into `dist/`.

A separate bundling step is not required for normal npm usage. Modern application bundlers can consume the package through the `exports` map and bundle it into the host application. Add a separate bundled artifact only if you want to support direct `<script>` tag usage, a CDN-ready single file, or legacy CommonJS consumers.

Published package contents are limited to:

- `dist`: compiled ESM JavaScript, declarations, and source maps,
- `src`: TypeScript source for source-map debugging,
- `README.md`,
- `LICENSE`,
- `THIRD_PARTY_NOTICES.md`,
- `package.json`.

## Publishing

Use the repository-level release workflow so the SDK and React package versions stay aligned:

```bash
npm run release:dry-run
```

The dry-run also verifies that the runtime SDK version in event metadata matches the package version.

The full publish checklist lives in `docs/publishing.md`.
