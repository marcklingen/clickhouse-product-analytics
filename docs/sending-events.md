---
title: Sending Events
description: Browser SDK, React, direct API, batch API, and event naming examples.
---

# Sending Events

Events are JSON objects with an event name, a distinct ID, optional timestamp, and properties. Browser apps usually use the SDK or React wrapper. Backend services can send the same event shape directly to the HTTP API.

## Event Naming

Use stable, human-readable event names that describe behavior. Good names are specific enough to query and stable enough to become part of your analytics contract:

- `signup_started`
- `signup_completed`
- `checkout_step_viewed`
- `backend_job_completed`
- `invite_sent`
- `report_exported`

Use properties for context, not for the primary action:

```json
{
  "event": "backend_job_completed",
  "properties": {
    "job_id": "job_456",
    "duration_ms": 481,
    "status": "success"
  }
}
```

## Browser SDK

For exact method and option signatures, see the [generated SDK reference](./reference/sdk/sdk/src/README.md).

```ts
import analytics from '@clickhouse-product-analytics/sdk'

analytics.init({
  api_host: 'http://127.0.0.1:8080',
  capture_pageview: 'history_change',
  autocapture: {
    captureText: true,
    element_allowlist: ['button', 'a']
  },
  property_denylist: ['secret']
})

analytics.capture('signup_started', {
  plan: 'pro',
  source: 'pricing_page'
})

await analytics.flush()
```

Important options:

| Option | Purpose |
| --- | --- |
| `api_host` | Ingest service URL. |
| `capture_pageview` | `true`, `false`, or `"history_change"` for browser apps with client-side routing. |
| `capture_pageleave` | `true`, `false`, or `"if_capture_pageview"`. |
| `autocapture` | Disabled by default. Pass an object to capture safe click/change/submit events. |
| `persistence` | `localStorage+cookie`, `localStorage`, or `memory`. |
| `request_batching` | Enables batched SDK sends. |
| `flushAt` | Queue size that triggers a flush. |
| `request_queue_config.flush_interval_ms` | Timed flush interval. |
| `before_send` | Mutate or drop events before they enter the queue. |
| `property_denylist` | Remove sensitive properties before sending. |
| `disable_compression` | Disable fetch request gzip compression. The SDK uses browser `CompressionStream` when available and falls back to plain JSON otherwise. SendBeacon unload flushes are always uncompressed. |

## Pageviews

For single-page applications, use `capture_pageview: "history_change"` so route changes emit `$pageview`:

```ts
analytics.init({
  api_host: 'https://analytics.example.com',
  capture_pageview: 'history_change'
})
```

The SDK promotes URL fields into ClickHouse columns:

- `$current_url` -> `events.current_url`
- `$host` -> `events.host`
- `$session_id` -> `events.session_id`
- `$window_id` -> `events.window_id`

## Autocapture

Autocapture is opt-in. Keep it narrow and explicit:

```ts
analytics.init({
  api_host: 'https://analytics.example.com',
  autocapture: {
    captureText: true,
    element_allowlist: ['button', 'a'],
    dom_event_allowlist: ['click', 'submit']
  }
})
```

The SDK avoids hidden/password inputs, common payment and secret field names, credit-card-like values, SSN-like values, and elements marked with `cpa-sensitive` or `cpa-no-capture`.

## Event Hooks and Privacy

Use `before_send` to enforce a local event contract:

```ts
analytics.init({
  api_host: 'https://analytics.example.com',
  before_send: (event) => {
    if (event.event === 'debug_event') {
      return undefined
    }

    event.properties.app_version = '1.2.3'
    return event
  },
  property_denylist: ['token', 'secret', 'password']
})
```

Use opt-out helpers for consent flows:

```ts
analytics.opt_out_capturing()
analytics.has_opted_out_capturing()
analytics.opt_in_capturing()
```

## React and Next.js

For exact provider, hook, and viewport component signatures, see the [generated React reference](./reference/sdk/react/src/README.md).

Create a client provider:

```tsx
'use client'

import { AnalyticsProvider } from '@clickhouse-product-analytics/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AnalyticsProvider
      options={{
        api_host: 'http://127.0.0.1:8080',
        capture_pageview: 'history_change',
        persistence: 'localStorage+cookie'
      }}
    >
      {children}
    </AnalyticsProvider>
  )
}
```

Wrap the app from `app/layout.tsx`:

```tsx
import { Providers } from './providers'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

Capture from a component with `useAnalytics()`:

```tsx
'use client'

import { useAnalytics } from '@clickhouse-product-analytics/react'

export function SignupButton() {
  const analytics = useAnalytics()

  return (
    <button onClick={() => analytics?.capture('signup_clicked', { placement: 'hero' })}>
      Sign up
    </button>
  )
}
```

Track impressions with `AnalyticsCaptureOnViewed`:

```tsx
import { AnalyticsCaptureOnViewed } from '@clickhouse-product-analytics/react'

export function ProductCard() {
  return (
    <AnalyticsCaptureOnViewed name="product-card" properties={{ product_id: 'sku_123' }}>
      <button>View product</button>
    </AnalyticsCaptureOnViewed>
  )
}
```

`AnalyticsCaptureOnViewed` wraps children in a `div`. When `trackAllChildren` is enabled, each child is wrapped separately and receives a `child_index` property. Avoid that mode in table/list/form structures where extra wrappers would be invalid.

## Direct Single Event API

For exact endpoint, payload, response, and error details, see the [HTTP API reference](./reference/http-api.md).

Backend services can send events directly:

```bash
curl -X POST http://127.0.0.1:8080/i/v0/e/ \
  -H 'content-type: application/json' \
  -d '{
    "api_key": "local_dev_key",
    "event": "backend_job_completed",
    "distinct_id": "user_123",
    "properties": {
      "job_id": "job_456",
      "duration_ms": 481,
      "status": "success"
    }
  }'
```

The same payload shape is accepted at `/capture/` and `/e/`.

## Batch API

Use `/batch/` for multiple events:

```bash
curl -X POST http://127.0.0.1:8080/batch/ \
  -H 'content-type: application/json' \
  -d '{
    "api_key": "local_dev_key",
    "batch": [
      {
        "event": "$pageview",
        "distinct_id": "anon_123",
        "properties": {
          "$current_url": "https://example.com/",
          "$host": "example.com",
          "$session_id": "session_123"
        }
      },
      {
        "event": "checkout_step_viewed",
        "distinct_id": "anon_123",
        "properties": {
          "step": "payment",
          "$session_id": "session_123"
        }
      }
    ]
  }'
```

The service also accepts an array of event objects as the request body. Browser-origin arrays can omit keys. No-origin backend arrays need a valid `api_key` on at least one event, and any provided keys in the same request must match.

## Compressed Requests

The ingest service accepts compressed request bodies:

- `Content-Encoding: gzip`
- `Content-Encoding: deflate`
- `Content-Encoding: br`

Example:

```js
import { gzipSync } from 'node:zlib'

await fetch('http://127.0.0.1:8080/capture/', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'content-encoding': 'gzip'
  },
  body: gzipSync(JSON.stringify({
    api_key: 'local_dev_key',
    event: 'backend_job_completed',
    distinct_id: 'user_123',
    properties: { job_id: 'job_456' }
  }))
})
```

## Invalid Events

The service rejects malformed requests such as invalid timestamps, mixed API keys in one request, disallowed origins, invalid keys, missing keys on no-origin backend requests, oversized bodies, and oversized batches.

Inside an otherwise valid batch, events missing an event name or distinct ID are dropped and counted in the response:

```json
{
  "status": "ok",
  "ingested": 2,
  "dropped": 1
}
```
