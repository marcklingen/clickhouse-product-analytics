---
title: SDK Stability Review
description: Production reliability notes from comparing the SDK with mature browser analytics SDK patterns.
---

# SDK Stability Review

The browser SDK is intentionally small. This review focuses on performance and stability patterns from mature browser analytics SDKs, not feature parity.

## What Was Reviewed

- Mature open-source browser analytics SDK repository structure and package surfaces.
- Retry queue declarations and release notes around retry queue fixes in established analytics SDKs.
- Long-standing unload reliability discussions around `sendBeacon`.
- This repo's SDK queue, transport, storage, autocapture, React wrapper, and E2E coverage.

## Improvements Applied

- Fetch requests now honor SDK compression settings with browser `CompressionStream` when available, and fall back to plain JSON if compression is unavailable or fails.
- SendBeacon unload flushes remain uncompressed because browsers do not let callers attach arbitrary `content-encoding` headers to beacon bodies.
- The E2E test now exercises SDK compression in addition to direct API gzip requests.
- Event properties are sanitized before enqueueing so circular objects and `bigint` values do not crash capture or flush.
- Permanent HTTP errors such as `401` are no longer retried, while `413` responses split a batch before retrying smaller chunks.
- Concurrent flush calls are serialized, and unload flushes include queued retry batches.
- The ingest service no longer logs every successful request by default, which matters for high-throughput browser batch ingestion.

## Stability Gaps To Watch

| Area | Current state | Recommendation |
| --- | --- | --- |
| Durable retry queue | Retries live in memory and are flushed on unload but are not persisted across reloads. | Keep this for now because the repo scope is small. Add persistent retry storage only if customer apps show loss during flaky network or reload-heavy flows. |
| Byte-aware batch splitting | The SDK limits queue count and server body size, but it does not split batches by encoded byte size before sending. | Add byte-size splitting before supporting very large property payloads or high `flushAt` values. |
| Navigation-critical events | Pageleave uses best-effort `sendBeacon`, then fetch fallback if beacon rejects. | For form submissions or payment handoffs, call `flush()` before navigating when the event is business-critical. |
| Cross-tab coordination | Each tab has its own in-memory queue and shared persisted identity state. | Keep as-is until duplicate or ordering issues appear; cross-tab queue ownership adds complexity. |
| Autocapture privacy | The SDK denies obvious sensitive inputs and values, but autocapture remains opt-in. | Keep autocapture disabled by default and document explicit allowlists. |
| Custom transport behavior | Custom transports receive payload and compression intent, but own all request semantics. | Document custom transport tests in downstream apps that override delivery. |

## Decision

No major rewrite is needed before publishing. The highest-risk issues found in this pass were the exposed compression option not being honored, unsafe property serialization, and retry behavior that treated permanent HTTP errors like transient failures. Those have been fixed and covered. The remaining gaps are tradeoffs rather than correctness bugs for this repo's current scope.
