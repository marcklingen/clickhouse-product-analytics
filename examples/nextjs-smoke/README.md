# Next.js Smoke Example

This private workspace verifies the React provider, `useAnalytics()` hook, and browser SDK behavior in a minimal Next.js app.

## Run

From the repo root:

```bash
npm run build:packages
npm run dev:next
```

Start the ingest stack separately when you want events to be accepted:

```bash
docker compose up -d --build
```

The E2E verifier builds this example automatically, but it still expects the ingest service and ClickHouse to be running:

```bash
npm run build:packages
docker compose up -d --build
npm run verify:e2e
```

For non-default stacks, set `CPA_SERVICE_URL`, `CLICKHOUSE_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`, and `CLICKHOUSE_DATABASE` before running the verifier. Set `CPA_API_KEY` when exercising no-origin direct API requests or intentionally testing provided-key validation.
