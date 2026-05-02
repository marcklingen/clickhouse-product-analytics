# Contributing

This repo is a small monorepo with three maintained packages:

- `packages/sdk`: browser SDK.
- `packages/react`: React provider, hook, and viewport helper.
- `packages/ingest-service`: stateless HTTP ingest service and ClickHouse migrations.

## Setup

```bash
cp .env.example .env
npm install
npm run verify
```

Run the Docker-backed E2E suite with:

```bash
docker compose up -d --build
npm run verify:e2e
docker compose down -v --remove-orphans
```

## Development Rules

- Keep curated docs in `content/docs/` as MDX and the docs app in `apps/docs/`. Run `npm run docs:reference` after changing exported SDK or React APIs.
- Keep the ingest service single-dataset: no tenant ID, no project ID.
- Add unit tests for internal behavior and E2E checks for public workflows documented in `content/docs/`.
- Keep package release guidance centralized in `content/docs/project/publishing.mdx`.
- Do not commit generated build output, local env files, or private notes.

## Deployment Artifacts

Validate deployment changes with:

```bash
docker compose config
helm lint deploy/helm/clickhouse-product-analytics \
  --set ingest.publicApiKeys=local_dev_key \
  --set clickhouse.url=http://clickhouse:8123 \
  --set clickhouse.user=analytics \
  --set clickhouse.password=local_dev_password
```

The GitHub Actions workflows cover CI, GitHub Pages docs, and GHCR image publishing.
