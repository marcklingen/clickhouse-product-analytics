---
name: product-analytics-tracking
description: Add ClickHouse Product Analytics tracking to an application using the npm SDK, React provider, hook, or public HTTP API. Use when implementing product event capture, user identification, pageviews, backend events, or tests for tracking instrumentation.
---

# Product Analytics Tracking

Use this skill to add maintainable tracking with ClickHouse Product Analytics. Prefer existing application conventions over inventing a new event taxonomy.

## Workflow

1. Inspect the app for existing analytics providers, event names, route conventions, and privacy helpers.
2. Choose the smallest integration surface:
   - React or Next.js UI: `@clickhouse-product-analytics/react`.
   - Browser code without React: `@clickhouse-product-analytics/sdk`.
   - Backend jobs or server actions: HTTP API.
3. Add initialization once near the app root. Do not initialize a new client per component.
4. Use stable event names in past-tense or action form, such as `signup_completed` or `report_exported`.
5. Keep properties small and queryable. Use IDs, plan names, source names, durations, and booleans. Do not send secrets, tokens, passwords, payment data, full free-form text, or large nested objects.
6. Identify users only after the application knows the durable user ID. Use `$set` for mutable person properties and `$set_once` for first-touch properties.
7. Add tests for every documented or newly tracked flow. Assert that the expected event name and important properties are sent.

## React Pattern

```tsx
'use client'

import { AnalyticsProvider, useAnalytics } from '@clickhouse-product-analytics/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AnalyticsProvider
      options={{
        api_host: process.env.NEXT_PUBLIC_CPA_HOST!,
        capture_pageview: 'history_change',
        persistence: 'localStorage+cookie'
      }}
    >
      {children}
    </AnalyticsProvider>
  )
}

export function SignupButton() {
  const analytics = useAnalytics()

  return (
    <button onClick={() => analytics?.capture('signup_started', { source: 'pricing_page' })}>
      Sign up
    </button>
  )
}
```

## Browser SDK Pattern

```ts
import analytics from '@clickhouse-product-analytics/sdk'

analytics.init({
  api_host: 'https://analytics.example.com',
  capture_pageview: 'history_change',
  property_denylist: ['token', 'secret', 'password']
})

analytics.capture('invite_sent', { role: 'admin' })
analytics.identify('user_123', { plan: 'pro' }, { first_seen_source: 'signup' })
```

Allowed browser origins can omit the API key. Use `apiKey` or `analytics.init('configured_key', options)` only when intentionally sending a configured key for extra browser validation.

## Backend Event Pattern

```ts
await fetch('https://analytics.example.com/i/v0/e/', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    api_key: process.env.ANALYTICS_API_KEY,
    event: 'backend_job_completed',
    distinct_id: userId,
    properties: {
      job_id: jobId,
      duration_ms: durationMs,
      status: 'success'
    }
  })
})
```

Backend requests without an `Origin` header require a valid configured `api_key`. `PUBLIC_API_KEYS` accepts a comma-separated list for rotation. Leave `PUBLIC_API_KEYS` empty to disable no-origin backend ingest. Browser requests from `ALLOWED_ORIGINS` may omit keys, but any provided `api_key` must match `PUBLIC_API_KEYS`. API keys are ingest credentials only; they are not tenant, project, or identity boundaries.

## Review Checklist

- One initialization path per runtime.
- Event names are stable and documented by tests or constants.
- Properties are privacy-safe and low-cardinality enough to query.
- `identify` is called after durable login/signup identity is known.
- Tests cover the added instrumentation path.
- No references to local-only filesystem paths or unpublished package names unless the repo intentionally uses them.
