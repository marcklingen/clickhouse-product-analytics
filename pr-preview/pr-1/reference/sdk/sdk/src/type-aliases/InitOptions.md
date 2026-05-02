[**SDK and React Reference**](../../../README.md)

***

[SDK and React Reference](../../../README.md) / [sdk/src](../README.md) / InitOptions

# Type Alias: InitOptions

> **InitOptions** = `AnalyticsClientConfig` & `object`

Defined in: [sdk/src/types.ts:105](https://github.com/marcklingen/clickhouse-product-analytics/blob/main/packages/sdk/src/types.ts#L105)

Complete initialization options, including camelCase aliases and advanced controls.

## Type Declaration

### apiHost?

> `optional` **apiHost?**: `string`

CamelCase alias of `api_host`.

### apiKey?

> `optional` **apiKey?**: `string`

Optional client-supplied API key. Required for no-origin backend calls; optional for allowed-origin browser calls.

### batchEndpoint?

> `optional` **batchEndpoint?**: `string`

Path appended to `apiHost` for batch ingestion. Defaults to `/batch/`.

### capturePageleave?

> `optional` **capturePageleave?**: `boolean` \| `"if_capture_pageview"`

CamelCase alias of `capture_pageleave`.

### capturePageview?

> `optional` **capturePageview?**: `boolean` \| `"history_change"`

CamelCase alias of `capture_pageview`.

### flushAt?

> `optional` **flushAt?**: `number`

Number of queued events that triggers an immediate flush.

### flushIntervalMs?

> `optional` **flushIntervalMs?**: `number`

Flush interval in milliseconds.

### maxQueueSize?

> `optional` **maxQueueSize?**: `number`

Maximum queued event count before oldest events are dropped.

### requestTimeoutMs?

> `optional` **requestTimeoutMs?**: `number`

Request timeout in milliseconds.

### sessionTimeoutMs?

> `optional` **sessionTimeoutMs?**: `number`

Inactivity window after which the next event starts a new session.

### transport?

> `optional` **transport?**: [`Transport`](Transport.md)

Custom delivery implementation.
