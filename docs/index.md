---
title: ClickHouse Product Analytics
description: First-party product analytics ingress for ClickHouse.
---

# ClickHouse Product Analytics

ClickHouse Product Analytics is a first-party product analytics ingress layer for ClickHouse. It captures browser and backend product events, validates and normalizes them through one HTTP service, and writes query-ready events, people, identity links, and sessions into ClickHouse.

The project intentionally owns only the first mile of product analytics: event capture, identity stitching, and warehouse-native storage. It does not include dashboards, funnels, feature flags, session replay, surveys, or a settings UI. Use ClickHouse, SQL, notebooks, BI tools, or agentic analytics on top of the tables.

## Start

- [Sending events](./sending-events.md): browser SDK, React, backend/direct API, batch API, gzip, and event naming examples.
- [Identifying users](./identifying-users.md): anonymous IDs, `identify`, `$set`, `$set_once`, aliases, reset, and query implications.
- [ClickHouse schema](./clickhouse-schema.md): table/view schemas, JSON property access, and query patterns for humans and agents.
- [SDK stability review](./sdk-stability.md): production reliability notes from comparing against mature browser analytics SDK patterns.

## Operate

- [Architecture](./architecture.md): system boundaries, event flow, identity flow, and how the pieces fit together.
- [Deployment](./deployment.md): local Docker Compose, ClickHouse Cloud, production container model, environment variables, and migration workflow.
- [Railway deployment](./railway.md): Railway container setup with ClickHouse or ClickHouse Cloud.
- [Helm deployment](./helm.md): Kubernetes chart, autoscaling defaults, and install examples.
- [Verification](./verification.md): what `npm run verify` and `npm run verify:e2e` prove.

## Reference

- [Reference](./reference/index.md): HTTP API reference and generated SDK/React reference.
- [Publishing packages](./publishing.md): npm package dry-runs, Release It, and explicit publish commands.
- [Coding agent skill](./agent-skill.md): repo-local skill for adding product analytics tracking with a coding agent.

## Quick Start

```bash
cp .env.example .env
npm install
npm run build:packages
docker compose up -d --build
npm run verify:e2e
```

Local endpoints:

- Ingest service: `http://127.0.0.1:8080`
- ClickHouse HTTP API: `http://127.0.0.1:8123`
- Development backend API key: `local_dev_key`

## Minimal Browser Example

```ts
import analytics from '@clickhouse-product-analytics/sdk'

analytics.init({
  apiHost: 'http://127.0.0.1:8080',
  capturePageview: 'history_change',
  autocapture: {
    captureText: true,
    elementAllowlist: ['button', 'a']
  },
  propertyDenylist: ['secret']
})

analytics.capture('signup_started', { plan: 'pro' })
analytics.identify('user_123', { email: 'user@example.com' })
await analytics.flush()
```

## Minimal Backend Example

```bash
curl -X POST http://127.0.0.1:8080/batch/ \
  -H 'content-type: application/json' \
  -d '{
    "api_key": "local_dev_key",
    "batch": [
      {
        "event": "backend_job_completed",
        "distinct_id": "user_123",
        "properties": {
          "job_id": "job_456",
          "duration_ms": 481
        }
      }
    ]
  }'
```

## Scope

This repository contains:

- `packages/sdk`: browser event capture, sessions, batching, pageview/pageleave, autocapture, persistence, opt-in/out, and identity helpers.
- `packages/react`: provider, hook, and viewport tracking component for React and Next.js applications.
- `packages/ingest-service`: Fastify ingest API, origin and API-key validation, decompression, normalization, identity side effects, and ClickHouse writes.
- `packages/ingest-service/migrations`: ClickHouse schema for `events`, `persons`, `person_distinct_ids`, and `sessions`.
- `examples`: a Next.js browser smoke app and a direct backend capture script.
- `docs`: this GitHub Pages documentation site, maintained as Markdown.

## Attribution

This project is independent. The source repository includes `ATTRIBUTION.md` and `THIRD_PARTY_NOTICES.md` with the maintained attribution and license notes.
