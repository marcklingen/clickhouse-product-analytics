# Repository Instructions

- Use subagents aggressively to offload tasks and research.
- When changing the public ingest HTTP API, update the committed OpenAPI spec, if present, and the Fumadocs API reference in the same change. The current committed API reference is `docs/reference/http-api.md`. This includes route aliases, request payloads, response payloads, authentication, accepted encodings, compression behavior, CORS/origin behavior, and documented error semantics.
- The OpenAPI/API reference must mirror the implemented API behavior exactly, including permissive request parsing, dropped-event semantics, route aliases, optional fields that are required only for successful ingestion, passthrough properties, accepted content types, compression options, and concrete error status behavior. Do not make the spec stricter or cleaner than the service actually is unless the service implementation changes in the same patch.

## Core Design Decisions

- The public ingest API has one canonical event endpoint: `POST /batch/`. Do not reintroduce public ingest aliases such as `/batch`, `/capture/`, `/capture`, `/i/v0/e/`, `/i/v0/e`, `/e/`, or `/e`.
- The ingest request body is JSON only: an object with a non-empty `batch` array. Single-event ingestion is a one-item batch. Do not reintroduce standalone single-event bodies or raw array bodies.
- Event `event` and `distinct_id` are required for successful ingestion of that event, but missing values drop the individual event and increment `dropped`; they do not fail the whole batch. Do not document them as hard request-level validation unless the implementation changes.
- Payload parsing is intentionally permissive around unknown top-level and event-level fields. Unknown fields are accepted but ignored unless they are inside `properties`; document this behavior instead of making the API reference stricter.
- If `api_key` appears in more than one place, all provided values must match. Mixed batch-level and event-level keys return `400`.
- HTTP wire payload fields stay snake_case because they are JSON/warehouse-facing. Keep `api_key` and `distinct_id` on the wire payload.
- SDK public configuration is TypeScript-facing and must stay camelCase. Keep options such as `apiHost`, `apiKey`, `capturePageview`, `capturePageleave`, `disablePersistence`, `requestBatching`, `flushIntervalMs`, `beforeSend`, and `propertyDenylist`.
- Do not reintroduce snake_case SDK config aliases or compatibility placeholders, including `api_host`, `capture_pageview`, `capture_pageleave`, `request_queue_config`, `disable_compression`, `loaded`, `debug`, or `defaults`.
- Do not expose `batchEndpoint` as SDK configuration. The SDK always posts to `/batch/`.
- Request compression is gzip only via `Content-Encoding: gzip`. Do not reintroduce `text/plain`, `application/x-www-form-urlencoded`, base64 `data`, `Content-Encoding: deflate`, `Content-Encoding: br`, or `compression=gzip-js`.
- Preserve the current API-key semantics: browser requests from allowed origins can omit `api_key`; backend/no-Origin requests require a configured `api_key`; `PUBLIC_API_KEYS` may contain comma-separated keys for rotation; API keys are not tenant, project, or person-resolution boundaries.
- Preserve the explicitly supported tracking features: autocapture, `AnalyticsCaptureOnViewed`, identity helpers, persistence modes, `beforeSend`, and `propertyDenylist`.
- When changing exported SDK/React types or public examples, regenerate `docs/reference/sdk` with `npm run docs:reference` and update docs, examples, benchmarks, and E2E assertions in the same change.
- Treat older compatibility notes in `plans/fumadocs-migration-prd.md` as superseded by `plans/simplification.md` and current source when they mention removed aliases, form/base64 payloads, `text/plain`, `deflate`, `br`, `compression=gzip-js`, or `token`.
