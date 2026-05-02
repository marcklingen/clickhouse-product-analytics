---
title: Deployment
description: Local and production deployment model.
---

# Deployment

The runtime stack is intentionally simple: one stateless ingest service and one ClickHouse database. The browser SDK and React package are built into your application bundle; backend services call the ingest API directly.

For platform-specific deployment examples, see [Railway deployment](./railway.md) and [Helm deployment](./helm.md).

## Local Development

```bash
cp .env.example .env
npm install
npm run build:packages
docker compose up -d --build
```

The Compose stack starts:

- ClickHouse on `http://127.0.0.1:8123`
- ingest service on `http://127.0.0.1:8080`

`docker-compose.yml` pins ClickHouse to `clickhouse/clickhouse-server:26.3.9.8-alpine`, the current 26.3 stable release on the Alpine image track when this project was last verified. Keep this as a concrete version tag instead of `latest` so local development and E2E runs do not drift silently. Older LTS branches can receive newer patch dates, but this repo intentionally tracks the latest stable feature branch for local verification. If you need registry-level reproducibility, pin the image by digest in your deployment manifests.

Run the end-to-end verifier after the stack is healthy:

```bash
npm run verify:e2e
```

Stop the local stack when finished:

```bash
docker compose down
```

## Production Shape

Run the ingest service as a container close to ClickHouse. Put it behind a TLS-terminating reverse proxy or load balancer. Browser applications talk to the public HTTPS ingest URL. Backend services can use the same public URL or a private network URL.

Recommended production model:

- one or more ingest service containers,
- shared ClickHouse database on a supported stable or LTS ClickHouse release,
- stable `PUBLIC_API_KEYS`,
- explicit `ALLOWED_ORIGINS`,
- `LOG_LEVEL=warn` or stricter for high-volume traffic,
- migrations run manually before deploy,
- `MIGRATE_ON_START=false` or omitted in production.

The ingest service does not require Redis, Postgres, Kafka, object storage, or a background worker.

## Container Image

`.github/workflows/container.yml` builds `packages/ingest-service/Dockerfile` and publishes the image after CI succeeds for pushes to `main`. The image build uses a pinned Node base-image digest and lockfile-strict `npm ci` installs:

```text
ghcr.io/<owner>/<repo>/ingest-service:sha-<commit>
ghcr.io/<owner>/<repo>/ingest-service:latest
```

Use the `sha-<commit>` tag for production rollouts, or the image digest reported by GHCR after the publish job completes. The mutable `latest` tag is useful for quick trials but should not be the rollout target for a stable environment. For the strictest rollout, deploy `ghcr.io/<owner>/<repo>/ingest-service@sha256:<digest>`.

The container publishing workflow runs after the `CI` workflow succeeds on `main`, so the image is gated by package verification, Docker Compose validation, Helm render/lint checks, and Docker-backed E2E tests.

## ClickHouse Cloud

ClickHouse Cloud works with the same ingest service configuration. The service uses the official `@clickhouse/client` package and passes `CLICKHOUSE_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`, and `CLICKHOUSE_DATABASE` directly to the client. No code change is required for a Cloud service as long as the URL is the HTTPS endpoint for the ClickHouse HTTP interface.

Use the connection details from the ClickHouse Cloud service connection menu. For the Node.js or HTTPS connection form, the URL usually has this shape:

```bash
CLICKHOUSE_URL=https://<service-host>:8443
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=<clickhouse-cloud-password>
CLICKHOUSE_DATABASE=product_analytics
```

Then configure the ingest service the same way you would for a self-hosted production deployment:

```bash
PUBLIC_API_KEYS=<publishable-ingest-key>
ALLOWED_ORIGINS=https://app.example.com
ALLOW_SERVER_EVENTS_WITHOUT_ORIGIN=true
MIGRATE_ON_START=false
```

Run migrations from a trusted environment that can reach the ClickHouse Cloud service:

```bash
npm run build --workspace @clickhouse-product-analytics/ingest-service
CLICKHOUSE_URL=https://<service-host>:8443 \
CLICKHOUSE_USER=default \
CLICKHOUSE_PASSWORD=<clickhouse-cloud-password> \
CLICKHOUSE_DATABASE=product_analytics \
npm run migrate
```

