# Simplify Public Interface While Keeping Tracking Features

## Summary

Simplify the repo’s public interface around one canonical ingest API, one
payload shape, gzip-only compression, and camelCase SDK configuration. Keep
the feature areas the user explicitly wants: auto-tracking, React viewed
tracking, identity helper methods, all persistence options, beforeSend/
property denylist-style hooks, and the current API-key semantics for
backend/no-Origin events.

## Key Interface Changes

- Expose one ingest endpoint: POST /batch/.
- Remove public aliases: /batch, /capture/, /capture, /i/v0/e/, /i/v0/e, /
  e/, /e.
- Accept one JSON payload shape:

  {
  "api_key": "optional",
  "batch": [{ "event": "...", "distinct_id": "...", "properties": {} }]
  }

- Support single-event ingestion as a one-item batch; remove standalone
  single-event bodies and raw array bodies.
- Keep request compression, but only via Content-Encoding: gzip.
- Remove text/plain, application/x-www-form-urlencoded, base64 data,
  deflate, br, and compression=gzip-js.
- Keep API key behavior as already decided:
  - optional for allowed browser origins,
  - required for backend/no-Origin events,
  - comma-separated backend keys allowed,
  - not used for tenant/person resolution.

## SDK And Docs Changes

- Make camelCase the SDK public configuration style.
- Remove snake_case SDK config aliases and compatibility placeholders,
  including api_host, capture_pageview, capture_pageleave,
  request_queue_config, disable_compression, loaded, debug, and defaults.
- Keep feature options under camelCase names:
  - apiHost, apiKey, capturePageview, capturePageleave, persistence,
    disablePersistence, requestBatching, flushIntervalMs, beforeSend,
    propertyDenylist.
- Keep api_key only on the HTTP wire payload, because the ingest API is
  JSON/warehouse-facing while the SDK config is TypeScript-facing.
- Remove batchEndpoint from the public SDK config; the SDK always posts
  to /batch/.
- Update docs, examples, generated reference docs, benchmarks, and E2E
  assertions to use /batch/, camelCase SDK config, JSON batch payloads, and
  gzip-only compression.
- Keep auto-tracking, AnalyticsCaptureOnViewed, identity helpers,
  persistence options, beforeSend, and propertyDenylist documented as
  supported.

## Implementation Notes

- In the ingest service, register only app.post('/batch/', ingest).
- Simplify parsePayload to reject anything except an object with a non-
  empty batch array.
- Keep mixed api_key validation if both batch-level and event-level keys
  remain accepted; prefer documenting batch-level api_key as the normal
  shape.
- Remove unused parser/decompression branches and their tests.
- Preserve existing request limits, origin validation, API-key validation,
  identity side effects, queueing, auto-tracking, and persistence behavior.
- Regenerate SDK docs after type changes.

## Test Plan

- Unit tests:
  - POST /batch/ accepts browser-origin payload without api_key.
  - POST /batch/ accepts no-Origin payload with valid api_key.
  - POST /batch/ rejects no-Origin payload without valid api_key.
    return 400 or unsupported media errors.
  - gzip-compressed JSON batch succeeds.
  - deflate, br, and compression=gzip-js no longer succeed.
- SDK tests:
  - snake_case config fields fail TypeScript or are ignored only if tests
    intentionally cover runtime tolerance removal.
  - gzip compression still works when browser CompressionStream exists.
  - beforeSend, propertyDenylist, auto-tracking, identity helpers, and
    persistence modes still work.
- Verification:
  - Run npm run verify.
  - Run or update E2E if available, especially docs assertions and direct
    API ingestion checks.

## Assumptions

- This is still pre-release enough to remove compatibility routes and
  payload formats immediately without a deprecation window.
- Canonical endpoint is /batch/.
- Compression means gzip only.
- SDK public configuration should be camelCase, while HTTP payload fields
  can remain snake_case.
- Existing explicit feature decisions stay in scope: auto-tracking, React
  viewed tracking, identity helpers, persistence modes, beforeSend, and
  property denylist remain supported.
