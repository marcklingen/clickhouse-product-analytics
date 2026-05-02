# ClickHouse Product Analytics React

React bindings for ClickHouse Product Analytics. The package provides a provider, a `useAnalytics()` hook, and a viewport impression helper for React and Next.js apps.

## Install

```bash
npm install @clickhouse-product-analytics/sdk @clickhouse-product-analytics/react
```

## Use

```tsx
'use client'

import {
  AnalyticsCaptureOnViewed,
  AnalyticsProvider,
  useAnalytics
} from '@clickhouse-product-analytics/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AnalyticsProvider
      options={{
        api_host: 'https://analytics.example.com',
        capture_pageview: 'history_change'
      }}
    >
      {children}
    </AnalyticsProvider>
  )
}

export function SignupButton() {
  const analytics = useAnalytics()

  return (
    <button onClick={() => analytics?.capture('signup_clicked')}>
      Sign up
    </button>
  )
}

export function ProductCard() {
  return (
    <AnalyticsCaptureOnViewed name="product-card" properties={{ product_id: 'sku_123' }}>
      <button>View product</button>
    </AnalyticsCaptureOnViewed>
  )
}
```

`useAnalytics()` returns `undefined` outside a provider and during the first browser render before a managed provider has initialized. Keep event handlers tolerant of that state.

Managed providers initialize once. Changing `apiKey` or `options` after initialization is ignored with a console warning; remount the provider or pass an explicit `client` when runtime configuration needs to change.

`AnalyticsCaptureOnViewed` renders `div` wrappers. When `trackAllChildren` is enabled, each child is wrapped separately and receives a `child_index` property, so avoid that mode in table/list/form structures where extra wrappers would be invalid.

For full API documentation and publishing steps, see the repository docs.