The browser SDK and React package do not connect to ClickHouse Cloud directly. They should continue to send events to the ingest service `api_host`; the ingest service is the only component that needs ClickHouse Cloud credentials.

## Environment Variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | no | `8080` | HTTP listen port. |
| `PUBLIC_API_KEYS` | yes | none | Comma-separated publishable API keys accepted by the service. These are dataset credentials, not tenant IDs. |
| `ALLOWED_ORIGINS` | recommended | empty | Comma-separated browser origins accepted by CORS and source validation. |
| `ALLOWED_HOSTS` | no | empty | Optional explicit host allowlist. Use only when host-level matching across schemes is intentional. |
| `ALLOW_SERVER_EVENTS_WITHOUT_ORIGIN` | no | `true` | Allows backend requests without an `Origin` header. |
| `MAX_BATCH_BYTES` | no | `20971520` | Maximum request body size after decompression. |
| `MAX_EVENTS_PER_BATCH` | no | `10000` | Maximum number of events in a batch request. |
| `CLICKHOUSE_URL` | no | `http://localhost:8123` | ClickHouse HTTP endpoint. Use `https://<service-host>:8443` for ClickHouse Cloud. |
| `CLICKHOUSE_USER` | no | `default` | ClickHouse username. |
| `CLICKHOUSE_PASSWORD` | no | empty | ClickHouse password. |
| `CLICKHOUSE_DATABASE` | no | `product_analytics` | Database used for migrations and queries. |
| `MIGRATE_ON_START` | no | false | Apply migrations when the ingest service starts. Use for local development, not production. |

## Migrations

The migration runner applies SQL files from `packages/ingest-service/migrations` and records applied filenames in `schema_migrations`. The first migration creates:

- `events`
- `persons`
- `person_distinct_ids`
- `sessions`

Run migrations manually in production:

```bash
CLICKHOUSE_URL=https://<service-host>:8443 \
CLICKHOUSE_USER=<user> \
CLICKHOUSE_PASSWORD=<password> \
CLICKHOUSE_DATABASE=product_analytics \
npm run migrate
```

Inside the published container image, run the compiled migration entrypoint from the ingest service workdir:

```bash
CLICKHOUSE_URL=https://<service-host>:8443 \
CLICKHOUSE_USER=<user> \
CLICKHOUSE_PASSWORD=<password> \
CLICKHOUSE_DATABASE=product_analytics \
node dist/migrate.js
```

The runner substitutes `{{DATABASE}}` with `CLICKHOUSE_DATABASE`. The database name must be a valid ClickHouse identifier.

## CORS and Source Validation

Browser traffic must come from an allowed origin. Configure `ALLOWED_ORIGINS` with the exact scheme, host, and port used by your app, for example:

```bash
ALLOWED_ORIGINS=https://app.example.com,https://www.example.com
```

Backend requests often omit `Origin`. Keep `ALLOW_SERVER_EVENTS_WITHOUT_ORIGIN=true` when server-side services need to send events directly.

## Scaling

The ingest service has no local runtime state and can be scaled horizontally for event capture. All instances must share:

- the same ClickHouse database,
- the same accepted API keys,
- the same origin policy,
- the same request limits.

ClickHouse write capacity is the primary scaling boundary. Keep batch sizes moderate and prefer SDK batching over one request per event for high-volume browser apps.

Identity side effects (`$identify`, `$set`, `$set_once`, and `$create_alias`) are stored in ClickHouse versioned rows. That model works well for normal SDK traffic, but strict first-write-wins `$set_once` semantics can race if many replicas process identity updates for the same distinct ID at exactly the same time. For identity-heavy production workloads, either keep identity traffic on one ingest replica or route identity requests consistently until the deployment has been load-tested with your concurrency profile.

## ClickHouse Version Upgrades

For local development, update the Compose image only after checking the current stable ClickHouse server tag and running the full verifier. For production, upgrade ClickHouse separately from the ingest service, run migrations against a staging database first, and verify the starter queries in `clickhouse-schema.md` before promoting the version.

## GitHub Pages Docs

The docs are plain Markdown in `docs/`. GitHub Pages builds them with Jekyll using `docs/_config.yml` and `.github/workflows/pages.yml`.

In the repository settings, configure:

- **Pages > Build and deployment > Source**: GitHub Actions.

Pushes to `main` that change `docs/**` or the Pages workflow rebuild and deploy the docs site.
