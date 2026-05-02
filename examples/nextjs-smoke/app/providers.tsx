'use client'

import { AnalyticsProvider } from '@clickhouse-product-analytics/react'
import type { ReactNode } from 'react'

const apiHost = process.env.NEXT_PUBLIC_CPA_HOST ?? 'http://127.0.0.1:8080'
const apiKey = process.env.NEXT_PUBLIC_CPA_API_KEY ?? 'local_dev_key'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AnalyticsProvider
      apiKey={apiKey}
      options={{
        api_host: apiHost,
        capture_pageview: 'history_change',
        autocapture: {
          captureText: true,
          element_allowlist: ['button', 'a']
        },
        request_queue_config: {
          flush_interval_ms: 1000
        },
        property_denylist: ['secret']
      }}
    >
      {children}
    </AnalyticsProvider>
  )
}

export { apiHost, apiKey }
