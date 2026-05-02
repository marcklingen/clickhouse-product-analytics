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
  apiHost: 'http://127.0.0.1:8080',
  capturePageview: 'history_change',
  autocapture: {
    captureText: true,
    elementAllowlist: ['button', 'a']
  },
  propertyDenylist: ['secret']
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
| `apiHost` | Ingest service URL. |
| `capturePageview` | `true`, `false`, or `"history_change"` for browser apps with client-side routing. |
| `capturePageleave` | `true`, `false`, or `"if_capture_pageview"`. |
| `autocapture` | Disabled by default. Pass an object to capture safe click/change/submit events. |
| `persistence` | `localStorage+cookie`, `localStorage`, or `memory`. |
| `requestBatching` | Enables batched SDK sends. |
| `flushAt` | Queue size that triggers a flush. |
| `flushIntervalMs` | Timed flush interval. |
| `beforeSend` | Mutate or drop events before they enter the queue. |
| `propertyDenylist` | Remove sensitive properties before sending. |

## Pageviews

For single-page applications, use `capturePageview: "history_change"` so route changes emit `$pageview`:

```ts
analytics.init({
  apiHost: 'https://analytics.example.com',
  capturePageview: 'history_change'
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
  apiHost: 'https://analytics.example.com',
  autocapture: {
    captureText: true,
    elementAllowlist: ['button', 'a'],
    domEventAllowlist: ['click', 'submit']
  }
})
```

The SDK avoids hidden/password inputs, common payment and secret field names, credit-card-like values, SSN-like values, and elements marked with `cpa-sensitive` or `cpa-no-capture`.

## Event Hooks and Privacy

Use `beforeSend` to enforce a local event contract:

```ts
analytics.init({
  apiHost: 'https://analytics.example.com',
  beforeSend: (event) => {
    if (event.event === 'debug_event') {
      return undefined
    }

    event.properties.app_version = '1.2.3'
    return event
  },
  propertyDenylist: ['token', 'secret', 'password']
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
        apiHost: 'http://127.0.0.1:8080',
        capturePageview: 'history_change',
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

## Direct API

For exact endpoint, payload, response, and error details, see the [HTTP API reference](./reference/http-api.md).

Backend services send JSON batch payloads to `POST /batch/`. A single event is sent as a one-item batch:

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
          "duration_ms": 481,
          "status": "success"
        }
      }
    ]
  }'
```

## Batch API

Use the same envelope for multiple events:

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

## Compressed Requests

The ingest service accepts gzip-compressed JSON request bodies with `Content-Encoding: gzip`.

Example:

```js
import { gzipSync } from 'node:zlib'

await fetch('http://127.0.0.1:8080/batch/', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'content-encoding': 'gzip'
  },
  body: gzipSync(JSON.stringify({
    api_key: 'local_dev_key',
    batch: [
      {
        event: 'backend_job_completed',
        distinct_id: 'user_123',
        properties: { job_id: 'job_456' }
      }
    ]
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
