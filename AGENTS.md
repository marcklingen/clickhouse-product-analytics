# Repository Instructions

## Work Style

- Use subagents for parallel repo scans, docs checks, and test-failure diagnosis.
- Keep behavior, tests, examples, OpenAPI, and docs in the same change when touching a public surface.

## Project Map

- `packages/sdk`: browser SDK. Public TypeScript config stays camelCase.
- `packages/react`: React provider, hook, and viewed-tracking component.
- `packages/ingest-service`: Fastify ingest API, auth/origin checks, payload parsing, ClickHouse writes, and migrations.
- `openapi/clickhouse-product-analytics.openapi.yaml`: committed public API spec.
- `content/docs` and `apps/docs`: Fumadocs content, generated API reference, and docs app wiring.
- `examples`: direct API capture and Next.js smoke app.
- `skills/product-analytics-tracking`: repo-local tracking integration skill.

## Commands

- Install: `npm install` with Node `>=22`.
- Full local check: `npm run verify`.
- Focused checks: `npm run test`, `npm run typecheck`, or `npm run build:packages`.
- Docs checks: `npm run docs:build`, `npm run docs:typecheck`, and `npm run docs:validate`.
- Regenerate SDK/React reference docs: `npm run docs:reference`.
- E2E flow: `docker compose up -d --build` then `npm run verify:e2e`.

## Public API Contract

- The only public ingest endpoint is `POST /batch/`; do not add public aliases.
- Ingest bodies are JSON objects with a non-empty `batch` array. Single-event ingestion is a one-item batch.
- Wire payload fields are snake_case. Keep `api_key` and `distinct_id` on HTTP payloads.
- Missing per-event `event` or `distinct_id` drops that event and increments `dropped`; it does not fail the whole batch.
- Unknown top-level and event-level fields are accepted but ignored unless they are inside `properties`.
- Multiple provided `api_key` values must match. Compression is gzip only via `Content-Encoding: gzip`.
- Browser requests from allowed origins may omit `api_key`; backend/no-Origin requests require a configured key.

## SDK Contract

- SDK public configuration is camelCase: `apiHost`, `apiKey`, `capturePageview`, `capturePageleave`, `disablePersistence`, `requestBatching`, `flushIntervalMs`, `beforeSend`, and `propertyDenylist`.
- Do not add snake_case SDK aliases or compatibility placeholders such as `api_host`, `capture_pageview`, `capture_pageleave`, `request_queue_config`, `disable_compression`, `loaded`, `debug`, or `defaults`.
- Do not expose `batchEndpoint`; the SDK always posts to `/batch/`.
- Preserve the supported tracking features: autocapture, `AnalyticsCaptureOnViewed`, identity helpers, persistence modes, `beforeSend`, and `propertyDenylist`.

## Docs Sync Rules

- Public ingest API changes must update `openapi/clickhouse-product-analytics.openapi.yaml` and the Fumadocs API reference under `content/docs/reference` in the same patch.
- OpenAPI and API docs must mirror implemented behavior exactly, including permissive parsing, dropped-event semantics, route availability, request/response payloads, auth, encodings, compression, CORS/origin behavior, and concrete error status behavior.
- Exported SDK/React type or public example changes must regenerate `content/docs/reference/sdk-generated` with `npm run docs:reference` and update docs, examples, benchmarks, and E2E assertions as needed.
